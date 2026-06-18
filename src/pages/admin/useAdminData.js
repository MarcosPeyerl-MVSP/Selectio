import { useCallback, useEffect, useState } from 'react'

export function useAdminData(loader) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        setError('')
        const result = await loader()
        if (active) setData(result)
      } catch (loadError) {
        if (active) {
          setError(loadError.message || 'Não foi possível carregar os dados administrativos.')
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

  return { data, loading, error, reload }
}
