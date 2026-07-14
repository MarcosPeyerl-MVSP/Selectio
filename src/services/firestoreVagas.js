import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where
} from 'firebase/firestore'
import { db } from './firebase'

const vagasCollection = collection(db, 'vagas')

export const statusVagaLabels = {
  aberta: 'Aberta',
  pausada: 'Pausada',
  encerrada: 'Encerrada',
  expirada: 'Expirada'
}

export const statusAprovacaoVagaLabels = {
  solicitada: 'Aguardando auditoria',
  devolvida: 'Devolvida ao departamento',
  aprovada: 'Aprovada para RH',
  publicada: 'Publicada pelo RH'
}

const timestampToValue = (value) => {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate().toISOString()
  return value
}

const mapVagaDoc = (snapshot) => {
  if (!snapshot.exists()) return null

  const data = snapshot.data()

  const vaga = {
    id: snapshot.id,
    ...data,
    beneficios: Array.isArray(data.beneficios) ? data.beneficios : [],
    requisitos: Array.isArray(data.requisitos) ? data.requisitos : [],
    criadoEm: timestampToValue(data.criadoEm),
    atualizadoEm: timestampToValue(data.atualizadoEm),
    expiraEm: timestampToValue(data.expiraEm)
  }

  return {
    ...vaga,
    status: obterStatusVaga(vaga)
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
    status: dados.status || 'aberta',
    dataLimite: dados.dataLimite || '',
    expiraEm: criarTimestampExpiracao(dados.dataLimite),
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
  const vagas = (await listarVagas()).filter(vagaAceitaIndicacoes)
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
    status: dados.status || 'aberta',
    dataLimite: dados.dataLimite || '',
    expiraEm: criarTimestampExpiracao(dados.dataLimite),
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

export const atualizarStatusVaga = async ({ vagaId, status }) => {
  if (!vagaId || !['aberta', 'pausada', 'encerrada'].includes(status)) {
    throw new Error('Status de vaga inválido.')
  }

  await updateDoc(doc(db, 'vagas', vagaId), {
    status,
    atualizadoEm: serverTimestamp()
  })

  return status
}

export const atualizarFluxoAprovacaoVaga = async ({
  vagaId,
  statusAprovacao,
  status,
  comentario = '',
  setor = '',
  usuario = ''
}) => {
  if (!vagaId || !statusAprovacao) {
    throw new Error('Dados de aprovaÃ§Ã£o da vaga invÃ¡lidos.')
  }

  const payload = {
    statusAprovacao,
    atualizadoEm: serverTimestamp()
  }

  if (status) payload.status = status
  if (comentario.trim()) payload.comentarioAuditoria = comentario.trim()

  payload.historicoAprovacao = arrayUnion({
    statusAprovacao,
    comentario: comentario.trim(),
    setor,
    usuario,
    criadoEm: new Date().toISOString()
  })

  await updateDoc(doc(db, 'vagas', vagaId), payload)

  return {
    statusAprovacao,
    status
  }
}

export function obterStatusVaga(vaga) {
  const statusSalvo = vaga?.status || 'aberta'

  if (statusSalvo === 'aberta' && vagaEstaExpirada(vaga)) {
    return 'expirada'
  }

  return statusSalvo
}

export function vagaAceitaIndicacoes(vaga) {
  return obterStatusVaga(vaga) === 'aberta'
}

function vagaEstaExpirada(vaga) {
  const limite = vaga?.expiraEm || vaga?.dataLimite
  if (!limite) return false

  const data = typeof limite === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(limite)
    ? new Date(`${limite}T23:59:59`)
    : new Date(limite)

  return !Number.isNaN(data.getTime()) && data.getTime() < Date.now()
}

function criarTimestampExpiracao(dataLimite) {
  if (!dataLimite) return null

  const data = new Date(`${dataLimite}T23:59:59`)
  return Number.isNaN(data.getTime()) ? null : Timestamp.fromDate(data)
}
