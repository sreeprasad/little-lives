import type { Cell } from "./types"

export const GRID_SIZE = 12

function clampIndex(n: number): number {
  return Math.max(0, Math.min(GRID_SIZE - 1, n))
}

/** Every grid cell a [ymin, xmin, ymax, xmax] 0–1000 box overlaps. */
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
