"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { DESK_ASPECT } from "@/lib/scene"

export interface Capture {
  blob: Blob // 1024px JPEG for Gemini
  photoUrl: string // full-res object URL for the 3D ground
}

export type CameraStatus = "idle" | "asking" | "live" | "denied" | "error"

const PREFERRED = /iphone|continuity/i

function toJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", quality),
  )
}

async function listCameras() {
  return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput")
}

export function useDeskCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [status, setStatus] = useState<CameraStatus>("idle")
  const [error, setError] = useState<string | null>(null)

  // Ask permission first: device labels are empty until it is granted.
  const start = useCallback(async () => {
    setStatus("asking")
    try {
      const probe = await navigator.mediaDevices.getUserMedia({ video: true })
      probe.getTracks().forEach((t) => t.stop())
      const cams = await listCameras()
      setDevices(cams)
      setDeviceId((prev) => prev ?? (cams.find((c) => PREFERRED.test(c.label)) ?? cams[0])?.deviceId ?? null)
    } catch (e) {
      setStatus(e instanceof DOMException && e.name === "NotAllowedError" ? "denied" : "error")
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  // Open the chosen camera.
  useEffect(() => {
    if (!deviceId) return
    let cancelled = false
    navigator.mediaDevices
      .getUserMedia({ video: { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          void videoRef.current.play().catch(() => { })
        }
        setStatus("live")
        setError(null)
      })
      .catch((e) => {
        if (cancelled) return
        setStatus("error")
        setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [deviceId])

  // Re-list cameras when one appears or disappears (e.g. the iPhone wakes up),
  // and switch to the iPhone as soon as it shows up.
  useEffect(() => {
    if (status === "idle" || status === "asking") return
    const refresh = async () => {
      const cams = await listCameras()
      setDevices(cams)
      const phone = cams.find((c) => PREFERRED.test(c.label))
      if (!phone) return
      setDeviceId((prev) => {
        const current = cams.find((c) => c.deviceId === prev)
        return current && PREFERRED.test(current.label) ? prev : phone.deviceId
      })
    }
    navigator.mediaDevices.addEventListener("devicechange", refresh)
    return () => navigator.mediaDevices.removeEventListener("devicechange", refresh)
  }, [status])

  // Release the camera when the page unmounts.
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), [])

  /** Grab the current frame, centre-cropped to the desk's aspect ratio. */
  const capture = useCallback(async (): Promise<Capture | null> => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return null
    const vw = v.videoWidth
    const vh = v.videoHeight
    let sw = vw
    let sh = vh
    if (vw / vh > DESK_ASPECT) sw = Math.round(vh * DESK_ASPECT)
    else sh = Math.round(vw / DESK_ASPECT)
    const sx = (vw - sw) / 2
    const sy = (vh - sh) / 2

    const full = document.createElement("canvas")
    full.width = sw
    full.height = sh
    full.getContext("2d")?.drawImage(v, sx, sy, sw, sh, 0, 0, sw, sh)

    const scale = 1024 / Math.max(sw, sh)
    const small = document.createElement("canvas")
    small.width = Math.round(sw * scale)
    small.height = Math.round(sh * scale)
    small.getContext("2d")?.drawImage(full, 0, 0, small.width, small.height)

    const [fullBlob, smallBlob] = await Promise.all([toJpeg(full, 0.9), toJpeg(small, 0.85)])
    return { blob: smallBlob, photoUrl: URL.createObjectURL(fullBlob) }
  }, [])

  return { videoRef, devices, deviceId, setDeviceId, status, error, start, capture }
}
