"use client"

import { useFrame } from "@react-three/fiber"
import { useRef } from "react"
import type * as THREE from "three"
import { type Kind, Monster } from "./Landmark"

interface WalkerProps {
  kind: Kind
  height: number
  radius: number
  speed: number
  phase: number
}

/** A monster prowling an oval loop around the empty desk. */
function Walker({ kind, height, radius, speed, phase }: WalkerProps) {
  const group = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    const t = clock.elapsedTime * speed + phase
    const rx = radius * 1.3
    const rz = radius * 0.8
    g.position.set(Math.cos(t) * rx, 0, Math.sin(t) * rz)
    // Face along the direction of travel.
    const dx = -Math.sin(t) * rx * speed
    const dz = Math.cos(t) * rz * speed
    g.rotation.y = Math.atan2(dx, dz)
  })

  return (
    <group ref={group}>
      <Monster kind={kind} height={height} rise={() => 1} />
    </group>
  )
}

/** Shown before any desk is scanned. */
export function IdleScene() {
  return (
    <>
      <Walker kind="demon" height={1.9} radius={3.4} speed={0.16} phase={0} />
      <Walker kind="dragon" height={1.6} radius={4.4} speed={-0.11} phase={2.2} />
      <Walker kind="demon" height={1.2} radius={2.1} speed={0.24} phase={4.1} />
    </>
  )
}
