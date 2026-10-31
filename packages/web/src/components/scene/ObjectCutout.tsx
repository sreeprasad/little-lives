"use client"

import { Billboard, Text } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { entityRect } from "@/lib/scene"
import type { Entity } from "@/lib/types"
import { lerp, phase, useReveal } from "./reveal"

export interface Cutout {
  texture: THREE.CanvasTexture
  aspect: number // height / width
}

function cropTexture(img: HTMLImageElement, box: Entity["box"]): Cutout {
  const [ymin, xmin, ymax, xmax] = box
  const sx = (xmin / 1000) * img.naturalWidth
  const sy = (ymin / 1000) * img.naturalHeight
  const sw = ((xmax - xmin) / 1000) * img.naturalWidth
  const sh = ((ymax - ymin) / 1000) * img.naturalHeight
  const scale = Math.min(1, 512 / Math.max(sw, sh))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(sw * scale))
  canvas.height = Math.max(1, Math.round(sh * scale))
  const ctx = canvas.getContext("2d")
  if (ctx) {
    ctx.beginPath()
    ctx.roundRect(0, 0, canvas.width, canvas.height, Math.min(canvas.width, canvas.height) * 0.12)
    ctx.clip()
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return { texture, aspect: canvas.height / canvas.width }
}

export function useCutouts(photoUrl: string | undefined, entities: Entity[]) {
  const [cutouts, setCutouts] = useState<Map<string, Cutout>>(new Map())
  const signature = entities.map((e) => `${e.cutoutKey}:${e.box.join(",")}`).join("|")

  useEffect(() => {
    if (!photoUrl) return
    let alive = true
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      if (!alive) return
      const next = new Map<string, Cutout>()
      for (const e of entities) {
        if (e.cutoutKey && e.blocking && e.category !== "CREATURE_SPAWN") {
          next.set(e.cutoutKey, cropTexture(img, e.box))
        }
      }
      setCutouts((prev) => {
        prev.forEach((c) => c.texture.dispose())
        return next
      })
    }
    img.src = photoUrl
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoUrl, signature])

  return cutouts
}

const LEAN = -0.12

export function ObjectCutout({ entity, cutout }: { entity: Entity; cutout: Cutout }) {
  const reveal = useReveal()
  const root = useRef<THREE.Group>(null)
  const hinge = useRef<THREE.Group>(null)
  const label = useRef<THREE.Mesh>(null)

  const r = entityRect(entity)
  const w = r.w * 0.7
  const h = Math.min(w * cutout.aspect, entity.mass === "HEAVY" ? 1.8 : 1.2)

  useFrame(() => {
    const up = phase(reveal(), 0.15, 0.6)
    // Hinged at the base: lying flat on the desk → standing up.
    if (hinge.current) hinge.current.rotation.x = lerp(-Math.PI / 2, LEAN, up)
    if (root.current) root.current.visible = up > 0.001
    if (label.current) label.current.visible = up > 0.95
  })

  return (
    <group ref={root} position={[r.cx, 0, r.cz]}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.015, 0]} scale={[w * 0.6, 0.35, 1]}>
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial color="#000" transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <Billboard lockX lockZ>
        <group ref={hinge}>
          <mesh position={[0, h / 2, 0]}>
            <planeGeometry args={[w, h]} />
            <meshStandardMaterial
              map={cutout.texture}
              emissiveMap={cutout.texture}
              emissive="#6a6a78"
              transparent
              alphaTest={0.4}
              side={THREE.DoubleSide}
              roughness={0.8}
            />
          </mesh>
        </group>
      </Billboard>

      <Billboard position={[0, h + 0.3, 0]}>
        <Text
          ref={label}
          fontSize={0.22}
          color="#d4d4d8"
          outlineWidth={0.015}
          outlineColor="#000000"
          anchorX="center"
          anchorY="middle"
        >
          {entity.mythicName}
        </Text>
      </Billboard>
       </group>
  )
}
