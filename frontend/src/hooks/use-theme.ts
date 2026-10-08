import { useCallback, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'logisense-theme'
const EVENT = 'logisense:theme'

function systemTheme(): 'light' | 'dark' {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function read(): Theme {
  if (typeof window === 'undefined') return 'system'
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    /* storage unavailable — fall through to system */
  }
  return 'system'
}

function apply(preference: Theme): 'light' | 'dark' {
  if (typeof document === 'undefined') return preference === 'system' ? 'light' : preference
  const resolved = preference === 'system' ? systemTheme() : preference
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  document.documentElement.style.colorScheme = resolved
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#090c13' : '#f6f7f9')
  return resolved
}

let preference: Theme = read()
let resolved: 'light' | 'dark' = 'light'
const listeners = new Set<(p: Theme) => void>()

function commit(next: Theme) {
  preference = next
  resolved = apply(next)
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: next }))
  listeners.forEach((fn) => fn(next))
}

if (typeof window !== 'undefined') apply(preference)

if (typeof window !== 'undefined') {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', () => {
    if (preference === 'system') {
      resolved = apply(preference)
      listeners.forEach((fn) => fn(preference))
    }
  })
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return
    const next = event.newValue
    if (next === 'light' || next === 'dark' || next === 'system') commit(next)
  })
}

export function useTheme() {
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => `${preference}:${resolved}`,
    () => 'system',
  )

  const toggle = useCallback(() => {
    commit(resolved === 'dark' ? 'light' : 'dark')
  }, [])

  return { theme: resolved, preference, setTheme: commit, toggle }
}

export function setGlobalTheme(next: Theme) {
  commit(next)
}

export { EVENT }
