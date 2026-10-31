"use client"

import { Billboard, QuadraticBezierLine, Text } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { type ComponentRef, type ReactNode, useMemo, useRef } from "react"
import * as THREE from "three"
import { entityRect } from "@/lib/scene"
import type { Crisis, Entity } from "@/lib/types"
import { creatureObjects } from "./Creature"

/** Shared between effects: where the coffin is right now / was last seen. */
const fx = { lastCoffinPos: new THREE.Vector3() }

/** Remembers when the crisis entered its current status. */
function useStatusSince(status: Crisis["status"]) {
  const since = useRef({ status, t: performance.now() })
  if (since.current.status !== status) since.current = { status, t: performance.now() }
  return since
}

// ---------- coffin (dragged during PULLING) ----------

export function Coffin({ entity, crisis }: { entity: Entity; crisis: Crisis }) {
  const r = entityRect(entity)
  const group = useRef<THREE.Group>(null)
  const since = useStatusSince(crisis.status)
  const pulling = crisis.status === "PULLING" && crisis.obstacleId === entity.id
  const dir = useMemo(() => new THREE.Vector3(), [])
  const h = 0.35

  useFrame(() => {
    const g = group.current
    if (!g) return
    if (!pulling) {
      g.position.set(r.cx, 0, r.cz)
      g.rotation.set(0, 0, 0)
    } else {
      const now = performance.now()
      const t = Math.min(1, (now - since.current.t) / 3000)
      const sk = creatureObjects.get("skeleton")
      dir.set(sk ? sk.position.x - r.cx : 0, 0, sk ? sk.position.z - r.cz : 1).normalize()
      const dist = t * t * 1.2
      const shake = Math.sin(now * 0.06) * 0.04
      g.position.set(r.cx + dir.x * dist + shake, 0, r.cz + dir.z * dist)
      g.rotation.z = Math.sin(now * 0.03) * 0.05
      g.rotation.x = -t * 0.25
    }
    fx.lastCoffinPos.copy(g.position)
  })

  const cross = Math.min(r.w, r.d) * 0.12
  return (
    <group ref={group} position={[r.cx, 0, r.cz]}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[r.w * 0.9, h, r.d * 0.9]} />
        <meshStandardMaterial color="#3b2416" roughness={0.7} />
      </mesh>
      <mesh position={[0, h + 0.02, 0]} castShadow>
        <boxGeometry args={[r.w * 0.94, 0.05, r.d * 0.94]} />
        <meshStandardMaterial color="#5a3820" roughness={0.6} />
      </mesh>
      <mesh position={[0, h + 0.055, 0]}>
        <boxGeometry args={[r.w * 0.35, 0.02, cross]} />
        <meshStandardMaterial color="#c9a64a" metalness={0.8} roughness={0.3} emissive="#3a2a08" />
      </mesh>
      <mesh position={[-r.w * 0.08, h + 0.055, 0]}>
        <boxGeometry args={[cross, 0.02, r.d * 0.6]} />
        <meshStandardMaterial color="#c9a64a" metalness={0.8} roughness={0.3} emissive="#3a2a08" />
      </mesh>
      <Billboard position={[0, h + 0.6, 0]}>
        <Text fontSize={0.22} color="#d4d4d8" outlineWidth={0.015} outlineColor="#000000">
          {entity.mythicName}
        </Text>
      </Billboard>
    </group>
  )
}

// ---------- bone-chain: skeleton → coffin → zombie ----------

type BezierRef = ComponentRef<typeof QuadraticBezierLine>
const IVORY = "#efe6c8"

