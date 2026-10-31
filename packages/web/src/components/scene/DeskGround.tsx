"use client"

import { useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { DESK_D, DESK_W, GRID } from "@/lib/scene"
import type { Entity } from "@/lib/types"
import { phase, useReveal } from "./reveal"

function erasable(e: Entity) {
  return e.category !== "OBSTACLE" && !!e.cutoutKey
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

function overlaps(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function averageColor(ctx: CanvasRenderingContext2D, r: Rect) {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  const x = Math.max(0, Math.round(r.x))
  const y = Math.max(0, Math.round(r.y))
  const w = Math.min(W - x, Math.round(r.w))
  const h = Math.min(H - y, Math.round(r.h))
  if (w <= 0 || h <= 0) return "rgb(90,70,55)"
  const data = ctx.getImageData(x, y, w, h).data
  let rr = 0
  let gg = 0
  let bb = 0
  let n = 0
  for (let i = 0; i < data.length; i += 16) {
    rr += data[i]
    gg += data[i + 1]
    bb += data[i + 2]
    n++
  }
  return `rgb(${(rr / n) | 0},${(gg / n) | 0},${(bb / n) | 0})`
}

/** Find a same-size patch of clean desk next to `r` that avoids every object. */
function findCleanPatch(r: Rect, occupied: Rect[], W: number, H: number, gap: number): Rect | null {
  const offsets = [
    [-(r.w + gap), 0], // left  (wood grain runs sideways, so try these first)
    [r.w + gap, 0], // right
    [-(r.w + gap) * 2, 0],
    [(r.w + gap) * 2, 0],
    [0, -(r.h + gap)], // up
    [0, r.h + gap], // down
    [-(r.w + gap), -(r.h + gap)],
    [r.w + gap, r.h + gap],
    [-(r.w + gap), r.h + gap],
    [r.w + gap, -(r.h + gap)],
  ]
  for (const [dx, dy] of offsets) {
    const c = { x: r.x + dx, y: r.y + dy, w: r.w, h: r.h }
    if (c.x < 0 || c.y < 0 || c.x + c.w > W || c.y + c.h > H) continue
    if (occupied.some((o) => overlaps(c, o))) continue
    return c
  }
  return null
}

interface PhotoTextures {
  raw: THREE.Texture
  clean: THREE.CanvasTexture
}

/** The untouched photo, plus a copy with every object painted out using nearby desk. */
function usePhotoTextures(photoUrl: string | undefined, entities: Entity[]) {
  const [textures, setTextures] = useState<PhotoTextures | null>(null)
  const signature = entities.map((e) => `${e.category}:${e.box.join(",")}`).join("|")


  useEffect(() => {
    if (!photoUrl) {
      setTextures(null)
      return
    }
    let alive = true
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onerror = () => {
      if (alive) setTextures(null) // no stored photo yet → plain wooden desk
    }
    img.onload = () => {
      if (!alive) return
      const raw = new THREE.Texture(img)
      raw.colorSpace = THREE.SRGBColorSpace
      raw.needsUpdate = true

      const scale = Math.min(1, 2048 / Math.max(img.naturalWidth, img.naturalHeight))
      const W = Math.round(img.naturalWidth * scale)
      const H = Math.round(img.naturalHeight * scale)

      // Untouched copy to clone from, so patches never pick up earlier edits.
      const source = document.createElement("canvas")
      source.width = W
      source.height = H
      const sctx = source.getContext("2d", { willReadFrequently: true })
      const canvas = document.createElement("canvas")
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext("2d", { willReadFrequently: true })
      if (!sctx || !ctx) return
      sctx.drawImage(img, 0, 0, W, H)
      ctx.drawImage(source, 0, 0)

      const toRect = (e: Entity, pad: number): Rect => {
        const [ymin, xmin, ymax, xmax] = e.box
        const x = (xmin / 1000) * W
        const y = (ymin / 1000) * H
        return {
          x: x - pad,
          y: y - pad,
          w: ((xmax - xmin) / 1000) * W + pad * 2,
          h: ((ymax - ymin) / 1000) * H + pad * 2,
        }
      }

      // Every object (including ones we keep) counts as "not clean desk".
      const occupied = entities.map((e) => toRect(e, 6))

      for (const e of entities.filter(erasable)) {
        const base = toRect(e, 0)
        const pad = Math.max(10, Math.min(base.w, base.h) * 0.1)
        const r = toRect(e, pad)
        const patch = findCleanPatch(r, occupied, W, H, pad)

        if (patch) {
          ctx.drawImage(source, patch.x, patch.y, patch.w, patch.h, r.x, r.y, r.w, r.h)
        } else {
          ctx.fillStyle = averageColor(sctx, { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 })
          ctx.fillRect(r.x, r.y, r.w, r.h)
        }

        // Feather only a thin band around the edge, so the grain inside stays sharp.
        const band = pad
        ctx.save()
        ctx.beginPath()
        ctx.rect(r.x - band, r.y - band, r.w + band * 2, r.h + band * 2)
        ctx.rect(r.x + band, r.y + band, r.w - band * 2, r.h - band * 2)
        ctx.clip("evenodd")
        ctx.filter = `blur(${Math.round(band * 0.8)}px)`
        ctx.drawImage(canvas, 0, 0)
        ctx.restore()
      }

      const clean = new THREE.CanvasTexture(canvas)
      clean.colorSpace = THREE.SRGBColorSpace
      setTextures((prev) => {
        prev?.raw.dispose()
        prev?.clean.dispose()
        return { raw, clean }
      })
    }
    img.src = photoUrl
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoUrl, signature])

  return textures
}

export function DeskGround({
  showGrid = true,
  photoUrl,
  entities = [],
}: {
  showGrid?: boolean
  photoUrl?: string
  entities?: Entity[]
}) {
  const tex = usePhotoTextures(photoUrl, entities)
  const reveal = useReveal()
  const cleanMat = useRef<THREE.MeshStandardMaterial>(null)
  const rawMat = useRef<THREE.MeshBasicMaterial>(null)
  const day = useMemo(() => new THREE.Color("#ffffff"), [])
  const night = useMemo(() => new THREE.Color("#9aa0b8"), [])

  useFrame(() => {
    const p = reveal()
    cleanMat.current?.color.lerpColors(day, night, phase(p, 0, 0.6))
    if (rawMat.current) rawMat.current.opacity = 1 - phase(p, 0.05, 0.45)
  })

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[DESK_W, DESK_D]} />
        {tex ? (
          <meshStandardMaterial key="photo" ref={cleanMat} map={tex.clean} color="#9aa0b8" roughness={0.95} />
        ) : (
          <meshStandardMaterial key="wood" color="#2b1d14" roughness={0.9} />
        )}
      </mesh>
      {tex && (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.004, 0]} renderOrder={1}>
          <planeGeometry args={[DESK_W, DESK_D]} />
          <meshBasicMaterial ref={rawMat} map={tex.raw} transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      {showGrid && (
        <gridHelper
          args={[GRID, GRID, "#5a4636", "#3a2c22"]}
          position={[0, 0.005, 0]}
          scale={[DESK_W / GRID, 1, DESK_D / GRID]}
        />
      )}
    </group>
  )
}
