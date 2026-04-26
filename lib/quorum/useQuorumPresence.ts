'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

interface UseQuorumPresenceArgs {
  asambleaId?: string | null
  identificador?: string | null
  preguntaId?: string | null
  enabled?: boolean
  heartbeatSeconds?: number
}

export function useQuorumPresence({
  asambleaId,
  identificador,
  preguntaId,
  enabled = true,
  heartbeatSeconds = 30,
}: UseQuorumPresenceArgs) {
  const [isOnline, setIsOnline] = useState(true)
  const [lastSuccessAt, setLastSuccessAt] = useState<string | null>(null)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const retryCountRef = useRef(0)
  const connectionId = useMemo(() => {
    if (typeof window === 'undefined') return null
    const key = 'quorum_presence_connection_id'
    const existing = window.sessionStorage.getItem(key)
    if (existing) return existing
    const next = crypto.randomUUID()
    window.sessionStorage.setItem(key, next)
    return next
  }, [])

  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    if (!enabled || !asambleaId || !identificador || !connectionId) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const sendHeartbeat = async (activityHint = false) => {
      if (cancelled) return
      if (!navigator.onLine) {
        setIsReconnecting(true)
        scheduleRetry()
        return
      }
      try {
        const response = await fetch('/api/votar/presence-heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            asamblea_id: asambleaId,
            identificador,
            pregunta_id: preguntaId ?? null,
            connection_id: connectionId,
            activity_hint: activityHint,
          }),
        })
        if (!response.ok) throw new Error('Heartbeat no aceptado')
        retryCountRef.current = 0
        setIsReconnecting(false)
        setLastSuccessAt(new Date().toISOString())
      } catch {
        setIsReconnecting(true)
      } finally {
        if (!cancelled) scheduleNext()
      }
    }

    const scheduleNext = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        void sendHeartbeat(false)
      }, heartbeatSeconds * 1000)
    }

    const scheduleRetry = () => {
      if (timer) clearTimeout(timer)
      retryCountRef.current += 1
      const waitMs = Math.min(15000, 1000 * Math.pow(2, retryCountRef.current))
      timer = setTimeout(() => {
        void sendHeartbeat(true)
      }, waitMs)
    }

    const onFocus = () => void sendHeartbeat(true)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void sendHeartbeat(true)
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    void sendHeartbeat(true)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
    }
  }, [enabled, asambleaId, identificador, preguntaId, heartbeatSeconds, connectionId])

  return {
    isOnline,
    isReconnecting,
    lastSuccessAt,
    connectionId,
  }
}
