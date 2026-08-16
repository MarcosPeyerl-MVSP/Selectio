import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import { enviarFotoPerfilUsuario, removerFotoPerfil } from './storageFotosPerfil'

const collectionsByTipo = {
  empresa: 'empresas',
  indicador: 'indicadores'
}

export const isAdminProfile = (perfil) => (
  perfil?.tipo === 'admin'
  || perfil?.role === 'admin'
  || perfil?.papel === 'admin'
)

const getCollectionByTipo = (tipo) => {
  const collectionName = collectionsByTipo[tipo]

  if (!collectionName) {
    throw new Error('Tipo de usuário inválido para perfil no Firestore.')
  }

  return collectionName
}

export const salvarPerfilUsuario = async ({ uid, tipo, dados }) => {
  if (!uid) {
    throw new Error('UID do Firebase é obrigatório para salvar o perfil.')
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

const editableFieldsByTipo = {
  empresa: ['nomeEmpresa', 'telefone', 'site', 'setor', 'tamanho', 'endereco'],
  indicador: ['nome', 'telefone', 'pix', 'linkedin', 'portfolio', 'especialidades']
}

const pickEditableFields = ({ tipo, dados }) => {
  const allowedFields = editableFieldsByTipo[tipo] || []

  return allowedFields.reduce((payload, field) => {
    if (Object.prototype.hasOwnProperty.call(dados, field)) {
      payload[field] = dados[field]
    }

    return payload
  }, {})
}

export const atualizarPerfilUsuario = async ({ uid, tipo, dados }) => {
  if (!uid) {
    throw new Error('UID do Firebase é obrigatório para atualizar o perfil.')
  }

  const collectionName = getCollectionByTipo(tipo)
  const payload = pickEditableFields({ tipo, dados })

  await setDoc(doc(db, collectionName, uid), {
    ...payload,
    atualizadoEm: serverTimestamp()
  }, { merge: true })

  const userPayload = {}
  if (tipo === 'empresa' && payload.nomeEmpresa) userPayload.nome = payload.nomeEmpresa
  if (tipo === 'indicador' && payload.nome) userPayload.nome = payload.nome

  if (Object.keys(userPayload).length) {
    await setDoc(doc(db, 'users', uid), {
      ...userPayload,
      atualizadoEm: serverTimestamp()
    }, { merge: true })
  }

  return {
    ...payload,
    atualizadoEm: new Date().toISOString()
  }
}

export const atualizarFotoPerfilUsuario = async ({ uid, tipo, arquivo, fotoAtual }) => {
  if (!uid) throw new Error('UID do Firebase e obrigatorio para atualizar a foto.')

  const collectionName = getCollectionByTipo(tipo)
  const fotoPerfil = await enviarFotoPerfilUsuario({ arquivo, uid, tipoPerfil: tipo })

  try {
    await setDoc(doc(db, collectionName, uid), {
      fotoPerfil,
      atualizadoEm: serverTimestamp()
    }, { merge: true })
  } catch (error) {
    await removerFotoPerfil(fotoPerfil.caminho).catch(() => {})
    throw error
  }

  if (fotoAtual?.caminho && fotoAtual.caminho !== fotoPerfil.caminho) {
    await removerFotoPerfil(fotoAtual.caminho).catch(() => {})
  }

  return fotoPerfil
}

export const removerFotoPerfilUsuario = async ({ uid, tipo, fotoAtual }) => {
  if (!uid) throw new Error('UID do Firebase e obrigatorio para remover a foto.')

  const collectionName = getCollectionByTipo(tipo)
  await setDoc(doc(db, collectionName, uid), {
    fotoPerfil: {},
    atualizadoEm: serverTimestamp()
  }, { merge: true })
  await removerFotoPerfil(fotoAtual?.caminho).catch(() => {})
  return {}
}

export const atualizarSetoresEmpresariais = async ({ uid, setoresEmpresariais }) => {
  if (!uid) {
    throw new Error('UID do Firebase Ã© obrigatÃ³rio para atualizar os setores empresariais.')
  }

  await setDoc(doc(db, 'empresas', uid), {
    setoresEmpresariais,
    atualizadoEm: serverTimestamp()
  }, { merge: true })

  return {
    setoresEmpresariais,
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

  if (isAdminProfile(userData)) {
    return {
      ...userData,
      id: uid,
      uid,
      firebaseUid: uid,
      tipo: 'admin'
    }
  }

  const collectionName = getCollectionByTipo(tipo)
  const perfilSnapshot = await getDoc(doc(db, collectionName, uid))

  if (!perfilSnapshot.exists()) {
    return null
  }

  const perfilData = perfilSnapshot.data()

  return {
    ...userData,
    ...perfilData,
    id: perfilData.id || uid,
    uid,
    firebaseUid: uid,
    tipo
  }
}

export const definirTourUsuarioConcluido = async ({ uid, tipo, concluido }) => {
  if (!uid) {
    throw new Error('UID do Firebase é obrigatório para atualizar o tour.')
  }

  const field = tipo === 'empresa'
    ? 'tourEmpresaConcluido'
    : 'tourIndicadorConcluido'
  const onboardingField = tipo === 'empresa'
    ? 'empresaConcluido'
    : 'indicadorConcluido'

  await setDoc(doc(db, 'users', uid), {
    [field]: Boolean(concluido),
    onboardingTour: {
      [onboardingField]: Boolean(concluido)
    },
    atualizadoEm: serverTimestamp()
  }, { merge: true })

  return {
    [field]: Boolean(concluido)
  }
}

export const marcarTourUsuarioConcluido = ({ uid, tipo }) => (
  definirTourUsuarioConcluido({ uid, tipo, concluido: true })
)

export const buscarTipoUsuario = async (uid) => {
  if (!uid) return null

  const userSnapshot = await getDoc(doc(db, 'users', uid))

  if (!userSnapshot.exists()) {
    return null
  }

  const userData = userSnapshot.data()

  return isAdminProfile(userData) ? 'admin' : userData.tipo || null
}
