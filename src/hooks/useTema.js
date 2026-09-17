import { useEffect, useState } from 'react'

const storageKey = 'selectioTheme'
const themes = ['light', 'dark']
const darkThemes = ['dark']
const themeChangeEvent = 'selectio-theme-change'

const getStoredTheme = () => {
  if (typeof window === 'undefined') return 'light'

  try {
    const storedTheme = localStorage.getItem(storageKey)
    return themes.includes(storedTheme) ? storedTheme : 'light'
  } catch {
    return 'light'
  }
}

const applyTheme = (theme) => {
  if (typeof document === 'undefined') return

  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = darkThemes.includes(theme) ? 'dark' : 'light'
}

export function useTema() {
  const [theme, setTheme] = useState(() => {
    const initialTheme = getStoredTheme()
    applyTheme(initialTheme)
    return initialTheme
  })

  useEffect(() => {
    applyTheme(theme)
    try {
      localStorage.setItem(storageKey, theme)
    } catch {
      // The theme still works for the current session when storage is unavailable.
    }
  }, [theme])

  useEffect(() => {
    const syncTheme = (event) => {
      if (event.type === 'storage' && event.key !== storageKey) return

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
    changeTheme(darkThemes.includes(theme) ? 'light' : 'dark')
  }

  return {
    theme,
    isDark: darkThemes.includes(theme),
    changeTheme,
    toggleTheme
  }
}
