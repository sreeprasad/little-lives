export const GRID_SIZE = 12
export const RELAY_LOG_LIMIT = 50

export type Category = "CREATURE_SPAWN" | "ANCHOR" | "OBSTACLE" | "PROP"
export type Mass = "LIGHT" | "MEDIUM" | "HEAVY"
export type Role = "ghost" | "skeleton" | "zombie"
export type CreatureState = "IDLE" | "WALKING" | "BLOCKED" | "WORKING" | "CELEBRATING"
export type CrisisStatus =
  | "NONE"
  | "BLOCKED"
  | "ASSESSING"
  | "RIGGING"
  | "ANCHORED"
  | "PULLING"
  | "CLEARED"

export interface Cell {
  x: number
  y: number
}

export interface Entity {
  id: string
  label: string
  mythicName: string
  category: Category
  mass: Mass
  box: [number, number, number, number] // [ymin, xmin, ymax, xmax], 0–1000
  cells: Cell[]
  blocking: boolean
  cutoutKey?: string
}

export interface Creature {
  role: Role
  cell: Cell
  path: Cell[]
  state: CreatureState
  speech?: string
  goal?: Cell
}

export interface Crisis {
  id: string
  obstacleId: string
  requiredForce: number
  appliedForce: number
  status: CrisisStatus
}

export interface RelayPacket {
  at: number
  from: Role | "world"
  to: Role | "world"
  type: string
  payload: unknown
}

export interface GridCell {
  blocked: boolean
}

export type Grid = GridCell[][] // grid[y][x]

export interface WorldSnapshot {
  version: number
  entities: Entity[]
  creatures: Creature[]
  grid: Grid
  crisis: Crisis
  relayLog: RelayPacket[]
}

export const ROLES: Role[] = ["ghost", "skeleton", "zombie"]

export const FORCE_BY_MASS: Record<Mass, number> = {
  LIGHT: 10,
  MEDIUM: 25,
  HEAVY: 50,
}

/** Ghost patrols across the middle row; others idle at home cells. */
export const GHOST_PATROL: [Cell, Cell] = [
  { x: 0, y: 6 },
  { x: GRID_SIZE - 1, y: 6 },
]

export const DEFAULT_HOMES: Record<Role, Cell> = {
  ghost: { x: 0, y: 6 },
  skeleton: { x: 2, y: 9 },
  zombie: { x: 9, y: 9 },
}

export const CRISIS_FLOW: CrisisStatus[] = [
  "NONE",
  "BLOCKED",
  "ASSESSING",
  "RIGGING",
  "ANCHORED",
  "PULLING",
  "CLEARED",
]

// ---------- cell helpers ----------

export function cellKey(c: Cell): string {
  return `${c.x},${c.y}`
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y
}

export function inBounds(c: Cell): boolean {
  return c.x >= 0 && c.y >= 0 && c.x < GRID_SIZE && c.y < GRID_SIZE
}

function clampIndex(n: number): number {
  return Math.max(0, Math.min(GRID_SIZE - 1, n))
}

/**
 * Every grid cell a normalized box overlaps.
 * A max edge exactly on a cell boundary does not claim the next cell.
 */
export function cellsForBox(box: [number, number, number, number]): Cell[] {
  const [ymin, xmin, ymax, xmax] = box
  const x0 = clampIndex(Math.floor((xmin / 1000) * GRID_SIZE))
  const y0 = clampIndex(Math.floor((ymin / 1000) * GRID_SIZE))
  const x1 = Math.max(x0, clampIndex(Math.ceil((xmax / 1000) * GRID_SIZE) - 1))
  const y1 = Math.max(y0, clampIndex(Math.ceil((ymax / 1000) * GRID_SIZE) - 1))
  const cells: Cell[] = []
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) cells.push({ x, y })
  }
  return cells
}

export function boxCenterCell(box: [number, number, number, number]): Cell {
  const [ymin, xmin, ymax, xmax] = box
  return {
    x: clampIndex(Math.floor((((xmin + xmax) / 2) / 1000) * GRID_SIZE)),
    y: clampIndex(Math.floor((((ymin + ymax) / 2) / 1000) * GRID_SIZE)),
  }
}

function boxArea(box: [number, number, number, number]): number {
  return Math.max(0, box[2] - box[0]) * Math.max(0, box[3] - box[1])
}

// ---------- grid ----------

export function emptyGrid(): Grid {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => ({ blocked: false })),
  )
}

export function buildGrid(entities: Entity[]): Grid {
  const grid = emptyGrid()
  for (const e of entities) {
    if (!e.blocking) continue
    for (const c of e.cells) {
      if (inBounds(c)) grid[c.y][c.x].blocked = true
    }
  }
  return grid
}

export function isBlocked(grid: Grid, c: Cell): boolean {
  return !inBounds(c) || grid[c.y][c.x].blocked
}

/** BFS outward from target to the nearest unblocked cell (or null). */
export function nearestOpenCell(grid: Grid, target: Cell, exclude: Cell[] = []): Cell | null {
  const excluded = new Set(exclude.map(cellKey))
  const seen = new Set<string>([cellKey(target)])
  const queue: Cell[] = [target]
  while (queue.length > 0) {
    const c = queue.shift() as Cell
    if (inBounds(c) && !grid[c.y][c.x].blocked && !excluded.has(cellKey(c))) return c
    for (const n of [
      { x: c.x + 1, y: c.y },
      { x: c.x - 1, y: c.y },
      { x: c.x, y: c.y + 1 },
      { x: c.x, y: c.y - 1 },
    ]) {
      const k = cellKey(n)
      if (inBounds(n) && !seen.has(k)) {
        seen.add(k)
        queue.push(n)
      }
    }
  }
  return null
}

export function pathIntersects(path: Cell[], cells: Cell[]): boolean {
  const blocked = new Set(cells.map(cellKey))
  return path.some((c) => blocked.has(cellKey(c)))
}

// ---------- creatures ----------

export function spawnCreatures(entities: Entity[], grid: Grid): Creature[] {
  const spawns = entities
    .filter((e) => e.category === "CREATURE_SPAWN")
    .sort((a, b) => boxArea(a.box) - boxArea(b.box))

  const taken: Cell[] = []
  return ROLES.map((role, i) => {
    const preferred = spawns[i] ? boxCenterCell(spawns[i].box) : DEFAULT_HOMES[role]
    const cell = nearestOpenCell(grid, preferred, taken) ?? preferred
    taken.push(cell)
    return { role, cell, path: [], state: "IDLE" as CreatureState }
  })
}

// ---------- crisis state machine ----------

export function noCrisis(): Crisis {
  return { id: "", obstacleId: "", requiredForce: 0, appliedForce: 0, status: "NONE" }
}

/** Only forward one step, CLEARED -> NONE, or anything -> NONE (reset). */
export function canTransition(from: CrisisStatus, to: CrisisStatus): boolean {
  if (to === "NONE") return true
  const i = CRISIS_FLOW.indexOf(from)
  return i >= 0 && CRISIS_FLOW[i + 1] === to
}
