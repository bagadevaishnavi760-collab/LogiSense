import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * A single URL search param as component state.
 *
 * Keeps view state (active tab, chart metric, sort) shareable and survives a
 * reload without any additional persistence layer.
 */
export function useUrlState<T extends string>(
  key: string,
  fallback: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [params, setParams] = useSearchParams()
  const raw = params.get(key)
  const value = (raw as T | null) ?? fallback

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved = typeof next === 'function' ? (next as (p: T) => T)(value) : next
      const draft = new URLSearchParams(params)
      if (resolved === fallback) draft.delete(key)
      else draft.set(key, resolved)
      setParams(draft, { replace: true })
    },
    [key, fallback, params, setParams, value],
  )

  return [value, setValue]
}

/** Read several params at once without subscribing to unrelated changes. */
export function useUrlParams(keys: readonly string[]): Record<string, string | null> {
  const [params] = useSearchParams()
  const out: Record<string, string | null> = {}
  for (const k of keys) out[k] = params.get(k)
  return out
}