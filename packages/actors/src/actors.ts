import { Actor, type ActorSocket, Persisted } from "durable-actors"
import { findPath } from "./pathfinding.js"
import {
  type Cell,
  type Creature,
  type Crisis,
  type CrisisStatus,
  type Entity,
  type Grid,
  type RelayPacket,
  type Role,
  type WorldSnapshot,
  FORCE_BY_MASS,
  GHOST_PATROL,
  RELAY_LOG_LIMIT,
  buildGrid,
  canTransition,
  cellKey,
  emptyGrid,
  isBlocked,
  nearestOpenCell,
  noCrisis,
  pathIntersects,
  spawnCreatures,
} from "./world.js"

const TICK_MS = 400
const PULL_MS = 3000
const CELEBRATE_MS = 4000
const STALE_TICK_MS = 2000

type Viewer = { role: string }
type ClientMessage = { type: "ping" }

export interface AdvanceCrisisInput {
  crisisId: string
  status: CrisisStatus
  role: Role
  speech: string
  goal?: Cell
}

// ---------------------------------------------------------------------------
// Pure helpers live at module scope: every method on an Actor class is an RPC
// and must be async, so sync logic cannot be a class method.
// ---------------------------------------------------------------------------

const CELEBRATION_LINES: Record<Role, string> = {
  ghost: "The way is open!",
  skeleton: "Bones never fail!",
  zombie: "Braaaaavo.",
}

function withoutSpeech(c: Creature): Creature {
  const { speech: _drop, ...rest } = c
  return rest
}

function patrolGoal(c: Creature): Cell {
  const [a, b] = GHOST_PATROL
  const da = Math.abs(c.cell.x - a.x) + Math.abs(c.cell.y - a.y)
  const db = Math.abs(c.cell.x - b.x) + Math.abs(c.cell.y - b.y)
  return da >= db ? a : b
}

function routeTo(grid: Grid, c: Creature, goal: Cell): Creature {
  const target = nearestOpenCell(grid, goal) ?? goal
  const path = findPath(grid, c.cell, target)
  return path.length > 1
    ? { ...c, goal: target, path, state: "WALKING" }
    : { ...c, goal: target, path: [], state: "IDLE" }
}

function updateRole(creatures: Creature[], role: Role, fn: (c: Creature) => Creature): Creature[] {
  return creatures.map((c) => (c.role === role ? fn(c) : c))
}

function stepCreature(c: Creature, grid: Grid, crisis: Crisis): Creature {
  const calm = crisis.status === "NONE"

  if (c.role === "ghost" && calm && c.state === "IDLE") {
    return routeTo(grid, c, patrolGoal(c))
  }
  if (c.state !== "WALKING" || c.path.length < 2) return c

  const next = c.path[1]
  if (isBlocked(grid, next)) {
    if (c.role === "ghost" && !calm) return { ...c, path: [], state: "BLOCKED" }
    return routeTo(grid, c, c.goal ?? c.cell)
  }

  const rest = c.path.slice(1)
  const moved: Creature = { ...c, cell: next, path: rest.length > 1 ? rest : [] }
  if (rest.length > 1) return { ...moved, state: "WALKING" }

  // Arrived.
  if (c.role === "ghost") {
    return calm ? routeTo(grid, moved, patrolGoal(moved)) : { ...moved, state: "BLOCKED" }
  }
  const crisisActive = !calm && crisis.status !== "CLEARED"
  return { ...moved, state: crisisActive ? "WORKING" : "IDLE" }
}

function celebrate(creatures: Creature[]): Creature[] {
  return creatures.map((c) => ({
    ...c,
    path: [],
    state: "CELEBRATING",
    speech: CELEBRATION_LINES[c.role],
  }))
}

function calmDown(creatures: Creature[], grid: Grid): Creature[] {
  return creatures.map((c) => {
    const quiet = withoutSpeech(c)
    return c.role === "ghost"
      ? routeTo(grid, quiet, patrolGoal(quiet))
      : { ...quiet, path: [], state: "IDLE" }
  })
}

function needsKick(running: boolean, lastTickAt: number): boolean {
  return running && Date.now() - lastTickAt > STALE_TICK_MS
}

interface WorldFields {
  version: number
  entities: Entity[]
  creatures: Creature[]
  grid: Grid
  crisis: Crisis
  relayLog: RelayPacket[]
}

