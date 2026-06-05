import { createContext, useContext, useEffect, useState } from 'react'
import { userPreferences } from '@/utils/secureStorage'

type Theme = 'dark' | 'light' | 'system'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: 'dark',
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = 'dark',
  storageKey = 'ifvg-journal-theme',
  ...props
}: ThemeProviderProps) {
  // IFVG Journal is dark-first like ifvg.in — lock to dark.
  const [theme, setTheme] = useState<Theme>('dark')
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add('dark')
  }, [theme])

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      userPreferences.setTheme(theme);
      setTheme(theme);
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider')

  return context
}