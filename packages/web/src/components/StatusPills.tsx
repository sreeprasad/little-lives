"use client"

import { useEffect, useState } from "react"

type Tone = "ok" | "warn" | "bad"

const TONE: Record<Tone, string> = {
  ok: "border-emerald-500/50 text-emerald-300",
  warn: "border-amber-500/50 text-amber-300",
  bad: "border-red-500/50 text-red-300",
}

const DOT: Record<Tone, string> = { ok: "bg-emerald-400", warn: "bg-amber-400", bad: "bg-red-400" }

function Pill({ tone, label, value }: { tone: Tone; label: string; value: string }) {
  return (
    <span className={`flex items-center gap-1.5 rounded-full border bg-zinc-950/80 px-2.5 py-1 ${TONE[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />
      <span className="text-zinc-500">{label}</span>
      <span>{value}</span>
    </span>
  )
}

interface Status {
  world: "terse-cloud" | "local"
  agents: string | null
}

export type VisionMode = "none" | "live" | "fallback"

export function StatusPills({
  socket,
  camera,
  vision,
}: {
  socket: string
  camera: string
  vision: VisionMode
}) {
  const [status, setStatus] = useState<Status | null>(null)

  useEffect(() => {
    let alive = true
    const poll = async () => {
      try {
        const res = await fetch("/api/status", { cache: "no-store" })
        const json = (await res.json()) as Status
        if (alive) setStatus(json)
      } catch {
        if (alive) setStatus(null)
      }
    }
    void poll()
    const id = setInterval(poll, 5000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  const worldTone: Tone = socket !== "open" ? "bad" : status?.world === "terse-cloud" ? "ok" : "warn"
  const worldValue = socket !== "open" ? "offline" : status?.world === "terse-cloud" ? "Terse Cloud" : "local"

  const agentsTone: Tone = !status?.agents ? "bad" : status.agents === "cloud" ? "ok" : "warn"
  const agentsValue = !status?.agents ? "offline" : status.agents === "cloud" ? "Agent Relay Cloud" : "in-memory"

  const visionTone: Tone = vision === "live" ? "ok" : vision === "fallback" ? "warn" : "warn"
  const visionValue = vision === "live" ? "Gemini live" : vision === "fallback" ? "sample (fallback)" : "not scanned"

  const cameraTone: Tone = camera === "live" ? "ok" : camera === "error" || camera === "denied" ? "bad" : "warn"
  const cameraValue = camera === "live" ? "iPhone" : camera === "idle" ? "off" : camera

  return (
    <div className="flex flex-wrap gap-2 font-mono text-[11px]">
      <Pill tone={worldTone} label="World" value={worldValue} />
      <Pill tone={agentsTone} label="Agents" value={agentsValue} />
      <Pill tone={visionTone} label="Vision" value={visionValue} />
      <Pill tone={cameraTone} label="Camera" value={cameraValue} />
    </div>
  )
}
