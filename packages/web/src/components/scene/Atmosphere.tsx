"use client"

import { useFrame } from "@react-three/fiber"
import { useMemo, useRef } from "react"
import * as THREE from "three"
import { DESK_D, DESK_W } from "@/lib/scene"
import { lerp, phase, useReveal } from "./reveal"

function rand(i: number) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

const DAY_BG = new THREE.Color("#1b1d24")
const NIGHT_BG = new THREE.Color("#05060b")
const WHITE = new THREE.Color("#ffffff")
const MOON_AMBIENT = new THREE.Color("#7d8cc4")

// ---------- day → moonlight ----------

function Lights() {
  const reveal = useReveal()
  const ambient = useRef<THREE.AmbientLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const moon = useRef<THREE.DirectionalLight>(null)
  const moonDisc = useRef<THREE.Mesh>(null)

  useFrame(({ scene }) => {
    const n = phase(reveal(), 0, 0.6)
    if (ambient.current) {
      ambient.current.intensity = lerp(1.2, 0.4, n)
      ambient.current.color.lerpColors(WHITE, MOON_AMBIENT, n)
    }
    if (hemi.current) hemi.current.intensity = lerp(0.2, 0.6, n)
    if (sun.current) sun.current.intensity = lerp(1.6, 0, n)
    if (moon.current) moon.current.intensity = lerp(0, 1.3, n)
    if (moonDisc.current) moonDisc.current.visible = n > 0.3
    if (scene.background instanceof THREE.Color) scene.background.lerpColors(DAY_BG, NIGHT_BG, n)
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.near = lerp(80, 16, n)
      scene.fog.far = lerp(160, 36, n)
    }
  })

  return (
    <group>
      <ambientLight ref={ambient} intensity={0.4} color="#7d8cc4" />
      <hemisphereLight ref={hemi} args={["#3a4a80", "#1a0f08", 0.6]} />
      {/* Warm room light for the "real desk" moment; no shadows to save cost. */}
      <directionalLight ref={sun} position={[4, 14, 6]} intensity={0} color="#fff2e0" />
      <directionalLight
        ref={moon}
        position={[-8, 14, -6]}
        intensity={1.3}
        color="#c4d4ff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-camera-left={-11}
        shadow-camera-right={11}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
      />
      <mesh ref={moonDisc} position={[-22, 16, -34]}>
        <sphereGeometry args={[2.2, 32, 32]} />
        <meshBasicMaterial color="#f2f0dc" toneMapped={false} />
      </mesh>
    </group>
  )
}

// ---------- jack-o'-lanterns ----------

const LANTERN_SPOTS: [number, number, number][] = [
  [-DESK_W / 2 + 0.6, 0, -DESK_D / 2 + 0.6],
  [DESK_W / 2 - 0.6, 0, -DESK_D / 2 + 0.6],
  [-DESK_W / 2 + 0.6, 0, DESK_D / 2 - 0.6],
  [DESK_W / 2 - 0.6, 0, DESK_D / 2 - 0.6],
]

function Lantern({ position, seed }: { position: [number, number, number]; seed: number }) {
  const reveal = useReveal()
  const group = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  const glow = useRef<THREE.MeshStandardMaterial>(null)

  useFrame(({ clock }) => {
    // Each pumpkin pops in at a slightly different moment.
    const on = phase(reveal(), 0.3 + seed * 0.06, 0.55 + seed * 0.06)
    const t = clock.elapsedTime * 9 + seed * 10
    const flicker = 0.75 + Math.sin(t) * 0.12 + Math.sin(t * 2.7) * 0.08 + Math.sin(t * 7.3) * 0.05
    if (group.current) group.current.scale.setScalar(Math.max(0.0001, on))
    if (light.current) light.current.intensity = 5 * flicker * on
    if (glow.current) glow.current.emissiveIntensity = 2.5 * flicker * on
  })

  return (
    <group ref={group} position={position}>
      <mesh position={[0, 0.22, 0]} scale={[1, 0.78, 1]} castShadow>
        <sphereGeometry args={[0.28, 20, 16]} />
        <meshStandardMaterial
          ref={glow}
          color="#d9661f"
          emissive="#ff7a1a"
          emissiveIntensity={2.5}
          roughness={0.7}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0.48, 0]}>
        <cylinderGeometry args={[0.03, 0.04, 0.1, 8]} />
        <meshStandardMaterial color="#3d5a1e" />
      </mesh>
      <pointLight ref={light} position={[0, 0.45, 0]} color="#ff8a3d" intensity={5} distance={6} />
    </group>
  )
}

