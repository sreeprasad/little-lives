"use client"

import { Billboard, Text } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import type { RelayPacket, Role } from "@/lib/types"
import { creatureObjects } from "./Creature"

const COLORS: Record<Role, string> = { ghost: "#8f9bff", skeleton: "#ffd27a", zombie: "#a8ff6b" }
const FLIGHT_MS = 1600

interface FlightData {
  id: string
  from: Role
  to: Role
  type: string
  start: number
}

/** One glowing message orb arcing from sender to receiver. */
function Flight({ f, onDone }: { f: FlightData; onDone: (id: string) => void }) {
  const group = useRef<THREE.Group>(null)
  const done = useRef(false)
  const a = useMemo(() => new THREE.Vector3(), [])
  const b = useMemo(() => new THREE.Vector3(), [])
  const color = COLORS[f.from]

  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    const t = (performance.now() - f.start) / FLIGHT_MS
    if (t < 0) {
      g.visible = false
      return
    }
    if (t >= 1) {
      g.visible = false
      if (!done.current) {
        done.current = true
        onDone(f.id)
      }
      return
    }
    const from = creatureObjects.get(f.from)
    const to = creatureObjects.get(f.to)
    if (!from || !to) return
    g.visible = true
    a.copy(from.position).setY(1.3)
    b.copy(to.position).setY(1.3)
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    g.position.lerpVectors(a, b, e)
    g.position.y += Math.sin(Math.PI * e) * 1.6
    const pulse = 1 + Math.sin(clock.elapsedTime * 20) * 0.12
    g.scale.setScalar(pulse * Math.min(1, t * 6, (1 - t) * 6))
  })

  return (
    <group ref={group} visible={false}>
      <mesh>
        <sphereGeometry args={[0.18, 20, 16]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.34, 20, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} depthWrite={false} toneMapped={false} />
      </mesh>
      <pointLight color={color} intensity={4} distance={3} />
      <Billboard position={[0, 0.5, 0]}>
        <Text fontSize={0.2} color={color} outlineWidth={0.015} outlineColor="#000000">
          {f.type.replace(/_/g, " ")}
        </Text>
      </Billboard>
    </group>
  )
}

/** Launches a flight for every new Relay message in the world's log. */
export function MessageFlights({ log }: { log: RelayPacket[] }) {
  const [flights, setFlights] = useState<FlightData[]>([])
  const lastAt = useRef<number | null>(null)

  useEffect(() => {
    const newest = log.reduce((m, p) => Math.max(m, p.at), 0)
    // On first load, don't replay old messages.
    if (lastAt.current === null) {
      lastAt.current = newest
      return
    }
    const since = lastAt.current
    const fresh = log.filter((p) => p.at > since && p.from !== "world" && p.to !== "world")
    lastAt.current = Math.max(since, newest)
    if (fresh.length === 0) return
    const now = performance.now()
    setFlights((prev) => [
      ...prev,
      ...fresh.map((p, i) => ({
        id: `${p.at}-${p.type}-${i}`,
        from: p.from as Role,
        to: p.to as Role,
        type: p.type,
        start: now + i * 300,
      })),
    ])
  }, [log])

  const finish = (id: string) => setFlights((prev) => prev.filter((f) => f.id !== id))

  return (
    <>
      {flights.map((f) => (
        <Flight key={f.id} f={f} onDone={finish} />
      ))}
    </>
  )
}
