import { AgentRelay, type RelayAgentClient, type RelayMessageEvent } from "@agent-relay/sdk"
import type { Role } from "../../actors/src/world"
import { isPacket, type Packet } from "./protocol"

export type Handler = (p: Packet) => void | Promise<void>

export interface RelayBus {
  readonly mode: "cloud" | "memory"
  send(p: Packet): Promise<void>
  on(role: Role, handler: Handler): void
}

/** Fallback: same interface, no network. */
export class InMemoryBus implements RelayBus {
  readonly mode = "memory" as const
  private handlers = new Map<Role, Handler[]>()

  on(role: Role, handler: Handler) {
    this.handlers.set(role, [...(this.handlers.get(role) ?? []), handler])
  }

  async send(p: Packet) {
    const hs = this.handlers.get(p.to) ?? []
    setTimeout(() => hs.forEach((h) => void h(p)), 50)
  }
}

type WithListener = { addListener?: (selector: string, h: (e: RelayMessageEvent) => void) => () => void }

/** Real Agent Relay: each creature is a registered agent; packets travel as DMs. */
export class RelayCloudBus implements RelayBus {
  readonly mode = "cloud" as const
  private handlers = new Map<Role, Handler[]>()
  private seen = new Set<string>()
  names = new Map<Role, string>()

  private constructor(
    private readonly clients: Map<Role, RelayAgentClient>,
    relay: AgentRelay,
  ) {
    const onEvent = (ev: RelayMessageEvent) => {
      if (this.seen.has(ev.message.id)) return
      this.seen.add(ev.message.id)
      let body: unknown
      try {
        body = JSON.parse(ev.message.text)
      } catch {
        return
      }
      if (!isPacket(body)) return
      for (const h of this.handlers.get(body.to) ?? []) void h(body)
    }
    relay.addListener("dm.received", onEvent)
    relay.addListener("message.created", onEvent)
    for (const c of clients.values()) (c as unknown as WithListener).addListener?.call(c, "dm.received", onEvent)
  }

  static async connect(workspaceKey: string, roles: Role[]) {
    const relay = new AgentRelay({ workspaceKey })
    const register = (names: string[]) =>
      relay.workspace.register(names.map((name) => ({ name, type: "agent" as const })))

    let names: string[] = [...roles]
    let registered: RelayAgentClient[]
    try {
      registered = await register(names)
    } catch (e) {
      // Names already taken by an earlier run: use names unique to this run.
      // Creatures address each other through the bus, so the exact names don't matter.
      const tag = Math.random().toString(36).slice(2, 6)
      names = roles.map((r) => `${r}-${tag}`)
      console.warn(`[relay] ${e instanceof Error ? e.message : e} → registering ${names.join(", ")}`)
      registered = await register(names)
    }

    const bus = new RelayCloudBus(new Map(roles.map((r, i) => [r, registered[i]!])), relay)
    bus.names = new Map(roles.map((r, i) => [r, names[i]!]))
    return bus
  }

  on(role: Role, handler: Handler) {
    this.handlers.set(role, [...(this.handlers.get(role) ?? []), handler])
  }

  async send(p: Packet) {
    const client = this.clients.get(p.from)
    if (!client) throw new Error(`No relay client for ${p.from}`)
    await client.sendMessage({ to: `@${this.names.get(p.to) ?? p.to}`, text: JSON.stringify(p) })
  }
}

/** RELAY_MODE=memory forces the fallback; otherwise use Relay Cloud and fall back on failure. */
export async function createBus(roles: Role[]): Promise<RelayBus> {
  const key = process.env.RELAY_WORKSPACE_KEY
  if (process.env.RELAY_MODE === "memory" || !key) return new InMemoryBus()
  try {
    return await RelayCloudBus.connect(key, roles)
  } catch (e) {
    console.warn("[relay] cloud connect failed, using in-memory bus:", e instanceof Error ? e.message : e)
    return new InMemoryBus()
  }
}

/** Run a handler at most once per (crisis, message type), so retries and duplicates are harmless. */
export function onceEach(handler: Handler): Handler {
  const seen = new Set<string>()
  return (p) => {
    const key = `${p.crisisId}:${p.type}`
    if (seen.has(key)) return
    seen.add(key)
    return handler(p)
  }
}