function toSnapshot(w: WorldFields): WorldSnapshot {
  return {
    version: w.version,
    entities: w.entities,
    creatures: w.creatures,
    grid: w.grid,
    crisis: w.crisis,
    relayLog: w.relayLog,
  }
}

// ---------------------------------------------------------------------------

export class WorldActor extends Actor<Viewer, ClientMessage, WorldSnapshot> {
  @Persisted version = 0
  @Persisted entities: Entity[] = []
  @Persisted creatures: Creature[] = []
  @Persisted grid: Grid = emptyGrid()
  @Persisted crisis: Crisis = noCrisis()
  @Persisted relayLog: RelayPacket[] = []
  @Persisted running = false
  @Persisted lastTickAt = 0
  @Persisted phaseUntil = 0

  // ---------- sockets ----------

  async onConnect(socket: ActorSocket<Viewer, WorldSnapshot>) {
    socket.send(toSnapshot(this))
    if (needsKick(this.running, this.lastTickAt)) {
      await this.alarm.set(Date.now() + TICK_MS)
    }
  }

  async onMessage(_socket: ActorSocket<Viewer, WorldSnapshot>, _msg: ClientMessage) {
    // Viewers are read-only. All writes go through server routes / agents.
  }

  // ---------- public API ----------

  async getSnapshot(): Promise<WorldSnapshot> {
    return toSnapshot(this)
  }

  async getCrisis(): Promise<Crisis> {
    return this.crisis
  }

  async applyScan(entities: Entity[]): Promise<WorldSnapshot> {
    this.entities = entities
    this.grid = buildGrid(entities)
    this.crisis = noCrisis()
    this.phaseUntil = 0
    const grid = this.grid
    this.creatures = spawnCreatures(entities, grid).map((c) =>
      c.role === "ghost" ? routeTo(grid, c, patrolGoal(c)) : c,
    )
    this.running = true
    this.version += 1
    this.broadcast(toSnapshot(this))
    await this.alarm.set(Date.now() + TICK_MS)
    return toSnapshot(this)
  }

  async dropObstacle(entity: Entity): Promise<Crisis> {
    const previousGrid = this.grid
    const obstacle: Entity = { ...entity, category: "OBSTACLE", blocking: true }
    this.entities = [...this.entities.filter((e) => e.id !== obstacle.id), obstacle]
    this.grid = buildGrid(this.entities)
    const grid = this.grid

    const ghost = this.creatures.find((c) => c.role === "ghost")
    if (ghost) {
      const blocked = new Set(obstacle.cells.map(cellKey))
      const standingInIt = blocked.has(cellKey(ghost.cell))
      const ahead = ghost.path.slice(1)
      const patrolLine = findPath(
        previousGrid,
        nearestOpenCell(previousGrid, GHOST_PATROL[0]) ?? GHOST_PATROL[0],
        nearestOpenCell(previousGrid, GHOST_PATROL[1]) ?? GHOST_PATROL[1],
      )
      const blocksGhost =
        standingInIt ||
        pathIntersects(ahead, obstacle.cells) ||
        pathIntersects(patrolLine, obstacle.cells)

      if (this.crisis.status === "NONE" && blocksGhost) {
        this.crisis = {
          id: `crisis-${Date.now()}`,
          obstacleId: obstacle.id,
          requiredForce: FORCE_BY_MASS[obstacle.mass],
          appliedForce: 0,
          status: "BLOCKED",
        }

        // If the coffin landed on the ghost, bump it to the nearest open cell first.
        const start = standingInIt ? (nearestOpenCell(grid, ghost.cell) ?? ghost.cell) : ghost.cell
        // Wait on the patrol route, touching the obstacle, as close to the ghost as possible.
        const touches = (c: Cell) =>
          obstacle.cells.some((o) => Math.abs(o.x - c.x) + Math.abs(o.y - c.y) === 1)
        const dist = (c: Cell) => Math.abs(c.x - start.x) + Math.abs(c.y - start.y)
        const edge =
          patrolLine.filter((c) => !isBlocked(grid, c) && touches(c)).sort((a, b) => dist(a) - dist(b))[0] ??
          nearestOpenCell(grid, start) ??
          start

        this.creatures = updateRole(this.creatures, "ghost", (c) => {
          const routed = routeTo(grid, { ...c, cell: start }, edge)
          return {
            ...routed,
            state: routed.state === "WALKING" ? "WALKING" : "BLOCKED",
            speech: "Something blocks the path…",
          }
        })
      } else if (pathIntersects(ahead, obstacle.cells)) {
        this.creatures = updateRole(this.creatures, "ghost", (c) =>
          routeTo(grid, c, c.goal ?? patrolGoal(c)),
        )
      }
    }

    this.version += 1
    this.broadcast(toSnapshot(this))
    if (needsKick(this.running, this.lastTickAt)) {
      await this.alarm.set(Date.now() + TICK_MS)
    }
    return this.crisis
  }

