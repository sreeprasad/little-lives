import type { Cell, Crisis, Entity, Mass } from "../../actors/src/world"
import { onceEach, type RelayBus } from "./bus"
import { type ObstacleAssessment, type Packet, pace } from "./protocol"
import { world } from "./world-client"

const FORCE: Record<Mass, number> = { LIGHT: 10, MEDIUM: 25, HEAVY: 50 }

function middleCell(e: Entity): Cell {
  return e.cells[Math.floor(e.cells.length / 2)]!
}

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e)
}

async function sendAndLog(bus: RelayBus, p: Packet) {
  await bus.send(p)
  console.log(`[${bus.mode}] ${p.from} → ${p.to}: ${p.type}`)
  await world()
    .logRelayPacket({ at: Date.now(), from: p.from, to: p.to, type: p.type, payload: p.payload })
    .catch((e) => console.warn("[log]", errMsg(e)))
}

async function findObstacle(crisis: Crisis) {
  const snap = await world().getSnapshot()
  return snap.entities.find((e) => e.id === crisis.obstacleId)
}

// ---------- ghost: scout ----------

export function createGhost(bus: RelayBus) {
  let handled = ""

  async function sendAssessment(crisis: Crisis) {
    const obstacle = await findObstacle(crisis)
    if (!obstacle) return
    await pace()
    await sendAndLog(bus, {
      type: "OBSTACLE_ASSESSMENT",
      crisisId: crisis.id,
      from: "ghost",
      to: "skeleton",
      payload: { obstacleId: obstacle.id, mass: obstacle.mass, cells: obstacle.cells },
    })
  }

  async function tick() {
    const crisis = await world().getCrisis()
    if (crisis.status !== "BLOCKED" || handled === crisis.id) return
    handled = crisis.id
    await pace()
    await world().advanceCrisis({
      crisisId: crisis.id,
      status: "ASSESSING",
      role: "ghost",
      speech: "Something heavy blocks the path… Skeleton, help!",
    })
    await sendAssessment(crisis)
  }

  const loop = async () => {
    try {
      await tick()
    } catch (e) {
      console.warn("[ghost]", errMsg(e))
    }
    setTimeout(loop, 500)
  }
  void loop()

  return { resume: sendAssessment }
}

// ---------- skeleton: engineer ----------

export function createSkeleton(bus: RelayBus) {
  async function requestAnchor(crisisId: string, a: ObstacleAssessment) {
    const snap = await world().getSnapshot()
    const anchor = snap.entities.find((e) => e.category === "ANCHOR")
    const anchorCell = anchor ? middleCell(anchor) : a.cells[a.cells.length - 1]!
    await pace()
    await sendAndLog(bus, {
      type: "ANCHOR_REQUEST",
      crisisId,
      from: "skeleton",
      to: "zombie",
      payload: { requiredForce: FORCE[a.mass], anchorCell },
    })
  }

  bus.on(
    "skeleton",
    onceEach(async (p) => {
      try {
        if (p.type === "OBSTACLE_ASSESSMENT") {
          await pace()
          await world().advanceCrisis({
            crisisId: p.crisisId,
            status: "RIGGING",
            role: "skeleton",
            speech: `A ${p.payload.mass.toLowerCase()} coffin… I'll rig a bone-chain!`,
            goal: p.payload.cells[0],
          })
          await requestAnchor(p.crisisId, p.payload)
        } else if (p.type === "ANCHOR_GRANTED") {
          await pace()
          const crisis = await world().applyForce(p.crisisId, p.payload.braceForce)
          console.log(`[skeleton] heave! crisis → ${crisis.status}`)
        }
      } catch (e) {
        console.warn("[skeleton]", errMsg(e))
      }
    }),
  )

  return {
    async resume(crisis: Crisis) {
      const obstacle = await findObstacle(crisis)
      if (obstacle) {
        await requestAnchor(crisis.id, { obstacleId: obstacle.id, mass: obstacle.mass, cells: obstacle.cells })
      }
    },
  }
}

// ---------- zombie: anchor ----------

export function createZombie(bus: RelayBus) {
  async function grant(crisisId: string, anchorCell: Cell, braceForce: number) {
    await pace()
    await sendAndLog(bus, {
      type: "ANCHOR_GRANTED",
      crisisId,
      from: "zombie",
      to: "skeleton",
      payload: { anchorCell, braceForce },
    })
  }

  bus.on(
    "zombie",
    onceEach(async (p) => {
      if (p.type !== "ANCHOR_REQUEST") return
      try {
        await pace()
        await world().advanceCrisis({
          crisisId: p.crisisId,
          status: "ANCHORED",
          role: "zombie",
          speech: "I shall not be moved.",
          goal: p.payload.anchorCell,
        })
        await grant(p.crisisId, p.payload.anchorCell, p.payload.requiredForce)
      } catch (e) {
        console.warn("[zombie]", errMsg(e))
      }
    }),
  )

  return {
    async resume(crisis: Crisis) {
      const snap = await world().getSnapshot()
      const anchor = snap.entities.find((e) => e.category === "ANCHOR")
      const zombie = snap.creatures.find((c) => c.role === "zombie")
      const cell = anchor ? middleCell(anchor) : (zombie?.cell ?? { x: 0, y: 0 })
      await grant(crisis.id, cell, crisis.requiredForce)
    },
  }
}
