import { createBus } from "./bus"
import { createGhost, createSkeleton, createZombie } from "./creatures"
import { world } from "./world-client"

const bus = await createBus(["ghost", "skeleton", "zombie"])
console.log(`🕯️  Little Lives agents up · relay mode: ${bus.mode}`)

const ghost = createGhost(bus)
const skeleton = createSkeleton(bus)
const zombie = createZombie(bus)

// Watchdog: if a crisis step stalls (e.g. agents restarted mid-crisis), re-send that step.
const STALL_MS = 15000
let last = { id: "", status: "", since: Date.now() }

setInterval(async () => {
  try {
    const c = await world().getCrisis()
    if (c.id !== last.id || c.status !== last.status) {
      last = { id: c.id, status: c.status, since: Date.now() }
      return
    }
    if (Date.now() - last.since < STALL_MS) return
    last.since = Date.now()
    if (c.status === "ASSESSING") await ghost.resume(c)
    else if (c.status === "RIGGING") await skeleton.resume(c)
    else if (c.status === "ANCHORED") await zombie.resume(c)
    else return
    console.log(`[watchdog] resumed crisis at ${c.status}`)
  } catch (e) {
    console.warn("[watchdog]", e instanceof Error ? e.message : e)
  }
}, 1000)
