import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"

const DIR = path.join(process.cwd(), ".data")
const FILE = path.join(DIR, "desk.jpg")

/** The photo the current world was built from. */
export async function GET(req: Request) {
  void new URL(req.url) // keep this route dynamic
  try {
    const buf = await readFile(FILE)
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" },
    })
  } catch {
    return new Response("no photo", { status: 404 })
  }
}

export async function POST(req: Request) {
  const buf = Buffer.from(await req.arrayBuffer())
  if (buf.length === 0) return Response.json({ ok: false, error: "empty body" }, { status: 400 })
  await mkdir(DIR, { recursive: true })
  await writeFile(FILE, buf)
  return Response.json({ ok: true })
}

export async function DELETE() {
  await rm(FILE, { force: true })
  return Response.json({ ok: true })
}
