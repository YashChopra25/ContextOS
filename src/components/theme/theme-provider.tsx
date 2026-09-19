"use client"

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react"

export type Theme = "light" | "dark" | "system"

const STORAGE_KEY = "theme"
const listeners = new Set<() => void>()

export const themeInitScript = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}")||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light"}catch(e){}})()`

function readTheme(): Theme {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === "light" || value === "dark" ? value : "system"
  } catch {
    return "system"
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback)
  const media = window.matchMedia("(prefers-color-scheme: dark)")
  media.addEventListener("change", callback)
  window.addEventListener("storage", callback)
  return () => {
    listeners.delete(callback)
    media.removeEventListener("change", callback)
    window.removeEventListener("storage", callback)
  }
}

function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  document.documentElement.classList.toggle("dark", dark)
  document.documentElement.style.colorScheme = dark ? "dark" : "light"
  return dark ? "dark" : "light"
}

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: "light" | "dark"
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as Theme)
  const systemDark = useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => false,
  )
  const resolvedTheme = theme === "dark" || (theme === "system" && systemDark) ? "dark" : "light"

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Storage can be unavailable (private mode); the theme still applies for this page.
    }
    applyTheme(next)
    listeners.forEach((listener) => listener())
  }, [])

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }) as ThemeContextValue, [theme, resolvedTheme, setTheme])
  return <ThemeContext value={value}>{children}</ThemeContext>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error("useTheme must be used inside ThemeProvider")
  return context
}
