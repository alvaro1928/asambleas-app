const isDev = process.env.NODE_ENV !== 'production'

export function logRouteError(routeLabel: string, error: unknown, extra?: Record<string, unknown>): void {
  if (extra && Object.keys(extra).length > 0) {
    console.error(`[${routeLabel}]`, error, extra)
  } else {
    console.error(`[${routeLabel}]`, error)
  }
}

export function publicErrorMessage(error: unknown, fallback: string): string {
  if (isDev && error instanceof Error && error.message?.trim()) {
    return error.message.trim()
  }
  return fallback
}
