import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type Theme = 'dark' | 'light' | 'system'
export type ResolvedTheme = 'dark' | 'light'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  /** What the user picked. */
  theme: Theme
  /** What is on screen: "system" resolved against the OS setting. */
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

/** Browser chrome colour (address bar, iOS status bar) for each theme: the app ground, see --ground in journal.css. */
const CHROME: Record<ResolvedTheme, string> = { dark: '#171719', light: '#f4f4f6' }

const initialState: ThemeProviderState = {
  theme: 'dark',
  resolvedTheme: 'dark',
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

const isTheme = (v: unknown): v is Theme => v === 'dark' || v === 'light' || v === 'system'

function readStored(key: string): Theme | null {
  try {
    const v = window.localStorage.getItem(key)
    return isTheme(v) ? v : null
  } catch {
    return null
  }
}

const resolve = (theme: Theme): ResolvedTheme =>
  theme === 'system' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : theme

/** Same work as the inline script in index.html, which runs it before first paint. */
function apply(resolved: ResolvedTheme) {
  const root = window.document.documentElement
  root.dataset.theme = resolved
  root.classList.remove('light', 'dark')
  root.classList.add(resolved)
  root.style.colorScheme = resolved
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', CHROME[resolved])
  document
    .querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
    ?.setAttribute('content', resolved === 'light' ? 'default' : 'black-translucent')
}

export function ThemeProvider({
  children,
  defaultTheme = 'dark',
  storageKey = 'ifvg-journal-theme',
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => readStored(storageKey) ?? defaultTheme)
  const [resolvedTheme, setResolved] = useState<ResolvedTheme>(() => resolve(theme))

  // Follow the OS only while the choice is "system".
  useEffect(() => {
    const update = () => setResolved(resolve(theme))
    update()
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [theme])

  useEffect(() => apply(resolvedTheme), [resolvedTheme])

  // Another tab changed the preference.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) setThemeState(isTheme(e.newValue) ? e.newValue : defaultTheme)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [storageKey, defaultTheme])

  const setTheme = useCallback(
    (next: Theme) => {
      try {
        window.localStorage.setItem(storageKey, next)
      } catch {
        /* storage blocked (private mode): the choice still holds for this visit */
      }
      setThemeState(next)
    },
    [storageKey],
  )

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme])

  return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider')

  return context
}
