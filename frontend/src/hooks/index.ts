import { useEffect, useRef, useState } from 'react'

/* ------------------------------------------------------------------ *
 * useMediaQuery
 * ------------------------------------------------------------------ */

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const fn = () => setMatches(mql.matches)
    fn()
    mql.addEventListener('change', fn)
    return () => mql.removeEventListener('change', fn)
  }, [query])

  return matches
}

export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)')

/* ------------------------------------------------------------------ *
 * useLocalStorage — settings persistence
 * ------------------------------------------------------------------ */

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* quota / private mode — non-fatal */
    }
  }, [key, value])

  return [value, setValue] as const
}

/* ------------------------------------------------------------------ *
 * useSimulatedAsync
 *
 * Demo-mode data generation is synchronous and instant, which would make
 * every screen flash. This holds a skeleton for a beat so loading states
 * are real transitions rather than decoration.
 * ------------------------------------------------------------------ */

export function useSimulatedAsync<T>(value: T, ms = 320): { data: T | null; loading: boolean } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      const t = window.setTimeout(() => {
        setData(value)
        setLoading(false)
      }, ms)
      return () => window.clearTimeout(t)
    }

    setLoading(true)
    const t = window.setTimeout(() => {
      setData(value)
      setLoading(false)
    }, 220)
    return () => window.clearTimeout(t)
  }, [value, ms])

  return { data, loading }
}

/* ------------------------------------------------------------------ *
 * useClickOutside
 * ------------------------------------------------------------------ */

export function useClickOutside<T extends HTMLElement>(
  handler: () => void,
  enabled = true,
) {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    if (!enabled) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) handler()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handler()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [handler, enabled])

  return ref
}

/* ------------------------------------------------------------------ *
 * useHotkey — ⌘K / ctrl+K command palette
 * ------------------------------------------------------------------ */

export function useHotkey(combo: (e: KeyboardEvent) => boolean, handler: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (combo(e)) {
        e.preventDefault()
        handler()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [combo, handler])
}

/* ------------------------------------------------------------------ *
 * usePagination
 * ------------------------------------------------------------------ */

export function usePagination<T>(rows: readonly T[], pageSize = 25) {
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(page, pages - 1)

  useEffect(() => {
    setPage(0)
  }, [rows, pageSize])

  return {
    page: safePage,
    pageSize,
    pages,
    setPage,
    slice: rows.slice(safePage * pageSize, safePage * pageSize + pageSize),
    total: rows.length,
  }
}
