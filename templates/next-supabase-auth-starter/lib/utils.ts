import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getAppName(): string {
  return process.env.NEXT_PUBLIC_APP_NAME?.trim() || 'Mi App'
}

export function getCallbackUrl(origin?: string): string {
  if (origin) return `${origin}/auth/callback`
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}/auth/callback`
  }
  return 'http://localhost:3000/auth/callback'
}
