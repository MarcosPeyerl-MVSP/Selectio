import {
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
import { chamarFirebaseFunction } from './firebaseFunctions'
import { finalizarIndicacaoValidada } from './indicacoesApi'
import {
  copiarFotoParaCandidatoIndicado,
  enviarFotoCandidato,
  removerFotoPerfil
} from './storageFotosPerfil'

const candidatosCollection = collection(db, 'candidatos')
const statusPermitidos = ['indicado', 'entrevista', 'contratado', 'cancelado', 'recusado']

const timestampToValue = (value) => {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate().toISOString()
  return value
}

const normalizeList = (value) => Array.isArray(value) ? value : []

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

// O servidor valida a analise e grava o processo atomicamente.
export const criarCandidatoIndicado = async ({ dados, indicador, vaga, candidatoPreSalvoId = '', arquivoFoto = null, analise }) => {
  if (!analise?.analiseId || !analise.resultado?.podeIndicar) {
    throw new Error('Analise a compatibilidade antes de finalizar a indicacao.')
  }
  const indicadorId = getFirebaseUid(indicador)
  const empresaId = vaga.empresaId || vaga.empresaUid
  const candidatoId = analise.analiseId
  const fotoPerfil = arquivoFoto
    ? await enviarFotoCandidato({ arquivo: arquivoFoto, indicadorId, candidatoId, tipoRegistro: 'indicados', empresaId })
    : await copiarFotoParaCandidatoIndicado({ foto: dados.fotoPerfil, indicadorId, candidatoId, empresaId })
  // Em falha de rede a transacao pode ter sido concluida. Repeticoes sao idempotentes.
  return finalizarIndicacaoValidada({
    analiseId: analise.analiseId, dados, vagaId: vaga.id, candidatoPreSalvoId,
    curriculoCaminho: analise.curriculoCaminho, fotoPerfil: fotoPerfil || {}
  })
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

  return chamarFirebaseFunction('/atualizar-status-candidato', {
    candidatoId,
    status,
    empresaId
  }, 'Não foi possível atualizar o status.')
}

export const atualizarFotoCandidatoIndicado = async ({ candidato, arquivo }) => {
  const candidatoId = String(candidato?.id || '')
  const indicadorId = String(candidato?.indicadorId || candidato?.indicadorUid || '')
  const empresaId = String(candidato?.empresaId || candidato?.empresaUid || '')
  if (!candidatoId || !indicadorId || !empresaId) throw new Error('Candidato invalido para atualizar a foto.')

  const fotoPerfil = await enviarFotoCandidato({
    arquivo,
    indicadorId,
    candidatoId,
    tipoRegistro: 'indicados',
    empresaId
  })

  try {
    await updateDoc(doc(db, 'candidatos', candidatoId), {
      fotoPerfil,
      atualizadoEm: serverTimestamp()
    })
  } catch (error) {
    await removerFotoPerfil(fotoPerfil.caminho).catch(() => {})
    throw error
  }

  await removerFotoPerfil(candidato.fotoPerfil?.caminho).catch(() => {})
  return fotoPerfil
}

export const removerFotoCandidatoIndicado = async (candidato) => {
  if (!candidato?.id) throw new Error('Candidato invalido para remover a foto.')
  await updateDoc(doc(db, 'candidatos', candidato.id), {
    fotoPerfil: {},
    atualizadoEm: serverTimestamp()
  })
  await removerFotoPerfil(candidato.fotoPerfil?.caminho).catch(() => {})
  return {}
}