// ---------- ground fog ----------

function useFogTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas")
    c.width = c.height = 128
    const ctx = c.getContext("2d")
    if (!ctx) return null
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, "rgba(190,200,240,0.85)")
    g.addColorStop(0.5, "rgba(170,180,230,0.35)")
    g.addColorStop(1, "rgba(160,170,220,0)")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
    return new THREE.CanvasTexture(c)
  }, [])
}

const FOG_OPACITY = 0.09

function GroundFog({ count = 14 }: { count?: number }) {
  const reveal = useReveal()
  const texture = useFogTexture()
  const patches = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: (rand(i) - 0.5) * (DESK_W - 2),
        z: (rand(i + 50) - 0.5) * (DESK_D - 1.5),
        size: 3.5 + rand(i + 100) * 4,
        speed: 0.05 + rand(i + 150) * 0.1,
        phase: rand(i + 200) * Math.PI * 2,
        y: 0.08 + rand(i + 250) * 0.25,
      })),
    [count],
  )
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const density = phase(reveal(), 0.35, 0.9)
    patches.forEach((p, i) => {
      const m = meshes.current[i]
      if (m) {
        m.position.x = p.x + Math.sin(t * p.speed + p.phase) * 1.2
        m.position.z = p.z + Math.cos(t * p.speed * 0.8 + p.phase) * 0.6
        m.rotation.z = t * p.speed * 0.3 + p.phase
      }
      const mat = mats.current[i]
      if (mat) mat.opacity = FOG_OPACITY * density
    })
  })

  if (!texture) return null
  return (
    <group>
      {patches.map((p, i) => (
        <mesh
          key={i}
          ref={(m) => {
            meshes.current[i] = m
          }}
          rotation-x={-Math.PI / 2}
          position={[p.x, p.y, p.z]}
          renderOrder={2}
        >
          <planeGeometry args={[p.size, p.size]} />
          <meshBasicMaterial
            ref={(m) => {
              mats.current[i] = m
            }}
            map={texture}
            transparent
            opacity={FOG_OPACITY}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}

// ---------- bats ----------

function Bat({ radius, height, speed, phase: ph }: { radius: number; height: number; speed: number; phase: number }) {
  const g = useRef<THREE.Group>(null)
  const left = useRef<THREE.Group>(null)
  const right = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * speed + ph
    if (g.current) {
      g.current.position.set(Math.cos(t) * radius, height + Math.sin(t * 3) * 0.3, Math.sin(t) * radius * 0.6)
      g.current.rotation.y = Math.atan2(-Math.sin(t), Math.cos(t) * 0.6)
    }
    const flap = Math.sin(clock.elapsedTime * 18 + ph * 5) * 0.9
    if (left.current) left.current.rotation.z = flap
    if (right.current) right.current.rotation.z = -flap
  })

  return (
    <group ref={g}>
      <mesh>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial color="#0d0d12" />
      </mesh>
      <group ref={left}>
        <mesh position={[-0.17, 0, 0]}>
          <boxGeometry args={[0.32, 0.01, 0.14]} />
          <meshStandardMaterial color="#141420" />
        </mesh>
      </group>
      <group ref={right}>
        <mesh position={[0.17, 0, 0]}>
          <boxGeometry args={[0.32, 0.01, 0.14]} />
          <meshStandardMaterial color="#141420" />
        </mesh>
      </group>
    </group>
  )
}

function BatFlock({ count = 5 }: { count?: number }) {
  const reveal = useReveal()
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    if (group.current) group.current.visible = reveal() > 0.6
  })
  return (
    <group ref={group}>
      {Array.from({ length: count }, (_, i) => (
        <Bat
          key={i}
          radius={5 + rand(i + 300) * 3}
          height={3.2 + rand(i + 350) * 1.5}
          speed={0.25 + rand(i + 400) * 0.2}
          phase={rand(i + 450) * Math.PI * 2}
        />
      ))}
    </group>
  )
}

// ---------- root ----------

export function Atmosphere() {
  return (
    <group>
      <color attach="background" args={["#05060b"]} />
      <fog attach="fog" args={["#05060b", 16, 36]} />
      <Lights />
      {LANTERN_SPOTS.map((p, i) => (
        <Lantern key={i} position={p} seed={i} />
      ))}
      <GroundFog />
      <BatFlock />
    </group>
  )
}
