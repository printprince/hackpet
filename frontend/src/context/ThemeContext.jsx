import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const THEME_KEY = 'hackpet_theme'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === 'undefined') return 'dark'
    // Тёмная тема — дефолт (cyber/DevSecOps); сохранённый выбор пользователя имеет приоритет.
    return localStorage.getItem(THEME_KEY) || 'dark'
  })

  const setTheme = useCallback((value) => {
    const next = value === 'dark' ? 'dark' : 'light'
    setThemeState(next)
    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_KEY, next)
      document.documentElement.setAttribute('data-theme', next)
    }
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const value = { theme, setTheme, isDark: theme === 'dark' }
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
