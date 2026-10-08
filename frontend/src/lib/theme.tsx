import type { ReactNode } from 'react'
import { useTheme, setGlobalTheme, type Theme } from '../hooks/use-theme'

/**
 * Compatibility exports for older imports. Theme state is owned by hooks/use-theme.
 */
export { useTheme, setGlobalTheme }
export type { Theme }

export function ThemeProvider({ children }: { children: ReactNode }) {
  return children
}