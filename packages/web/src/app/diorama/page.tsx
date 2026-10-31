"use client"

import { useEffect, useRef, useState } from "react"
import { Diorama } from "@/components/Diorama"
import { RelayBanner, RelayWire } from "@/components/RelayWire"
import { useDeskCamera } from "@/hooks/useDeskCamera"
import { useWorldSocket } from "@/hooks/useWorldSocket"
import { SAMPLE_COFFIN, SAMPLE_ENTITIES, SAMPLE_PHOTO } from "@/lib/sample-world"
import type { Crisis, Entity } from "@/lib/types"
import { StatusPills, type VisionMode } from "@/components/StatusPills"

const STORED_PHOTO = "/api/world/photo"

interface WorldResponse {
  ok: boolean
  error?: string
  crisis?: Crisis
}

async function worldAction(body: object): Promise<WorldResponse> {
  const res = await fetch("/api/world/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as WorldResponse
  if (!json.ok) console.error(json.error)
  return json
}

/** Save the photo the world was built from, so a reload restores the same scene. */
async function storePhoto(blob: Blob) {
  await fetch(STORED_PHOTO, { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob })
}

async function clearPhoto() {
  await fetch(STORED_PHOTO, { method: "DELETE" })
}

interface VisionResponse {
  ok: boolean
  entities: Entity[]
  fallback: boolean
  ms: number
  error?: string
}

export default function DioramaPage() {
  const { snapshot, status } = useWorldSocket()
  const camera = useDeskCamera()
  const [showGrid, setShowGrid] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [tiltShift, setTiltShift] = useState(true)
  const [revealStart, setRevealStart] = useState<number | null>(null)
  // Start from whatever photo the persisted world was built from.
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(STORED_PHOTO)
  const [scanMsg, setScanMsg] = useState("")
  const [vision, setVision] = useState<VisionMode>("none")
  const scanning = useRef(false)

  function showPhoto(url: string | undefined) {
    setPhotoUrl((prev) => {
      if (prev?.startsWith("blob:") && prev !== url) URL.revokeObjectURL(prev)
      return url
    })
  }

  async function loadSampleDesk() {
    setVision("fallback")
    await worldAction({ action: "scan", entities: SAMPLE_ENTITIES })
    showPhoto(SAMPLE_PHOTO)
    setRevealStart(performance.now())
    const blob = await fetch(SAMPLE_PHOTO).then((r) => r.blob())
    await storePhoto(blob)
  }

  async function resetWorld() {
    setVision("none")
    await worldAction({ action: "reset" })
    await clearPhoto()
    showPhoto(undefined)
    setScanMsg("")
  }

  async function scanFromCamera() {
    if (scanning.current) return
    scanning.current = true
    try {
      const shot = await camera.capture()
      if (!shot) {
        setScanMsg("camera not ready — reselect the iPhone")
        return
      }
      setScanMsg("reading desk…")
      const res = await fetch("/api/vision/parse", {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: shot.blob,
      })
      const json = (await res.json()) as VisionResponse
      if (!json.ok) {
        setScanMsg("vision failed")
        URL.revokeObjectURL(shot.photoUrl)
        return
      }

      const current = snapshot?.entities ?? []
      const worldLoaded = current.some((e) => e.category !== "OBSTACLE")
      const coffinOnDesk = current.some((e) => e.category === "OBSTACLE")
      const newObstacle = json.entities.find((e) => e.category === "OBSTACLE")

      // A world exists and a long thin object appeared: drop it in as the coffin.
      if (!json.fallback && worldLoaded && newObstacle) {
        URL.revokeObjectURL(shot.photoUrl) // keep the pen-free ground photo
        if (coffinOnDesk) {
          setScanMsg("a coffin is already on the desk")
          return
        }
        const result = await worldAction({ action: "drop", entity: newObstacle })
        setScanMsg(
          result.crisis && result.crisis.status !== "NONE"
            ? `⚰️ ${newObstacle.label} dropped as "${newObstacle.mythicName}" · ${json.ms}ms`
            : `${newObstacle.label} isn't across the ghost's route — lay it across the middle and press c`,
        )
        return
      }

      // Otherwise build a fresh world from this scan.
      await worldAction({ action: "scan", entities: json.entities })
      if (json.fallback) {
        URL.revokeObjectURL(shot.photoUrl)
        showPhoto(SAMPLE_PHOTO)
        await storePhoto(await fetch(SAMPLE_PHOTO).then((r) => r.blob()))
      } else {
        await storePhoto(await fetch(shot.photoUrl).then((r) => r.blob()))
        showPhoto(shot.photoUrl)
      }
      setVision(json.fallback ? "fallback" : "live")
      setRevealStart(performance.now())
      setScanMsg(
        `${json.fallback ? "FALLBACK (sample)" : "live"} · ${json.entities.length} objects · ${json.ms}ms${json.error ? ` · ${json.error}` : ""}`,
      )
    } finally {
      scanning.current = false
    }
  }

  // Keyboard handler is registered once; route through a ref so it sees fresh state.
  const actions = useRef({ scanFromCamera, loadSampleDesk, resetWorld })
  actions.current = { scanFromCamera, loadSampleDesk, resetWorld }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (e.key === "1") void actions.current.loadSampleDesk()
      if (e.key === "2") void worldAction({ action: "drop", entity: SAMPLE_COFFIN })
      if (e.key === "4") void actions.current.resetWorld()
      if (e.key === "5") setRevealStart(performance.now())
      if (e.key === "c") void actions.current.scanFromCamera()
      if (e.key === "g") setShowGrid((v) => !v)
      if (e.key === "p") setShowStats((v) => !v)
      if (e.key === "t") setTiltShift((v) => !v)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const empty = (snapshot?.entities.length ?? 0) === 0

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black">
      <Diorama
        snapshot={snapshot}
        showGrid={showGrid}
        showStats={showStats}
        photoUrl={photoUrl}
        revealStart={revealStart}
        tiltShift={tiltShift}
      />
      <RelayWire snapshot={snapshot} />
      <RelayBanner snapshot={snapshot} />

      {empty && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <h1 className="font-serif text-6xl tracking-[0.3em] text-amber-200/90 drop-shadow-[0_0_25px_rgba(255,140,40,0.45)]">
            LITTLE LIVES
          </h1>
          <p className="mt-4 animate-pulse font-mono text-sm tracking-widest text-zinc-300">
            place your objects on the desk, then press <span className="text-amber-300">c</span>
          </p>
        </div>
      )}

            <div className="pointer-events-none absolute left-4 top-4 space-y-2 font-mono text-xs text-zinc-300">
        <StatusPills socket={status} camera={camera.status} vision={vision} />
        <div className="text-zinc-500">
          c scan camera · 1 sample desk · 2 drop coffin · 4 reset · 5 replay · g grid · p fps · t blur
        </div>
      </div>
      {/* Camera panel */}
      <div className="absolute bottom-4 right-4 w-72 space-y-2 rounded-lg bg-zinc-950/85 p-2 font-mono text-xs text-zinc-300 shadow-xl">
        <video
          ref={camera.videoRef}
          muted
          playsInline
          className={`aspect-video w-full rounded bg-black object-contain ${camera.status === "live" ? "" : "hidden"}`}
        />
        {camera.status !== "live" && (
          <button
            className="w-full rounded bg-zinc-800 px-2 py-1.5 hover:bg-zinc-700"
            onClick={() => void camera.start()}
          >
            {camera.status === "asking" ? "Waiting for permission…" : "Enable camera"}
          </button>
        )}
        {camera.devices.length > 0 && (
          <select
            className="w-full rounded bg-zinc-800 px-1 py-1"
            value={camera.deviceId ?? ""}
            onChange={(e) => camera.setDeviceId(e.target.value)}
          >
            {camera.devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || "Camera"}
              </option>
            ))}
          </select>
        )}
        {camera.status === "live" && (
          <button
            className="w-full rounded bg-emerald-800 px-2 py-1.5 hover:bg-emerald-700"
            onClick={() => void scanFromCamera()}
          >
            Scan desk (c)
          </button>
        )}
        {camera.error && <div className="text-red-400">{camera.error}</div>}
        {scanMsg && <div className="text-zinc-400">{scanMsg}</div>}
      </div>
    </main>
  )
}
