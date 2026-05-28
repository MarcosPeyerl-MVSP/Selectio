import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase'

const collectionsByTipo = {
  empresa: 'empresas',
  indicador: 'indicadores'
}

const getCollectionByTipo = (tipo) => {
  const collectionName = collectionsByTipo[tipo]

  if (!collectionName) {
    throw new Error('Tipo de usuario invalido para perfil no Firestore.')
  }

  return collectionName
}

export const salvarPerfilUsuario = async ({ uid, tipo, dados }) => {
  if (!uid) {
    throw new Error('UID do Firebase e obrigatorio para salvar o perfil.')
  }

  const collectionName = getCollectionByTipo(tipo)
  const perfil = {
    ...dados,
    id: dados?.id || uid,
    uid,
    firebaseUid: uid,
    tipo,
    atualizadoEm: serverTimestamp()
  }

  await setDoc(doc(db, 'users', uid), {
    uid,
    tipo,
    email: dados?.email || '',
    nome: dados?.nome || dados?.nomeEmpresa || '',
    atualizadoEm: serverTimestamp()
  }, { merge: true })

  await setDoc(doc(db, collectionName, uid), perfil, { merge: true })

  return {
    ...perfil,
    atualizadoEm: new Date().toISOString()
  }
}

export const buscarPerfilUsuario = async (uid) => {
  if (!uid) return null

  const userSnapshot = await getDoc(doc(db, 'users', uid))

  if (!userSnapshot.exists()) {
    return null
  }

  const userData = userSnapshot.data()
  const tipo = userData.tipo
  const collectionName = getCollectionByTipo(tipo)
  const perfilSnapshot = await getDoc(doc(db, collectionName, uid))

  if (!perfilSnapshot.exists()) {
    return null
  }

  const perfilData = perfilSnapshot.data()

  return {
    ...perfilData,
    id: perfilData.id || uid,
    uid,
    firebaseUid: uid,
    tipo
  }
}

export const buscarTipoUsuario = async (uid) => {
  if (!uid) return null

  const userSnapshot = await getDoc(doc(db, 'users', uid))

  if (!userSnapshot.exists()) {
    return null
  }

  return userSnapshot.data().tipo || null
}
