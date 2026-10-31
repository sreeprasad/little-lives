import { actors } from "../generated/index.js"

export const WORLD_ID = "desk-1"
export const world = () => actors.WorldActor.get(WORLD_ID)
