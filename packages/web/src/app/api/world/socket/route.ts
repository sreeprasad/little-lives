import { actors, WORLD_ID } from "@/lib/actors-server"


export async function POST() {
  const grant = await actors.WorldActor.prepareWebsocket({
    actorId: WORLD_ID,
    metadata: { role: "viewer" },
  })
  return Response.json(grant, { headers: { "Cache-Control": "no-store" } })
}
