import { readFileSync } from "node:fs"
import { parseDesk } from "../src/lib/vision"

const path = process.argv[2] ?? "public/samples/desk.jpg"
const base64 = readFileSync(path).toString("base64")
const result = await parseDesk(base64)

console.log(`\n${path}  ·  ${result.ms}ms  ·  fallback: ${result.fallback}${result.error ? `  ·  ${result.error}` : ""}\n`)
console.table(
  result.entities.map((e) => ({
    label: e.label,
    category: e.category,
    mass: e.mass,
    blocking: e.blocking,
    box: e.box.join(","),
    name: e.mythicName,
  })),
)
