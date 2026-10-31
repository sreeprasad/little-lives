import { actors } from "../../generated/index.js"

export const WORLD_ID = "desk-1"

export function worldActor() {
  return actors.WorldActor.get(WORLD_ID)
}

export { actors }
