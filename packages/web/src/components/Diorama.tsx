"use client"

import { OrbitControls, Stats } from "@react-three/drei"
import { Canvas } from "@react-three/fiber"
import { Suspense } from "react"
import type { Crisis, Entity, WorldSnapshot } from "@/lib/types"
import { Atmosphere } from "./scene/Atmosphere"
import { Creature } from "./scene/Creature"
import { DeskGround } from "./scene/DeskGround"
import { Effects } from "./scene/Effects"
import { IdleScene } from "./scene/IdleScene"
import { Landmark } from "./scene/Landmark"
import { MessageFlights } from "./scene/MessageFx"
import { BoneChain, Coffin, DustBurst, ShakeOnClear } from "./scene/RescueFx"
import { RevealProvider } from "./scene/reveal"

const NO_CRISIS: Crisis = { id: "", obstacleId: "", requiredForce: 0, appliedForce: 0, status: "NONE" }

function EntityView({ entity, crisis }: { entity: Entity; crisis: Crisis }) {
  if (entity.category === "CREATURE_SPAWN") return null // the monsters themselves mark these spots
  if (entity.category === "OBSTACLE") return <Coffin entity={entity} crisis={crisis} />
  return <Landmark entity={entity} />
}

export function Diorama({
  snapshot,
  showGrid,
  showStats,
  photoUrl,
  revealStart = null,
  tiltShift = true,
}: {
  snapshot: WorldSnapshot | null
  showGrid: boolean
  showStats: boolean
  photoUrl?: string
  revealStart?: number | null
  tiltShift?: boolean
}) {
  const entities = snapshot?.entities ?? []
  const crisis = snapshot?.crisis ?? NO_CRISIS
  const coffin = entities.find((e) => e.id === crisis.obstacleId)

  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 13, 12], fov: 35, near: 0.1, far: 120 }}>
      <RevealProvider start={revealStart}>
        <Atmosphere />
        <ShakeOnClear crisis={crisis}>
          <DeskGround showGrid={showGrid} photoUrl={photoUrl} entities={entities} />
          <Suspense fallback={null}>
            {entities.length === 0 && <IdleScene />}
            {entities.map((e) => (
              <EntityView key={e.id} entity={e} crisis={crisis} />
            ))}
            {snapshot?.creatures.map((c) => <Creature key={c.role} creature={c} />)}
          </Suspense>
          <BoneChain crisis={crisis} coffin={coffin} />
          <DustBurst crisis={crisis} />
          <MessageFlights log={snapshot?.relayLog ?? []} />
        </ShakeOnClear>

        <OrbitControls
          target={[0, 0, 0]}
          enablePan={false}
          minDistance={6}
          maxDistance={26}
          maxPolarAngle={Math.PI / 2.3}
        />
        <Effects tiltShift={tiltShift} />
        {showStats && <Stats />}
      </RevealProvider>
    </Canvas>
  )
}
