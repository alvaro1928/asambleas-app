'use client'

import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastContextValue {
  success: (message: string, duration?: number) => void
  error: (message: string, duration?: number) => void
  info: (message: string, duration?: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DEFAULT_DURATION = 5000

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast debe usarse dentro de ToastProvider')
  }
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const addToast = useCallback((type: ToastType, message: string, duration = DEFAULT_DURATION) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts((prev) => [...prev, { id, type, message, duration }])
    if (duration > 0) {
      const timeoutId = setTimeout(() => {
        timeoutsRef.current.delete(id)
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, duration)
      timeoutsRef.current.set(id, timeoutId)
    }
  }, [])

  const removeToast = useCallback((id: string) => {
    const tid = timeoutsRef.current.get(id)
    if (tid) {
      clearTimeout(tid)
      timeoutsRef.current.delete(id)
    }
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Limpiar todos los timeouts al desmontar
  React.useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((tid) => clearTimeout(tid))
      timeoutsRef.current.clear()
    }
  }, [])

  const success = useCallback((message: string, duration?: number) => addToast('success', message, duration ?? DEFAULT_DURATION), [addToast])
  const error = useCallback((message: string, duration?: number) => addToast('error', message, duration ?? DEFAULT_DURATION), [addToast])
  const info = useCallback((message: string, duration?: number) => addToast('info', message, duration ?? DEFAULT_DURATION), [addToast])

  return (
    <ToastContext.Provider value={{ success, error, info }}>
      {children}
      <div
        className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
        aria-live="polite"
        aria-label="Notificaciones"
      >
        {toasts.map((t) => (
          <Toast key={t.id} item={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function Toast({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const icons = {
    success: <CheckCircle2 className="w-5 h-5 shrink-0" />,
    error: <XCircle className="w-5 h-5 shrink-0" />,
    info: <Info className="w-5 h-5 shrink-0" />,
  }
  const styles = {
    success: 'bg-success-light dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 [&>svg]:text-success',
    error: 'bg-error-light dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 [&>svg]:text-error',
    info: 'bg-primary-light dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-primary-dark dark:text-indigo-200 [&>svg]:text-primary',
  }
  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-lg',
        styles[item.type]
      )}
      role="status"
    >
      {icons[item.type]}
      <p className="flex-1 text-sm font-medium leading-snug break-words">{item.message}</p>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 rounded-md p-1 hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-1"
        aria-label="Cerrar notificación"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
