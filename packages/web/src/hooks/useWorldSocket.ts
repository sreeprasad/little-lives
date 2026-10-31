"use client"

import { useEffect, useRef, useState } from "react"
import type { WorldSnapshot } from "@/lib/types"

export type SocketStatus = "connecting" | "open" | "closed"

export function useWorldSocket() {
  const [snapshot, setSnapshot] = useState<WorldSnapshot | null>(null)
  const [status, setStatus] = useState<SocketStatus>("connecting")
  const latestVersion = useRef(-1)

  useEffect(() => {
    let active = true
    let socket: WebSocket | null = null
    let attempt = 0
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    const scheduleReconnect = () => {
      if (!active) return
      setStatus("closed")
      const delay = Math.min(8000, 500 * 2 ** attempt)
      attempt += 1
      retryTimer = setTimeout(connect, delay)
    }

    async function connect() {
      if (!active) return
      setStatus("connecting")
      try {
        const res = await fetch("/api/world/socket", { method: "POST", cache: "no-store" })
        if (!res.ok) throw new Error(`grant ${res.status}`)
        const { websocketUrl } = (await res.json()) as { websocketUrl: string }
        if (!active) return

        socket = new WebSocket(websocketUrl)
        socket.onopen = () => {
          attempt = 0
          setStatus("open")
        }
        socket.onmessage = (event) => {
          const next = JSON.parse(event.data as string) as WorldSnapshot
          // A fresh connection may legitimately restart below our last version
          // (e.g. after reset), so only drop strictly-stale frames on this socket.
          if (next.version < latestVersion.current && status === "open") return
          latestVersion.current = next.version
          setSnapshot(next)
        }
        socket.onclose = () => {
          socket = null
          scheduleReconnect()
        }
        socket.onerror = () => socket?.close()
      } catch {
        scheduleReconnect()
      }
    }

    void connect()
    return () => {
      active = false
      clearTimeout(retryTimer)
      socket?.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { snapshot, status }
}
