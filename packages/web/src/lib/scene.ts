import type { Cell, Entity } from "./types"

export const GRID = 12
export const DESK_ASPECT = 2338 / 1720 // sample photo; M4 sets this from the camera
export const DESK_W = 16
export const DESK_D = DESK_W / DESK_ASPECT
export const CELL_W = DESK_W / GRID
export const CELL_D = DESK_D / GRID

/** Cell center in world space (x right, z toward the viewer, y up). */
export function cellToWorld(c: Cell): [number, number, number] {
  return [(c.x + 0.5) * CELL_W - DESK_W / 2, 0, (c.y + 0.5) * CELL_D - DESK_D / 2]
}

/** World-space rectangle covering all of an entity's cells. */
export function entityRect(e: Entity) {
  const xs = e.cells.map((c) => c.x)
  const ys = e.cells.map((c) => c.y)
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs) + 1
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys) + 1
  return {
    cx: ((x0 + x1) / 2) * CELL_W - DESK_W / 2,
    cz: ((y0 + y1) / 2) * CELL_D - DESK_D / 2,
    w: (x1 - x0) * CELL_W,
    d: (y1 - y0) * CELL_D,
  }
}
