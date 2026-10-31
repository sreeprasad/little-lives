/// <reference types="bun" />
import { describe, expect, test } from "bun:test"
import { findPath } from "./pathfinding.js"
import { canTransition, cellsForBox, emptyGrid, GRID_SIZE, pathIntersects } from "./world.js"

describe("cellsForBox", () => {
  test("full frame covers all 144 cells", () => {
    expect(cellsForBox([0, 0, 1000, 1000]).length).toBe(GRID_SIZE * GRID_SIZE)
  })
  test("partial box quantizes correctly", () => {
    const cells = cellsForBox([450, 400, 550, 600])
    // y: 5..6, x: 4..7 → 8 cells
    expect(cells.length).toBe(8)
    expect(cells[0]).toEqual({ x: 4, y: 5 })
    expect(cells[cells.length - 1]).toEqual({ x: 7, y: 6 })
  })
})

describe("findPath", () => {
  test("straight line on open grid", () => {
    const path = findPath(emptyGrid(), { x: 0, y: 6 }, { x: 11, y: 6 })
    expect(path.length).toBe(12)
  })
  test("detours around a wall with one gap", () => {
    const grid = emptyGrid()
    for (let y = 1; y < GRID_SIZE; y++) grid[y][5].blocked = true
    const path = findPath(grid, { x: 0, y: 6 }, { x: 11, y: 6 })
    expect(path.length).toBeGreaterThan(12)
    expect(path.some((c) => grid[c.y][c.x].blocked)).toBe(false)
  })
  test("returns [] when fully walled", () => {
    const grid = emptyGrid()
    for (let y = 0; y < GRID_SIZE; y++) grid[y][5].blocked = true
    expect(findPath(grid, { x: 0, y: 6 }, { x: 11, y: 6 })).toEqual([])
  })
})

describe("crisis + intersection", () => {
  test("forward-only transitions", () => {
    expect(canTransition("NONE", "BLOCKED")).toBe(true)
    expect(canTransition("BLOCKED", "PULLING")).toBe(false)
    expect(canTransition("PULLING", "NONE")).toBe(true)
  })
  test("coffin on row 6 intersects ghost path", () => {
    const path = findPath(emptyGrid(), { x: 0, y: 6 }, { x: 11, y: 6 })
    expect(pathIntersects(path, cellsForBox([480, 400, 560, 650]))).toBe(true)
  })
})
