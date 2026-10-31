"use client"

import { createContext, type ReactNode, type RefObject, useContext, useRef } from "react"

export const REAL_HOLD_MS = 2000 // show the real desk this long
export const MORPH_MS = 3000 // then morph over this long

const RevealContext = createContext<RefObject<number | null> | null>(null)

export function RevealProvider({ start, children }: { start: number | null; children: ReactNode }) {
  const ref = useRef<number | null>(start)
  ref.current = start
  return <RevealContext.Provider value={ref}>{children}</RevealContext.Provider>
}

export function clamp01(t: number) {
  return Math.min(1, Math.max(0, t))
}
export function smooth(t: number) {
  const c = clamp01(t)
  return c * c * (3 - 2 * c)
}
/** Map p from [a, b] to a smoothed 0–1. */
export function phase(p: number, a: number, b: number) {
  return smooth((p - a) / (b - a))
}
export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

/** Getter for reveal progress (0 real desk → 1 haunted). Call it inside useFrame. */
export function useReveal() {
  const ref = useContext(RevealContext)
  return () => {
    const start = ref?.current
    if (start == null) return 1
    return clamp01((performance.now() - start - REAL_HOLD_MS) / MORPH_MS)
  }
}
