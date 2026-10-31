import { type Cell, type Grid, cellKey, inBounds, isBlocked, sameCell } from "./world.js"

const DIRS: Cell[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
]

function manhattan(a: Cell, b: Cell): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

/**
 * 4-directional A* on the grid. Returns the path including start and goal,
 * or [] if unreachable. The start cell may be blocked (a creature can stand
 * on it); every other cell on the path must be open.
 */
export function findPath(grid: Grid, start: Cell, goal: Cell): Cell[] {
  if (!inBounds(start) || !inBounds(goal)) return []
  if (sameCell(start, goal)) return [start]
  if (isBlocked(grid, goal)) return []

  const startKey = cellKey(start)
  const open = new Map<string, Cell>([[startKey, start]])
  const cameFrom = new Map<string, string>()
  const cells = new Map<string, Cell>([[startKey, start]])
  const g = new Map<string, number>([[startKey, 0]])
  const f = new Map<string, number>([[startKey, manhattan(start, goal)]])
  const closed = new Set<string>()

  while (open.size > 0) {
    // 144 cells max: a linear scan is fast enough and keeps this obviously correct.
    let currentKey = ""
    let best = Number.POSITIVE_INFINITY
    for (const [k] of open) {
      const score = f.get(k) ?? Number.POSITIVE_INFINITY
      if (score < best) {
        best = score
        currentKey = k
      }
    }
    const current = open.get(currentKey) as Cell

    if (sameCell(current, goal)) {
      const path: Cell[] = [current]
      let k = currentKey
      while (cameFrom.has(k)) {
        k = cameFrom.get(k) as string
        path.unshift(cells.get(k) as Cell)
      }
      return path
    }

    open.delete(currentKey)
    closed.add(currentKey)

    for (const d of DIRS) {
      const n = { x: current.x + d.x, y: current.y + d.y }
      const nk = cellKey(n)
      if (!inBounds(n) || closed.has(nk) || isBlocked(grid, n)) continue
      const tentative = (g.get(currentKey) ?? 0) + 1
      if (tentative < (g.get(nk) ?? Number.POSITIVE_INFINITY)) {
        cameFrom.set(nk, currentKey)
        cells.set(nk, n)
        g.set(nk, tentative)
        f.set(nk, tentative + manhattan(n, goal))
        open.set(nk, n)
      }
    }
  }
  return []
}
