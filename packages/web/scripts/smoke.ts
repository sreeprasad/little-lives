import { actors } from "../generated/index.js"

const world = actors.WorldActor.get("desk-1")
const snap = await world.getSnapshot()
console.log("version:", snap.version)
console.log("creatures:", snap.creatures.length)
console.log("crisis:", snap.crisis.status)
console.log("grid rows:", snap.grid.length)
