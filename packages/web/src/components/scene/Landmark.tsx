"use client"

import { Billboard, Text, useAnimations, useGLTF } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js"
import { entityRect } from "@/lib/scene"
import type { Entity } from "@/lib/types"
import { clamp01, phase, useReveal } from "./reveal"

export type Kind = "demon" | "dragon" | "bluedemon"

const MONSTERS: Record<Kind, { url: string; nativeHeight: number; clip: string; hover: number }> = {
  demon: { url: "/models/demon.glb", nativeHeight: 3.1, clip: "Idle", hover: 0 },
  dragon: { url: "/models/dragon.glb", nativeHeight: 3.1, clip: "Flying_Idle", hover: 0.2 },
  bluedemon: { url: "/models/bluedemon.glb", nativeHeight: 2.8, clip: "Idle", hover: -0.35 },
}

for (const m of Object.values(MONSTERS)) useGLTF.preload(m.url)

/** Role-based, so any desk works: anchor → Demon, flat → sea + Blue Demon, other props → Dragon. */
function landmarkFor(e: Entity): { monster: Kind; sea: boolean } | null {
  if (e.category === "CREATURE_SPAWN" || e.category === "OBSTACLE") return null
  if (e.category === "ANCHOR") return { monster: "demon", sea: false }
  if (!e.blocking) return { monster: "bluedemon", sea: true }
  return { monster: "dragon", sea: false }
}

// ---------- monster ----------

export function Monster({ kind, height, rise }: { kind: Kind; height: number; rise: () => number }) {
  const cfg = MONSTERS[kind]
  const { scene, animations } = useGLTF(cfg.url)
  const model = useMemo(() => {
    const c = cloneSkinned(scene)
    c.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh) {
        mesh.castShadow = true
        mesh.receiveShadow = true
      }
    })
    return c
  }, [scene])

  const group = useRef<THREE.Group>(null)
  const { actions } = useAnimations(animations, group)

  useEffect(() => {
    const action = actions[cfg.clip]
    action?.reset().fadeIn(0.3).play()
    return () => {
      action?.fadeOut(0.3)
    }
  }, [actions, cfg.clip])

  const scale = height / cfg.nativeHeight

  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    const r = rise()
    g.visible = r > 0.001
    g.scale.setScalar(Math.max(0.0001, scale * r))
    // Rises up out of the desk; the dragon also bobs.
    const bob = kind === "dragon" ? Math.sin(clock.elapsedTime * 1.5) * 0.12 : 0
    g.position.y = cfg.hover * r - (1 - r) * 0.6 + bob
  })

  return (
    <group ref={group}>
      <primitive object={model} />
    </group>
  )
}

// ---------- smoke puff when the object vanishes ----------

function SmokePuff({ size, puff }: { size: number; puff: () => number }) {
  const puffs = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        a: (i / 7) * Math.PI * 2,
        r: 0.3 + ((i * 37) % 10) / 25,
        s: 0.35 + ((i * 53) % 10) / 30,
      })),
    [],
  )
  const group = useRef<THREE.Group>(null)
  const mats = useRef<(THREE.MeshStandardMaterial | null)[]>([])

  useFrame(() => {
    const t = puff()
    const g = group.current
    if (!g) return
    g.visible = t > 0.001 && t < 0.999
    g.children.forEach((child, i) => {
      const p = puffs[i]
      const spread = size * (0.2 + t * 0.5)
      child.position.set(Math.cos(p.a) * p.r * spread, 0.2 + t * p.s * size * 0.7, Math.sin(p.a) * p.r * spread)
      child.scale.setScalar(size * p.s * (0.4 + t))
      const m = mats.current[i]
      if (m) m.opacity = 0.7 * Math.sin(Math.PI * t)
    })
  })

  return (
    <group ref={group}>
      {puffs.map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.5, 12, 10]} />
          <meshStandardMaterial
            ref={(m) => {
              mats.current[i] = m
            }}
            color="#8a8f9e"
            emissive="#3a2a5a"
            transparent
            opacity={0}
            depthWrite={false}
            roughness={1}
          />
        </mesh>
      ))}
    </group>
  )
}

// ---------- dark sea pool ----------

function Sea({ w, d, rise }: { w: number; d: number; rise: () => number }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const rings = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    const r = rise()
    const t0 = clock.elapsedTime
    if (mat.current) {
      mat.current.opacity = 0.92 * r
      mat.current.emissiveIntensity = 0.35 + Math.sin(t0 * 1.3) * 0.1
    }
    rings.current?.children.forEach((child, i) => {
      const t = (t0 * 0.35 + i / 3) % 1
      child.scale.setScalar(0.2 + t * 0.9)
      const m = (child as THREE.Mesh).material as THREE.MeshBasicMaterial
      m.opacity = (1 - t) * 0.5 * r
    })
  })

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial
          ref={mat}
          color="#06222b"
          emissive="#0e5a66"
          emissiveIntensity={0.35}
          metalness={0.5}
          roughness={0.15}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
      <group ref={rings} position={[0, 0.04, 0]} scale={[w * 0.45, 1, d * 0.45]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0.92, 1, 48]} />
            <meshBasicMaterial color="#5fd4d0" transparent opacity={0} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// ---------- root ----------

export function Landmark({ entity }: { entity: Entity }) {
  const reveal = useReveal()
  const label = useRef<THREE.Mesh>(null)
  const spec = landmarkFor(entity)
  const r = entityRect(entity)
  const height = Math.min(2.8, Math.max(1.2, Math.max(r.w, r.d) * 0.55))
  const monsterHeight = spec?.sea ? height * 0.7 : height

  // Timeline: smoke as the real object vanishes (0.05–0.5), monster rises (0.35–0.8).
  const puff = () => clamp01((reveal() - 0.05) / 0.45)
  const rise = () => phase(reveal(), 0.35, 0.8)

  useFrame(() => {
    if (label.current) label.current.visible = rise() > 0.95
  })

  if (!spec) return null

  return (
    <group position={[r.cx, 0, r.cz]}>
      <SmokePuff size={Math.max(r.w, r.d) * 0.5} puff={puff} />
      {spec.sea && <Sea w={r.w * 0.95} d={r.d * 0.95} rise={rise} />}
      <Monster kind={spec.monster} height={monsterHeight} rise={rise} />
      <Billboard position={[0, monsterHeight + 0.5, 0]}>
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
