export const POLL_MS_FLAGS = 5000
export const POLL_MS_HEAVY = 10000
export const FOCUS_REFRESH_MIN_MS = 4000

export function shouldSkipFocusRefresh(lastRefreshAt: number, nowMs: number): boolean {
  return nowMs - lastRefreshAt < FOCUS_REFRESH_MIN_MS
}
