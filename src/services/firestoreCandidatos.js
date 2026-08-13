import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  writeBatch,
  where
} from 'firebase/firestore'
import { db } from './firebase'
import { getFirebaseUid } from './identidadeFirebase'
import {
  adicionarIndicacaoAoBatch,
  adicionarStatusIndicacaoAoBatch,
  listarIndicacoesPorIndicador
} from './firestoreIndicacoes'
import { buscarCandidatoPreSalvoPorId } from './firestoreCandidatosPreSalvos'
import { adicionarHistoricoAoBatch } from './firestoreHistorico'
import {
  notificarNovoCandidatoIndicado,
  notificarStatusCandidatoAlterado
} from './firestoreNotificacoes'
import { vagaAceitaIndicacoes } from './firestoreVagas'

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

const isFixedRewardText = (value) => {
  const text = String(value || '').trim()

  return Boolean(text)
    && !/%|percent|sal[aá]rio|combinar|consultar|a definir|sob consulta/i.test(text)
    && /^(r\$\s*)?\d[\d.\s]*(,\d{1,2})?$/i.test(text)
}

const getFixedRewardValue = (vaga) => {
  if (vaga?.recompensaTipo && vaga.recompensaTipo !== 'fixo') return null

  const numericValue = Number(vaga?.recompensaValorFixo || 0)
  if (Number.isFinite(numericValue) && numericValue > 0) return numericValue

  return isFixedRewardText(vaga?.recompensa) ? parseMoneyValue(vaga.recompensa) : null
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

const getIndicacaoPreSalvaId = ({ candidatoPreSalvoId, indicadorId, vagaId }) => (
  `${indicadorId}__${vagaId}__${candidatoPreSalvoId}`
)

const erroIndicacaoPreSalvaDuplicada = () => (
  new Error('Este candidato já foi indicado para esta vaga.')
)

export const criarCandidatoIndicado = async ({
  dados,
  indicador,
  vaga,
  candidatoPreSalvoId = ''
}) => {
  const indicadorId = getFirebaseUid(indicador)
  const empresaId = getEmpresaUidFromVaga(vaga)
  const preSalvoId = String(candidatoPreSalvoId || '').trim()

  if (!indicadorId) {
    throw new Error('UID do indicador e obrigatório para criar candidato.')
  }

  if (!vaga?.id || !empresaId) {
    throw new Error('Vaga e empresa da vaga são obrigatórias para criar candidato.')
  }

  if (!vagaAceitaIndicacoes(vaga)) {
    throw new Error('Esta vaga não está aberta para novas indicações.')
  }

  if (preSalvoId) {
    const candidatoPreSalvo = await buscarCandidatoPreSalvoPorId({
      candidatoId: preSalvoId,
      indicadorId
    })

    if (!candidatoPreSalvo) {
      throw new Error('Candidato pré-salvo não encontrado.')
    }

    const indicacoes = await listarIndicacoesPorIndicador(indicadorId)
    const jaIndicado = indicacoes.some((indicacao) => (
      indicacao.candidatoPreSalvoId === preSalvoId
      && indicacao.vagaId === vaga.id
    ))

    if (jaIndicado) {
      throw erroIndicacaoPreSalvaDuplicada()
    }
  }

  const recompensaValor = getFixedRewardValue(vaga)
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
    recompensaTipo: vaga.recompensaTipo || (recompensaValor ? 'fixo' : 'personalizado'),
    recompensaValor,
    recompensaValorFixo: recompensaValor,
    status: 'indicado',
    origem: getOrigem(dados),
    ...(preSalvoId ? { candidatoPreSalvoId: preSalvoId } : {}),
    aplicadoEm: serverTimestamp(),
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp()
  }

  const candidatoRef = doc(candidatosCollection)
  const batch = writeBatch(db)

  batch.set(candidatoRef, candidato)
  const indicacaoId = preSalvoId
    ? getIndicacaoPreSalvaId({
        candidatoPreSalvoId: preSalvoId,
        indicadorId,
        vagaId: vaga.id
      })
    : ''

  adicionarIndicacaoAoBatch(batch, {
    candidatoId: candidatoRef.id,
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
    recompensaTipo: vaga.recompensaTipo || (recompensaValor ? 'fixo' : 'personalizado'),
    recompensaValor,
    recompensaValorFixo: recompensaValor,
    status: 'indicado',
    ...(preSalvoId ? { candidatoPreSalvoId: preSalvoId } : {})
  }, indicacaoId)
  adicionarHistoricoAoBatch(batch, {
    candidatoId: candidatoRef.id,
    candidatoNome: dados.nome || '',
    vagaId: vaga.id,
    vagaTitulo: vaga.titulo || '',
    empresaId,
    indicadorId,
    tipo: 'indicacao_criada',
    titulo: 'Indicação enviada',
    tituloKey: 'notifications.messages.referralSentTitle',
    descricao: `${dados.nome || 'Candidato'} foi indicado para ${vaga.titulo || 'a vaga'}.`,
    descricaoKey: 'candidateProfile.historyEvents.referralCreated',
    descricaoParams: {
      candidate: dados.nome || '',
      job: vaga.titulo || ''
    },
    statusAtual: 'indicado',
    criadoPor: indicadorId
  })
  try {
    await batch.commit()
  } catch (error) {
    if (preSalvoId && error?.code === 'permission-denied') {
      throw erroIndicacaoPreSalvaDuplicada()
    }

    throw error
  }

  const now = new Date().toISOString()
  const candidatoCriado = {
    ...candidato,
    id: candidatoRef.id,
    aplicadoEm: now,
    criadoEm: now,
    atualizadoEm: now
  }

  await notificarNovoCandidatoIndicado(candidatoCriado)

  return candidatoCriado
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

  const batch = writeBatch(db)

  batch.update(doc(db, 'candidatos', candidatoId), {
    status,
    atualizadoEm: serverTimestamp()
  })
  await adicionarStatusIndicacaoAoBatch({
    batch,
    candidatoId,
    status,
    empresaId
  })
  adicionarHistoricoAoBatch(batch, {
    candidatoId,
    candidatoNome: candidato.nome || '',
    vagaId: candidato.vagaId || '',
    vagaTitulo: candidato.vagaTitulo || '',
    empresaId,
    indicadorId: candidato.indicadorId || candidato.indicadorUid || '',
    tipo: 'status_alterado',
    titulo: status === 'contratado'
      ? 'Candidato contratado'
      : status === 'recusado'
        ? 'Candidato recusado'
        : status === 'cancelado'
          ? 'Processo cancelado'
        : 'Status do candidato atualizado',
    tituloKey: status === 'contratado'
      ? 'notifications.messages.candidate.contratadoTitle'
      : status === 'recusado'
        ? 'notifications.messages.candidate.recusadoTitle'
        : status === 'cancelado'
          ? 'notifications.messages.candidate.canceladoTitle'
          : 'candidateProfile.historyEvents.candidateStatusTitle',
    descricao: `Status alterado de ${candidato.status || 'indicado'} para ${status}.`,
    descricaoKey: 'candidateProfile.historyEvents.statusChanged',
    descricaoParams: {
      fromStatus: candidato.status || 'indicado',
      toStatus: status
    },
    statusAnterior: candidato.status || 'indicado',
    statusAtual: status,
    criadoPor: empresaId
  })
  await batch.commit()

  const candidatoAtualizado = {
    ...candidato,
    status,
    atualizadoEm: new Date().toISOString()
  }

  await notificarStatusCandidatoAlterado({
    candidato: candidatoAtualizado,
    statusAnterior: candidato.status || 'indicado',
    statusAtual: status
  })

  return candidatoAtualizado
}
