const isNumericValue = (value) => /^\d+$/.test(String(value ?? '').trim())

export const getFirebaseUid = (user) => {
  if (!user) return ''

  if (user.firebaseUid) return String(user.firebaseUid)
  if (user.uid) return String(user.uid)

  return isNumericValue(user.id) ? '' : String(user.id || '')
}

export const hasFirebaseUid = (user) => Boolean(getFirebaseUid(user))

export const getStoredUser = (key) => {
  const stored = localStorage.getItem(key)
  if (!stored) return null

  try {
    return JSON.parse(stored)
  } catch {
    localStorage.removeItem(key)
    return null
  }
}

export const getCurrentEmpresaUser = () => getStoredUser('empresaUser')

export const getCurrentIndicadorUser = () => getStoredUser('indicadorUser')
