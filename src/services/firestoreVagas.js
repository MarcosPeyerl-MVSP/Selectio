import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore'
import { db } from './firebase'

const vagasCollection = collection(db, 'vagas')

const timestampToValue = (value) => {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate().toISOString()
  return value
}

const mapVagaDoc = (snapshot) => {
  if (!snapshot.exists()) return null

  const data = snapshot.data()

  return {
    id: snapshot.id,
    ...data,
    beneficios: Array.isArray(data.beneficios) ? data.beneficios : [],
    requisitos: Array.isArray(data.requisitos) ? data.requisitos : [],
    criadoEm: timestampToValue(data.criadoEm),
    atualizadoEm: timestampToValue(data.atualizadoEm)
  }
}

const sortByCreatedDesc = (a, b) => {
  const dateA = new Date(a.criadoEm || 0).getTime()
  const dateB = new Date(b.criadoEm || 0).getTime()
  return dateB - dateA
}

export const criarVaga = async (dados) => {
  const docRef = await addDoc(vagasCollection, {
    ...dados,
    beneficios: Array.isArray(dados.beneficios) ? dados.beneficios : [],
    requisitos: Array.isArray(dados.requisitos) ? dados.requisitos : [],
    destaqueBanner: Boolean(dados.destaqueBanner),
    bannerAtivo: Boolean(dados.bannerAtivo),
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp()
  })

  return docRef.id
}

export const listarVagas = async () => {
  const snapshot = await getDocs(query(vagasCollection, orderBy('criadoEm', 'desc')))
  return snapshot.docs.map(mapVagaDoc).filter(Boolean)
}

export const listarVagasBanner = async () => {
  const vagas = await listarVagas()
  const vagasBanner = vagas.filter((vaga) => vaga.bannerAtivo || vaga.destaqueBanner)

  return (vagasBanner.length ? vagasBanner : vagas).slice(0, 4)
}

export const buscarVagaPorId = async (id) => {
  if (!id) return null

  const snapshot = await getDoc(doc(db, 'vagas', id))
  return mapVagaDoc(snapshot)
}

export const editarVaga = async (id, dados) => {
  if (!id) {
    throw new Error('ID da vaga é obrigatório para editar.')
  }

  await updateDoc(doc(db, 'vagas', id), {
    ...dados,
    beneficios: Array.isArray(dados.beneficios) ? dados.beneficios : [],
    requisitos: Array.isArray(dados.requisitos) ? dados.requisitos : [],
    atualizadoEm: serverTimestamp()
  })

  return buscarVagaPorId(id)
}

export const listarVagasPorEmpresa = async (empresaId) => {
  if (!empresaId) return []

  const snapshot = await getDocs(query(vagasCollection, where('empresaId', '==', empresaId), limit(100)))
  return snapshot.docs.map(mapVagaDoc).filter(Boolean).sort(sortByCreatedDesc)
}
