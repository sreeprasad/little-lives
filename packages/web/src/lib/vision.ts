import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai"
import { cellsForBox } from "./grid"
import { SAMPLE_ENTITIES } from "./sample-world"
import type { Category, Entity, Mass } from "./types"

const MODEL = "gemini-3.5-flash"
const TIMEOUT_MS = 12_000

type Shape = "small_item" | "heavy_container" | "flat" | "long_thin" | "box" | "other"

interface Detection {
  label: string
  box_2d: number[]
  shape: Shape
  mass: Mass
  mythic_name: string
}

export interface ParseResult {
  entities: Entity[]
  fallback: boolean
  ms: number
  error?: string
}

const PROMPT = `You are looking straight down at a desk from above.
Detect every distinct physical object lying on the desk surface. Ignore the desk itself, shadows, reflections, and any object more than half outside the frame.
For each object return:
- label: short plain name, e.g. "coffee mug"
- box_2d: [ymin, xmin, ymax, xmax], normalized 0-1000 to this image, tight around the object
- shape: one of
  small_item (fits in a fist: toy, figurine, eraser, small jar, small bottle, inhaler, lip balm),
  heavy_container (mug, cup, glass, large jar),
  flat (lies flat: notebook, book, paper, phone, tablet),
  long_thin (pen, pencil, marker, stick, ruler, cable),
  box (any box or tall rectangular item),
  other
- mass: LIGHT, MEDIUM or HEAVY, as it would feel to pick up
- mythic_name: a spooky pirate-island name of 2-4 words starting with "The", matched to its shape:
  heavy_container -> a volcano ("The Smoking Peak"), flat -> a sea ("The Black Tide"),
  box -> a lighthouse or fort ("The Drowned Beacon"), long_thin -> a shipwreck ("The Splintered Hull"),
  small_item -> a monster lair ("The Bone Cove"), other -> a ruin.`

const SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      label: { type: Type.STRING },
      box_2d: { type: Type.ARRAY, items: { type: Type.INTEGER } },
      shape: {
        type: Type.STRING,
        enum: ["small_item", "heavy_container", "flat", "long_thin", "box", "other"],
      },
      mass: { type: Type.STRING, enum: ["LIGHT", "MEDIUM", "HEAVY"] },
      mythic_name: { type: Type.STRING },
    },
    required: ["label", "box_2d", "shape", "mass", "mythic_name"],
    propertyOrdering: ["label", "box_2d", "shape", "mass", "mythic_name"],
  },
}

const MASS_RANK: Record<Mass, number> = { LIGHT: 0, MEDIUM: 1, HEAVY: 2 }

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "object"
}

function clampBox(b: number[]): [number, number, number, number] | null {
  if (b.length !== 4) return null
  const [y0, x0, y1, x1] = b.map((v) => Math.max(0, Math.min(1000, Math.round(v))))
  if (y1 - y0 < 5 || x1 - x0 < 5) return null
  return [y0, x0, y1, x1]
}

const LAIR_NAMES = [
  "The Howling Grotto",
  "The Serpent Den",
  "The Sunken Vault",
  "The Rattling Hollow",
  "The Wraith Nest",
  "The Gloom Burrow",
]

/** Gemini sometimes repeats names; make every mythic name unique. */
function uniqueNames(names: string[]): string[] {
  const used = new Set<string>()
  let spare = 0
  return names.map((name) => {
    let n = name.trim() || "The Nameless Ruin"
    while (used.has(n)) n = LAIR_NAMES[spare++ % LAIR_NAMES.length] + (spare > LAIR_NAMES.length ? ` ${spare}` : "")
    used.add(n)
    return n
  })
}
/** Our code, not the model, decides roles. */
export function toEntities(detections: Detection[]): Entity[] {
  const items = detections.flatMap((d, i) => {
    const box = clampBox(d.box_2d ?? [])
    if (!box) return []
    const area = (box[2] - box[0]) * (box[3] - box[1])
    return [{ ...d, box, area, id: `${slug(d.label)}-${i}` }]
  })

  const spawns = items
    .filter((d) => d.shape === "small_item")
    .sort((a, b) => a.area - b.area)
    .slice(0, 3)
  const spawnIds = new Set(spawns.map((s) => s.id))

  const anchor = items
    .filter((d) => !spawnIds.has(d.id) && d.shape !== "flat" && d.shape !== "long_thin")
    .sort(
      (a, b) =>
        Number(b.shape === "heavy_container") - Number(a.shape === "heavy_container") ||
        MASS_RANK[b.mass] - MASS_RANK[a.mass] ||
        b.area - a.area,
    )[0]

  const names = uniqueNames(items.map((d) => d.mythic_name))
  return items.map((d, i) => {
    const category: Category = spawnIds.has(d.id)
      ? "CREATURE_SPAWN"
      : d.id === anchor?.id
        ? "ANCHOR"
        : d.shape === "long_thin"
          ? "OBSTACLE"
          : "PROP"
    return {
      id: d.id,
      label: d.label,
      mythicName: names[i],
      category,
      mass: d.mass,
      box: d.box,
      cells: cellsForBox(d.box),
      blocking: category !== "CREATURE_SPAWN" && d.shape !== "flat",
      cutoutKey: d.id,
    }
  })
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Gemini timed out after ${ms}ms`)), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

export async function parseDesk(base64Jpeg: string, mimeType = "image/jpeg"): Promise<ParseResult> {
  const started = Date.now()
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set")
    const ai = new GoogleGenAI({ apiKey })

    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL,
        contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: base64Jpeg } }, { text: PROMPT }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      }),
      TIMEOUT_MS,
    )

    const detections = JSON.parse(response.text ?? "[]") as Detection[]
    const entities = toEntities(detections)
    if (entities.length === 0) throw new Error("Gemini found no objects")
    return { entities, fallback: false, ms: Date.now() - started }
  } catch (error) {
    return {
      entities: SAMPLE_ENTITIES,
      fallback: true,
      ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
