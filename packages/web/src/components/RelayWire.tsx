"use client"

import { useEffect, useState } from "react"

import type { RelayPacket, WorldSnapshot } from "@/lib/types"

const STYLE: Record<string, { icon: string; color: string }> = {
  ghost: { icon: "👻", color: "text-indigo-300" },
  skeleton: { icon: "💀", color: "text-amber-200" },
  zombie: { icon: "🧟", color: "text-lime-300" },
  world: { icon: "🌍", color: "text-zinc-400" },
}

const STATUS_COLOR: Record<string, string> = {
  NONE: "bg-zinc-700",
  BLOCKED: "bg-red-700",
  ASSESSING: "bg-indigo-700",
  RIGGING: "bg-amber-700",
  ANCHORED: "bg-lime-800",
  PULLING: "bg-orange-600",
  CLEARED: "bg-emerald-600",
}

function summary(p: RelayPacket): string {
  const x = (p.payload ?? {}) as Record<string, unknown>
  switch (p.type) {
    case "OBSTACLE_ASSESSMENT": {
      const cells = Array.isArray(x.cells) ? x.cells.length : 0
      return `${String(x.mass ?? "?").toLowerCase()} obstacle across ${cells} cells`
    }
    case "ANCHOR_REQUEST": {
      const c = x.anchorCell as { x: number; y: number } | undefined
      return `need force ${x.requiredForce} · anchor at ${c ? `(${c.x},${c.y})` : "?"}`
    }
    case "ANCHOR_GRANTED":
      return `bracing with force ${x.braceForce}`
    default:
      return JSON.stringify(p.payload)
  }
}

function time(at: number) {
  return new Date(at).toLocaleTimeString([], { hour12: false, minute: "2-digit", second: "2-digit" })
}

export function RelayWire({ snapshot }: { snapshot: WorldSnapshot | null }) {
  const log = snapshot?.relayLog ?? []
  const status = snapshot?.crisis.status ?? "NONE"

  return (
    <aside className="pointer-events-none absolute right-4 top-4 w-80 rounded-lg border border-zinc-800 bg-zinc-950/85 p-3 font-mono text-xs text-zinc-300 shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-zinc-400">Agent Relay · live wire</span>
        <span className={`rounded px-1.5 py-0.5 text-[10px] text-white transition-colors ${STATUS_COLOR[status] ?? "bg-zinc-700"}`}>
          {status}
        </span>
      </div>

      {log.length === 0 ? (
        <div className="py-4 text-center text-zinc-600">waiting for the creatures to talk…</div>
      ) : (
        <ol className="space-y-2">
          {log.slice(-6).map((p, i) => {
            const from = STYLE[p.from] ?? STYLE.world!
            const to = STYLE[p.to] ?? STYLE.world!
            return (
              <li key={`${p.at}-${i}`} className="rounded bg-zinc-900/80 p-2">
                <div className="flex items-center justify-between">
                  <span>
                    <span className={from.color}>
                      {from.icon} {p.from}
                    </span>
                    <span className="text-zinc-500"> → </span>
                    <span className={to.color}>
                      {to.icon} {p.to}
                    </span>
                  </span>
                  <span className="text-[10px] text-zinc-600">{time(p.at)}</span>
                </div>
                <div className="mt-1 text-[11px] font-semibold tracking-wide text-zinc-200">{p.type}</div>
                <div className="text-[11px] text-zinc-400">{summary(p)}</div>
              </li>
            )
          })}
        </ol>
      )}
    </aside>
  )
}
  function name(role: string) {
    return role.charAt(0).toUpperCase() + role.slice(1)
  }

  /** Big bottom-centre caption for the latest Relay message. */
  export function RelayBanner({ snapshot }: { snapshot: WorldSnapshot | null }) {
    const log = snapshot?.relayLog ?? []
    const latest = log[log.length - 1]
    const [now, setNow] = useState(0)

    useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 250)
      return () => clearInterval(id)
    }, [])

    if (!latest || now === 0 || now - latest.at > 4500) return null
    const from = STYLE[latest.from] ?? STYLE.world!
    const to = STYLE[latest.to] ?? STYLE.world!

    return (
      <div className="pointer-events-none absolute bottom-12 left-1/2 -translate-x-1/2 rounded-xl border border-amber-500/40 bg-zinc-950/90 px-6 py-3 text-center font-mono shadow-2xl">
        <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Agent Relay message</div>
        <div className="mt-1 text-lg">
          <span className={from.color}>
            {from.icon} {name(latest.from)}
          </span>
          <span className="text-zinc-500"> → </span>
          <span className={to.color}>
            {to.icon} {name(latest.to)}
          </span>
        </div>
        <div className="mt-1 text-xl font-semibold tracking-wide text-white">{latest.type.replace(/_/g, " ")}</div>
        <div className="text-sm text-zinc-300">{summary(latest)}</div>
      </div>
    )
  }
