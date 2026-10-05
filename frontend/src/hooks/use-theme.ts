import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'logisense-theme'
const EVENT = 'logisense:theme'

function systemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function read(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    /* storage unavailable — fall through to system */
  }
  return 'system'
}

function apply(preference: Theme): 'light' | 'dark' {
  const resolved = preference === 'system' ? systemTheme() : preference
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  document.documentElement.style.colorScheme = resolved
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#090c13' : '#f6f7f9')
  return resolved
}

let preference: Theme = read()
let resolved: 'light' | 'dark' = 'dark'
const listeners = new Set<(p: Theme) => void>()

function commit(next: Theme) {
  preference = next
  resolved = apply(next)
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn(next))
}

apply(preference)

if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (preference === 'system') commit('system')
  })
}

export function useTheme() {
  const [pref, setPref] = useState<Theme>(preference)

  useEffect(() => {
    const fn = (p: Theme) => setPref(p)
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  }, [])

  useEffect(() => {
    if (pref === preference) return
    commit(pref)
  }, [pref])

  const toggle = useCallback(() => {
    commit(resolved === 'dark' ? 'light' : 'dark')
  }, [resolved])

  return { theme: resolved, preference: pref, setTheme: setPref, toggle }
}

export function setGlobalTheme(next: Theme) {
  commit(next)
}

export { EVENT }
