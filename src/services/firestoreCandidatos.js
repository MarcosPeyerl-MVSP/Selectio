import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore'
import { db } from './firebase'
import { getFirebaseUid } from './identidadeFirebase'
import { atualizarStatusIndicacaoPorCandidato, registrarIndicacao } from './firestoreIndicacoes'

const candidatosCollection = collection(db, 'candidatos')
const statusPermitidos = ['indicado', 'entrevista', 'contratado', 'cancelado', 'recusado']

const timestampToValue = (value) => {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate().toISOString()
  return value
}

const normalizeList = (value) => Array.isArray(value) ? value : []

const parseMoneyValue = (value) => {
  const normalized = String(value || '')
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')

  return Number(normalized || 0)
}

const getOrigem = (dados) => {
  if (dados.linkedin) return 'LinkedIn'
  if (dados.portfolio) return 'Portfolio'
  if (dados.github) return 'GitHub'
  return 'Indicação'
}

const mapCandidatoDoc = (snapshot) => {
  if (!snapshot.exists()) return null

  const data = snapshot.data()
  const criadoEm = timestampToValue(data.criadoEm)

  return {
    id: snapshot.id,
    ...data,
    hardSkills: normalizeList(data.hardSkills),
    softSkills: normalizeList(data.softSkills),
    status: data.status || 'indicado',
    origem: data.origem || getOrigem(data),
    aplicadoEm: timestampToValue(data.aplicadoEm) || criadoEm,
    criadoEm,
    atualizadoEm: timestampToValue(data.atualizadoEm)
  }
}

const sortByCreatedDesc = (a, b) => {
  const dateA = new Date(a.criadoEm || a.aplicadoEm || 0).getTime()
  const dateB = new Date(b.criadoEm || b.aplicadoEm || 0).getTime()
  return dateB - dateA
}

const getEmpresaUidFromVaga = (vaga) => String(vaga?.empresaId || vaga?.empresaUid || '')

export const criarCandidatoIndicado = async ({ dados, indicador, vaga }) => {
  const indicadorId = getFirebaseUid(indicador)
  const empresaId = getEmpresaUidFromVaga(vaga)

  if (!indicadorId) {
    throw new Error('UID do indicador e obrigatório para criar candidato.')
  }

  if (!vaga?.id || !empresaId) {
    throw new Error('Vaga e empresa da vaga são obrigatórias para criar candidato.')
  }

  const recompensaValor = parseMoneyValue(vaga.recompensa)
  const candidato = {
    ...dados,
    hardSkills: normalizeList(dados.hardSkills),
    softSkills: normalizeList(dados.softSkills),
    indicadorId,
    indicadorUid: indicadorId,
    indicadorNome: indicador?.nome || indicador?.nomeCompleto || '',
    vagaId: vaga.id,
    vagaTitulo: vaga.titulo || '',
    vagaEmpresa: vaga.empresa || '',
    empresaId,
    empresaUid: empresaId,
    recompensa: vaga.recompensa || '',
    recompensaValor,
    status: 'indicado',
    origem: getOrigem(dados),
    aplicadoEm: serverTimestamp(),
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp()
  }

  const docRef = await addDoc(candidatosCollection, candidato)

  await registrarIndicacao({
    candidatoId: docRef.id,
    candidatoNome: dados.nome || '',
    indicadorId,
    indicadorUid: indicadorId,
    indicadorNome: candidato.indicadorNome,
    vagaId: vaga.id,
    vagaTitulo: vaga.titulo || '',
    vagaEmpresa: vaga.empresa || '',
    empresaId,
    empresaUid: empresaId,
    recompensa: vaga.recompensa || '',
    recompensaValor,
    status: 'indicado'
  })

  const now = new Date().toISOString()

  return {
    ...candidato,
    id: docRef.id,
    aplicadoEm: now,
    criadoEm: now,
    atualizadoEm: now
  }
}

export const listarCandidatosPorIndicador = async (indicadorId) => {
  if (!indicadorId) return []

  const snapshot = await getDocs(query(candidatosCollection, where('indicadorId', '==', indicadorId), limit(100)))
  return snapshot.docs.map(mapCandidatoDoc).filter(Boolean).sort(sortByCreatedDesc)
}

export const listarCandidatosPorEmpresa = async (empresaId) => {
  if (!empresaId) return []

  const snapshot = await getDocs(query(candidatosCollection, where('empresaId', '==', empresaId), limit(100)))
  return snapshot.docs.map(mapCandidatoDoc).filter(Boolean).sort(sortByCreatedDesc)
}

export const buscarCandidatoPorId = async (id) => {
  if (!id) return null

  const snapshot = await getDoc(doc(db, 'candidatos', id))
  return mapCandidatoDoc(snapshot)
}

export const atualizarStatusCandidato = async ({ candidatoId, status, empresaId }) => {
  if (!candidatoId) {
    throw new Error('ID do candidato e obrigatório para atualizar status.')
  }

  if (!statusPermitidos.includes(status)) {
    throw new Error('Status de candidato inválido.')
  }

  const candidato = await buscarCandidatoPorId(candidatoId)

  if (!candidato) {
    throw new Error('Candidato não encontrado.')
  }

  const candidatoEmpresaId = String(candidato.empresaId || candidato.empresaUid || '')

  if (!empresaId || candidatoEmpresaId !== String(empresaId)) {
    throw new Error('Esta empresa não pode alterar este candidato.')
  }

  await updateDoc(doc(db, 'candidatos', candidatoId), {
    status,
    atualizadoEm: serverTimestamp()
  })

  await atualizarStatusIndicacaoPorCandidato({ candidatoId, status, empresaId })

  return {
    ...candidato,
    status,
    atualizadoEm: new Date().toISOString()
  }
}
