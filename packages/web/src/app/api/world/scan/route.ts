import { worldActor } from "@/lib/actors-server"
import { MOCK_COFFIN, MOCK_ENTITIES } from "@/lib/mock-world"
import type { Entity } from "@/lib/types"


type Body =
  | { action?: "scan"; entities?: Entity[] }
  | { action: "drop"; entity?: Entity }
  | { action: "reset" }

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body
  const world = worldActor()

  try {
    switch (body.action) {
      case "drop": {
        const crisis = await world.dropObstacle(body.entity ?? MOCK_COFFIN)
        return Response.json({ ok: true, crisis })
      }
      case "reset": {
        const snapshot = await world.reset()
        return Response.json({ ok: true, snapshot })
      }
      default: {
        const entities = body.entities?.length ? body.entities : MOCK_ENTITIES
        const snapshot = await world.applyScan(entities)
        return Response.json({ ok: true, snapshot })
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
