import { useEffect, useState } from 'react'

const storageKey = 'selectioTheme'
const themes = ['light', 'dark']

const getStoredTheme = () => {
  if (typeof window === 'undefined') return 'light'

  const storedTheme = localStorage.getItem(storageKey)
  return themes.includes(storedTheme) ? storedTheme : 'light'
}

const applyTheme = (theme) => {
  if (typeof document === 'undefined') return

  document.documentElement.dataset.theme = theme
}

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const initialTheme = getStoredTheme()
    applyTheme(initialTheme)
    return initialTheme
  })

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem(storageKey, theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((currentTheme) => currentTheme === 'dark' ? 'light' : 'dark')
  }

  return {
    theme,
    isDark: theme === 'dark',
    toggleTheme
  }
}
