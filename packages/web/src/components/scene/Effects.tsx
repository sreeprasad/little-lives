"use client"

import { Bloom, EffectComposer, TiltShift2, Vignette } from "@react-three/postprocessing"

export function Effects({ tiltShift = true }: { tiltShift?: boolean }) {
  return (
    <EffectComposer>
      <Bloom mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={0.9} />
      {/* Gentle miniature look: only the far edges blur. */}
      {tiltShift ? <TiltShift2 blur={0.05} taper={0.7} /> : <></>}
      <Vignette offset={0.25} darkness={0.8} />
    </EffectComposer>
  )
}
