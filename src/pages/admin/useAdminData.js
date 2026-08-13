import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

export function useAdminData(loader) {
  const { t } = useTranslation('common')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        setHasError(false)
        const result = await loader()
        if (active) setData(result)
      } catch {
        if (active) {
          setHasError(true)
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    load()

    return () => {
      active = false
    }
  }, [loader, reloadKey])

  const reload = useCallback(() => {
    setLoading(true)
    setReloadKey((value) => value + 1)
  }, [])

  return {
    data,
    loading,
    error: hasError ? t('generic.loadAreaError') : '',
    reload,
  }
}
