export const isNumericId = (value) => /^\d+$/.test(String(value ?? '').trim())

export const getFirebaseUid = (user) => {
  if (!user) return ''

  if (user.firebaseUid) return user.firebaseUid
  if (user.uid) return user.uid

  return isNumericId(user.id) ? '' : String(user.id || '')
}

export const getLegacyId = (user) => {
  if (!user) return null

  const candidates = [
    user.sqliteId,
    user.legacyId,
    user.localId,
    user.id
  ]

  const legacyId = candidates.find(isNumericId)
  return legacyId ? Number(legacyId) : null
}

export const canUseLegacyBackend = (user) => Boolean(getLegacyId(user))
