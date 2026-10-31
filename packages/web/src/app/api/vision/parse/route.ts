import { parseDesk } from "@/lib/vision"

export async function POST(req: Request) {
  const bytes = Buffer.from(await req.arrayBuffer())
  if (bytes.length === 0) {
    return Response.json({ ok: false, error: "empty body" }, { status: 400 })
  }
  const mime = req.headers.get("content-type") ?? "image/jpeg"
  const result = await parseDesk(bytes.toString("base64"), mime)
  return Response.json({ ok: true, ...result })
}
