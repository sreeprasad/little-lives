import { cellsForBox } from "./grid"
import type { Category, Entity, Mass } from "./types"

export const SAMPLE_PHOTO = "/samples/desk.jpg"

function entity(
  id: string,
  label: string,
  mythicName: string,
  category: Category,
  mass: Mass,
  box: [number, number, number, number],
  blocking = category !== "CREATURE_SPAWN",
): Entity {
  return { id, label, mythicName, category, mass, box, cells: cellsForBox(box), blocking, cutoutKey: id }
}

// Boxes hand-measured on desk.jpg as [ymin, xmin, ymax, xmax], 0–1000. Gemini replaces this in M5.
export const SAMPLE_ENTITIES: Entity[] = [
  entity("inhaler", "inhaler", "The Pale Wisp", "CREATURE_SPAWN", "LIGHT", [128, 285, 188, 402]),
  entity("jar", "balm jar", "The Rattling Urn", "CREATURE_SPAWN", "LIGHT", [205, 333, 330, 410]),
  entity("bottle", "bottle", "The Shambler's Flask", "CREATURE_SPAWN", "MEDIUM", [0, 430, 185, 505]),
  entity("mug", "coffee mug", "The Weeping Crypt", "ANCHOR", "HEAVY", [222, 570, 598, 870]),
  entity("swabs", "swab box", "The Leaning Tombstone", "PROP", "MEDIUM", [22, 703, 312, 944]),
  // Lies flat: walkable, drawn only by the ground photo.
  entity("notebook", "notebook", "The Black Grimoire", "PROP", "LIGHT", [370, 40, 988, 525], false),
]

export const SAMPLE_COFFIN: Entity = {
  ...entity("pen", "pen", "The Fallen Coffin", "OBSTACLE", "MEDIUM", [640, 580, 720, 860]),
  cutoutKey: undefined,
}
