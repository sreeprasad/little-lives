import type { Cell, Mass, Role } from "../../actors/src/world"

export interface ObstacleAssessment {
  obstacleId: string
  mass: Mass
  cells: Cell[]
}
export interface AnchorRequest {
  requiredForce: number
  anchorCell: Cell
}
export interface AnchorGranted {
  anchorCell: Cell
  braceForce: number
}

interface Base {
  crisisId: string
  from: Role
  to: Role
}

export type Packet =
  | (Base & { type: "OBSTACLE_ASSESSMENT"; payload: ObstacleAssessment })
  | (Base & { type: "ANCHOR_REQUEST"; payload: AnchorRequest })
  | (Base & { type: "ANCHOR_GRANTED"; payload: AnchorGranted })

export function isPacket(x: unknown): x is Packet {
  return typeof x === "object" && x !== null && "type" in x && "crisisId" in x && "to" in x && "payload" in x
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Deliberate pause between steps so the audience can follow. */
export const pace = () => sleep(600 + Math.random() * 300)
