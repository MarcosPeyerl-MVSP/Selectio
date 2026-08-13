import { useEffect, useState } from 'react'

const storageKey = 'selectioTheme'
const themes = ['light', 'dark']
const themeChangeEvent = 'selectio-theme-change'

const getStoredTheme = () => {
  if (typeof window === 'undefined') return 'light'

  const storedTheme = localStorage.getItem(storageKey)
  return themes.includes(storedTheme) ? storedTheme : 'light'
}

const applyTheme = (theme) => {
  if (typeof document === 'undefined') return

  document.documentElement.dataset.theme = theme
}

export function useTema() {
  const [theme, setTheme] = useState(() => {
    const initialTheme = getStoredTheme()
    applyTheme(initialTheme)
    return initialTheme
  })

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem(storageKey, theme)
  }, [theme])

  useEffect(() => {
    const syncTheme = (event) => {
      const nextTheme = event.type === 'storage' ? event.newValue : event.detail
      if (themes.includes(nextTheme)) setTheme(nextTheme)
    }

    window.addEventListener('storage', syncTheme)
    window.addEventListener(themeChangeEvent, syncTheme)

    return () => {
      window.removeEventListener('storage', syncTheme)
      window.removeEventListener(themeChangeEvent, syncTheme)
    }
  }, [])

  const changeTheme = (nextTheme) => {
    if (!themes.includes(nextTheme)) return

    setTheme(nextTheme)
    window.dispatchEvent(new CustomEvent(themeChangeEvent, { detail: nextTheme }))
  }

  const toggleTheme = () => {
    changeTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return {
    theme,
    isDark: theme === 'dark',
    changeTheme,
    toggleTheme
  }
}
