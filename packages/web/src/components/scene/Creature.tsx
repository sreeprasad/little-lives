"use client"

import { Html, useAnimations, useGLTF } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js"
import { cellToWorld } from "@/lib/scene"
import type { Creature as CreatureData, Role } from "@/lib/types"
import { phase, useReveal } from "./reveal"

type State = CreatureData["state"]

interface ModelConfig {
  url: string
  scale: number
  hover: number
  speechY: number
  clips: Record<State, string>
}

const MODELS: Record<Role, ModelConfig> = {
  ghost: {
    url: "/models/ghost.glb",
    scale: 0.3,
    hover: 0.25,
    speechY: 1.7,
    clips: { IDLE: "Flying_Idle", WALKING: "Fast_Flying", BLOCKED: "No", WORKING: "Flying_Idle", CELEBRATING: "Yes" },
  },
  skeleton: {
    url: "/models/skeleton.glb",
    scale: 0.3,
    hover: 0,
    speechY: 1.5,
    clips: { IDLE: "Idle", WALKING: "Walk", BLOCKED: "Idle", WORKING: "Punch", CELEBRATING: "Wave" },
  },
  zombie: {
    url: "/models/zombie.glb",
    scale: 0.36,
    hover: 0,
    speechY: 1.7,
    clips: { IDLE: "Idle", WALKING: "Walk", BLOCKED: "Idle", WORKING: "Duck", CELEBRATING: "Yes" },
  },
}

/** Live scene objects for each creature, so effects (bone-chain) can follow them. */
export const creatureObjects = new Map<Role, THREE.Object3D>()

for (const m of Object.values(MODELS)) useGLTF.preload(m.url)

function lerpAngle(a: number, b: number, t: number) {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

export function Creature({ creature }: { creature: CreatureData }) {
  const cfg = MODELS[creature.role]
  const { scene, animations } = useGLTF(cfg.url)
  const reveal = useReveal()

  const model = useMemo(() => {
    const c = cloneSkinned(scene)
    c.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      if (creature.role === "ghost") {
        const mat = (mesh.material as THREE.MeshStandardMaterial).clone()
        mat.emissive = new THREE.Color("#7f8cff")
        mat.emissiveIntensity = 0.9
        mat.transparent = true
        mat.opacity = 0.85
        mesh.material = mat
        mesh.castShadow = false
      }
    })
    return c
  }, [scene, creature.role])

  const group = useRef<THREE.Group | null>(null)
  const body = useRef<THREE.Group>(null)
  const speech = useRef<HTMLDivElement>(null)
  const placed = useRef(false)
  const { actions } = useAnimations(animations, body)

  useEffect(() => {
    const action = actions[cfg.clips[creature.state]]
    if (!action) return
    action.reset().fadeIn(0.25).play()
    return () => {
      action.fadeOut(0.25)
    }
  }, [creature.state, actions, cfg])

  const [tx, , tz] = cellToWorld(creature.cell)

  useFrame((state, dt) => {
    const g = group.current
    const b = body.current
    if (!g || !b) return
    if (!placed.current) {
      g.position.set(tx, 0, tz)
      placed.current = true
    }

    const dx = tx - g.position.x
    const dz = tz - g.position.z
    const k = 1 - Math.exp(-dt * 7)
    g.position.x += dx * k
    g.position.z += dz * k
    if (dx * dx + dz * dz > 1e-4) {
      g.rotation.y = lerpAngle(g.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-dt * 10))
    }

    const t = state.clock.elapsedTime
    const bounce = creature.state === "CELEBRATING" ? Math.abs(Math.sin(t * 8)) * 0.3 : 0
    b.position.y = (creature.role === "ghost" ? cfg.hover + Math.sin(t * 2) * 0.08 : cfg.hover) + bounce

    // Monsters materialise at the end of the reveal.
    const appear = phase(reveal(), 0.55, 0.95)
    g.scale.setScalar(Math.max(0.0001, appear))
    if (speech.current) speech.current.style.opacity = appear > 0.95 ? "1" : "0"
  })

  return (
    <group
      ref={(g) => {
        group.current = g
        if (g) creatureObjects.set(creature.role, g)
        else creatureObjects.delete(creature.role)
      }}
    >
      <group ref={body} scale={cfg.scale}>
        <primitive object={model} />
      </group>
      {creature.speech && (
        <Html position={[0, cfg.speechY, 0]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
          <div
            ref={speech}
            className="max-w-48 rounded-lg border border-amber-500/40 bg-zinc-950/85 px-2 py-1 text-center font-serif text-xs italic text-amber-200 shadow-lg transition-opacity duration-500"
          >
            {creature.speech}
          </div>
        </Html>
      )}
    </group>
  )
}
