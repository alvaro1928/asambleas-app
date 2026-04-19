'use client'

import { useEffect } from 'react'

/** Alinea `--color-primary` con la configuración pública (mismo criterio que el landing). */
export function PublicSitePrimarySync() {
  useEffect(() => {
    fetch('/api/config/public', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { color_principal_hex?: string | null } | null) => {
        const hex = data?.color_principal_hex?.trim()
        if (hex && /^#[0-9A-Fa-f]{6}$/.test(hex)) {
          document.documentElement.style.setProperty('--color-primary', hex)
        }
      })
      .catch(() => {})
  }, [])
  return null
}
