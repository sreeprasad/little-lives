// Latest heartbeat from the creature agents (kept in this server process).
let agents: { mode: string; at: number } | null = null

/** Which backends the demo is running on. */
export async function GET(req: Request) {
  void new URL(req.url) // keep this route dynamic
  const fresh = agents && Date.now() - agents.at < 15_000
  return Response.json({
    world: process.env.TERSE_ACTOR_URL ? "terse-cloud" : "local",
    agents: fresh ? agents?.mode : null,
  })
}

/** Agents call this every few seconds with their relay mode. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { mode?: string }
  agents = { mode: String(body.mode ?? "unknown"), at: Date.now() }
  return Response.json({ ok: true })
}
