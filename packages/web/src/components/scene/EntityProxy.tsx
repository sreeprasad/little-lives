"use client"

import { Html } from "@react-three/drei"
import { entityRect } from "@/lib/scene"
import type { Entity } from "@/lib/types"

const COLOR: Record<Entity["category"], string> = {
  CREATURE_SPAWN: "#1f3a2a",
  ANCHOR: "#5b4a6b",
  OBSTACLE: "#4a2e1c",
  PROP: "#6b6b70",
}

const HEIGHT: Record<Entity["mass"], number> = { LIGHT: 0.4, MEDIUM: 0.8, HEAVY: 1.6 }

export function EntityProxy({ entity }: { entity: Entity }) {
  const r = entityRect(entity)

  if (entity.category === "CREATURE_SPAWN") {
    return (
      <mesh rotation-x={-Math.PI / 2} position={[r.cx, 0.01, r.cz]} receiveShadow>
        <circleGeometry args={[Math.min(r.w, r.d) * 0.45, 32]} />
        <meshStandardMaterial color={COLOR.CREATURE_SPAWN} />
      </mesh>
    )
  }

  const h = entity.category === "OBSTACLE" ? 0.35 : HEIGHT[entity.mass]
  return (
    <group position={[r.cx, 0, r.cz]}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[r.w * 0.9, h, r.d * 0.9]} />
        <meshStandardMaterial color={COLOR[entity.category]} roughness={0.8} />
      </mesh>
      <Html position={[0, h + 0.25, 0]} center distanceFactor={14} style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
          {entity.mythicName}
        </div>
      </Html>
    </group>
  )
}
