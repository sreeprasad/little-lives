"use client"

import { useState } from "react"
import { useWorldSocket } from "@/hooks/useWorldSocket"
import type { Creature, Entity } from "@/lib/types"

const CREATURE_ICON: Record<Creature["role"], string> = {
  ghost: "👻",
  skeleton: "💀",
  zombie: "🧟",
}

const CATEGORY_COLOR: Record<Entity["category"], string> = {
  CREATURE_SPAWN: "bg-emerald-900/40",
  ANCHOR: "bg-purple-700",
  OBSTACLE: "bg-amber-700",
  PROP: "bg-zinc-600",
}

async function post(body: object) {
  const res = await fetch("/api/world/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!json.ok) alert(json.error)
}

export default function DebugPage() {
  const { snapshot, status } = useWorldSocket()
  const [showJson, setShowJson] = useState(false)

  const entityAt = new Map<string, Entity>()
  for (const e of snapshot?.entities ?? []) {
    for (const c of e.cells) entityAt.set(`${c.x},${c.y}`, e)
  }
  const creatureAt = new Map<string, Creature>()
  const pathCells = new Set<string>()
  for (const c of snapshot?.creatures ?? []) {
    creatureAt.set(`${c.cell.x},${c.cell.y}`, c)
    if (c.role === "ghost") for (const p of c.path) pathCells.add(`${p.x},${p.y}`)
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-6 font-mono text-sm text-zinc-200">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span
          className={`rounded px-2 py-1 ${
            status === "open" ? "bg-emerald-700" : status === "connecting" ? "bg-amber-700" : "bg-red-700"
          }`}
        >
          socket: {status}
        </span>
        <span>v{snapshot?.version ?? "—"}</span>
        <span>crisis: {snapshot?.crisis.status ?? "—"}</span>
        <button className="rounded bg-zinc-800 px-3 py-1 hover:bg-zinc-700" onClick={() => post({ action: "scan" })}>
          Load mock
        </button>
        <button className="rounded bg-zinc-800 px-3 py-1 hover:bg-zinc-700" onClick={() => post({ action: "drop" })}>
          Drop coffin
        </button>
        <button className="rounded bg-zinc-800 px-3 py-1 hover:bg-zinc-700" onClick={() => post({ action: "reset" })}>
          Reset
        </button>
        <button className="rounded bg-zinc-800 px-3 py-1 hover:bg-zinc-700" onClick={() => setShowJson((v) => !v)}>
          {showJson ? "Hide" : "Show"} JSON
        </button>
      </div>

      <div className="flex flex-wrap gap-8">
        <div className="grid w-fit grid-cols-12 gap-px bg-zinc-800 p-px">
          {Array.from({ length: 144 }, (_, i) => {
            const x = i % 12
            const y = Math.floor(i / 12)
            const key = `${x},${y}`
            const entity = entityAt.get(key)
            const creature = creatureAt.get(key)
            const blocked = snapshot?.grid[y]?.[x]?.blocked
            const bg = entity
              ? CATEGORY_COLOR[entity.category]
              : pathCells.has(key)
                ? "bg-sky-950"
                : "bg-zinc-900"
            return (
              <div
                key={key}
                title={entity ? `${entity.mythicName} (${entity.label})` : key}
                className={`flex h-9 w-9 items-center justify-center text-lg ${bg} ${
                  blocked ? "outline outline-1 -outline-offset-1 outline-red-500/60" : ""
                }`}
              >
                {creature ? CREATURE_ICON[creature.role] : ""}
              </div>
            )
          })}
        </div>

        <div className="min-w-64 space-y-2">
          {(snapshot?.creatures ?? []).map((c) => (
            <div key={c.role} className="rounded bg-zinc-900 p-2">
              <div>
                {CREATURE_ICON[c.role]} {c.role} — {c.state} @ ({c.cell.x},{c.cell.y})
              </div>
              {c.speech && <div className="text-amber-300">“{c.speech}”</div>}
            </div>
          ))}
        </div>
      </div>

      {showJson && (
        <pre className="mt-6 max-h-[50vh] overflow-auto rounded bg-zinc-900 p-3 text-xs">
          {JSON.stringify(snapshot, null, 2)}
        </pre>
      )}
    </main>
  )
}