  async advanceCrisis(input: AdvanceCrisisInput): Promise<Crisis> {
    if (input.crisisId !== this.crisis.id) throw new Error(`Stale crisis ${input.crisisId}`)
    if (this.crisis.status === input.status) return this.crisis // idempotent retry
    if (!["ASSESSING", "RIGGING", "ANCHORED"].includes(input.status)) {
      throw new Error(`advanceCrisis cannot set ${input.status}`)
    }
    if (!canTransition(this.crisis.status, input.status)) {
      throw new Error(`Illegal transition ${this.crisis.status} -> ${input.status}`)
    }

    const grid = this.grid
    this.crisis = { ...this.crisis, status: input.status }
    this.creatures = updateRole(this.creatures, input.role, (c) => {
      const spoken: Creature = { ...c, speech: input.speech }
      if (!input.goal) return { ...spoken, path: [], state: "WORKING" }
      const routed = routeTo(grid, spoken, input.goal)
      return routed.state === "IDLE" ? { ...routed, state: "WORKING" } : routed
    })
    this.version += 1
    this.broadcast(toSnapshot(this))
    return this.crisis
  }

  async applyForce(crisisId: string, force: number): Promise<Crisis> {
    if (crisisId !== this.crisis.id) throw new Error(`Stale crisis ${crisisId}`)
    if (this.crisis.status === "PULLING" || this.crisis.status === "CLEARED") return this.crisis
    if (this.crisis.status !== "ANCHORED") {
      throw new Error(`Cannot pull while ${this.crisis.status}`)
    }

    const appliedForce = this.crisis.appliedForce + force
    if (appliedForce < this.crisis.requiredForce) {
      this.crisis = { ...this.crisis, appliedForce }
    } else {
      this.crisis = { ...this.crisis, appliedForce, status: "PULLING" }
      this.phaseUntil = Date.now() + PULL_MS
      this.creatures = updateRole(this.creatures, "skeleton", (c) => ({
        ...c,
        state: "WORKING",
        speech: "Heave!",
      }))
      this.creatures = updateRole(this.creatures, "zombie", (c) => ({
        ...c,
        state: "WORKING",
        speech: "I shall not be moved.",
      }))
    }
    this.version += 1
    this.broadcast(toSnapshot(this))
    if (needsKick(this.running, this.lastTickAt)) {
      await this.alarm.set(Date.now() + TICK_MS)
    }
    return this.crisis
  }

  async logRelayPacket(packet: RelayPacket): Promise<void> {
    this.relayLog = [...this.relayLog, { ...packet, at: packet.at || Date.now() }].slice(
      -RELAY_LOG_LIMIT,
    )
    this.version += 1
    this.broadcast(toSnapshot(this))
  }

  async reset(): Promise<WorldSnapshot> {
    this.entities = []
    this.creatures = []
    this.grid = emptyGrid()
    this.crisis = noCrisis()
    this.relayLog = []
    this.running = false
    this.phaseUntil = 0
    this.version += 1
    this.broadcast(toSnapshot(this))
    return toSnapshot(this)
  }

  // ---------- tick ----------

  async onAlarm() {
    if (!this.running) return
    const now = Date.now()
    this.lastTickAt = now

    if (this.crisis.status === "PULLING" && now >= this.phaseUntil) {
      this.entities = this.entities.filter((e) => e.id !== this.crisis.obstacleId)
      this.grid = buildGrid(this.entities)
      this.crisis = { ...this.crisis, status: "CLEARED" }
      this.phaseUntil = now + CELEBRATE_MS
      this.creatures = celebrate(this.creatures)
    } else if (this.crisis.status === "CLEARED" && now >= this.phaseUntil) {
      this.crisis = noCrisis()
      this.phaseUntil = 0
      this.creatures = calmDown(this.creatures, this.grid)
    }

    const grid = this.grid
    const crisis = this.crisis
    this.creatures = this.creatures.map((c) => stepCreature(c, grid, crisis))
    this.version += 1
    this.broadcast(toSnapshot(this))
    await this.alarm.set(now + TICK_MS)
  }
}