export function BoneChain({ crisis, coffin }: { crisis: Crisis; coffin?: Entity }) {
  const toCoffin = useRef<BezierRef>(null)
  const toZombie = useRef<BezierRef>(null)
  const v = useMemo(
    () => ({
      s: new THREE.Vector3(),
      c: new THREE.Vector3(),
      z: new THREE.Vector3(),
      m1: new THREE.Vector3(),
      m2: new THREE.Vector3(),
    }),
    [],
  )

  const rigged = !!coffin && ["RIGGING", "ANCHORED", "PULLING"].includes(crisis.status)
  const anchored = !!coffin && ["ANCHORED", "PULLING"].includes(crisis.status)

  useFrame(({ clock }) => {
    const sk = creatureObjects.get("skeleton")
    const zo = creatureObjects.get("zombie")
    if (!sk || !zo) return
    const taut = crisis.status === "PULLING"
    const sag = taut ? 0 : 0.35
    const jitter = taut ? Math.sin(clock.elapsedTime * 40) * 0.03 : 0

    v.s.copy(sk.position).setY(0.55)
    v.z.copy(zo.position).setY(0.7)
    v.c.copy(fx.lastCoffinPos).setY(0.3)
    v.m1.lerpVectors(v.s, v.c, 0.5).setY(Math.min(v.s.y, v.c.y) - sag + jitter)
    v.m2.lerpVectors(v.c, v.z, 0.5).setY(Math.min(v.c.y, v.z.y) - sag - jitter)
    toCoffin.current?.setPoints(v.s, v.c, v.m1)
    toZombie.current?.setPoints(v.c, v.z, v.m2)
  })

  return (
    <>
      {rigged && (
        <QuadraticBezierLine
          ref={toCoffin}
          start={[0, 0, 0]}
          end={[0, 0, 0]}
          color={IVORY}
          lineWidth={5}
          dashed
          dashScale={30}
          dashSize={0.6}
          gapSize={0.4}
        />
      )}
      {anchored && (
        <QuadraticBezierLine
          ref={toZombie}
          start={[0, 0, 0]}
          end={[0, 0, 0]}
          color={IVORY}
          lineWidth={5}
          dashed
          dashScale={30}
          dashSize={0.6}
          gapSize={0.4}
        />
      )}
    </>
  )
}

// ---------- dust burst when the coffin breaks free ----------

export function DustBurst({ crisis }: { crisis: Crisis }) {
  const since = useStatusSince(crisis.status)
  const puffs = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ a: (i / 12) * Math.PI * 2, s: 0.25 + ((i * 37) % 10) / 40 })),
    [],
  )
  const group = useRef<THREE.Group>(null)
  const mats = useRef<(THREE.MeshStandardMaterial | null)[]>([])

  useFrame(() => {
    const g = group.current
    if (!g) return
    const t = (performance.now() - since.current.t) / 1200
    const on = crisis.status === "CLEARED" && t < 1
    g.visible = on
    if (!on) return
    g.position.copy(fx.lastCoffinPos)
    g.children.forEach((child, i) => {
      const p = puffs[i]!
      const d = 0.3 + t * 1.6
      child.position.set(Math.cos(p.a) * d, 0.15 + t * p.s * 1.8, Math.sin(p.a) * d * 0.7)
      child.scale.setScalar(p.s * (0.6 + t * 1.4))
      const m = mats.current[i]
      if (m) m.opacity = 0.75 * (1 - t)
    })
  })

  return (
    <group ref={group} visible={false}>
      {puffs.map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.5, 10, 8]} />
          <meshStandardMaterial
            ref={(m) => {
              mats.current[i] = m
            }}
            color="#9a8a72"
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

// ---------- quick scene shake when cleared ----------

export function ShakeOnClear({ crisis, children }: { crisis: Crisis; children: ReactNode }) {
  const group = useRef<THREE.Group>(null)
  const since = useStatusSince(crisis.status)

  useFrame(() => {
    const g = group.current
    if (!g) return
    const t = (performance.now() - since.current.t) / 700
    if (crisis.status === "CLEARED" && t < 1) {
      const k = (1 - t) * 0.12
      g.position.set((Math.random() - 0.5) * k, (Math.random() - 0.5) * k * 0.5, (Math.random() - 0.5) * k)
    } else {
      g.position.set(0, 0, 0)
    }
  })

  return <group ref={group}>{children}</group>
}
