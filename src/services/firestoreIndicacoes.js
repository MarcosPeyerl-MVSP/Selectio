import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  writeBatch,
  where
} from 'firebase/firestore'
import { db } from './firebase'

const indicacoesCollection = collection(db, 'indicacoes')

const timestampToValue = (value) => {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate().toISOString()
  return value
}

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

const normalizeRewardValue = (dados) => {
  const numericValue = Number(dados.recompensaValorFixo || dados.recompensaValor || 0)
  if (Number.isFinite(numericValue) && numericValue > 0) return numericValue

  return isFixedRewardText(dados.recompensa) ? parseMoneyValue(dados.recompensa) : null
}

const mapIndicacaoDoc = (snapshot) => {
  if (!snapshot.exists()) return null

  const data = snapshot.data()

  return {
    id: snapshot.id,
    ...data,
    recompensaValor: normalizeRewardValue(data),
    criadoEm: timestampToValue(data.criadoEm),
    atualizadoEm: timestampToValue(data.atualizadoEm)
  }
}

const sortByCreatedDesc = (a, b) => {
  const dateA = new Date(a.criadoEm || 0).getTime()
  const dateB = new Date(b.criadoEm || 0).getTime()
  return dateB - dateA
}

const montarIndicacao = (dados) => ({
  ...dados,
  status: dados.status || 'indicado',
  recompensaValor: normalizeRewardValue(dados),
  criadoEm: serverTimestamp(),
  atualizadoEm: serverTimestamp()
})

export const adicionarIndicacaoAoBatch = (batch, dados, indicacaoId = '') => {
  const docRef = indicacaoId
    ? doc(indicacoesCollection, indicacaoId)
    : doc(indicacoesCollection)

  batch.set(docRef, montarIndicacao(dados))
  return docRef
}

export const registrarIndicacao = async (dados) => {
  const batch = writeBatch(db)
  const docRef = adicionarIndicacaoAoBatch(batch, dados)

  await batch.commit()
  return docRef.id
}

export const adicionarStatusIndicacaoAoBatch = async ({
  batch,
  candidatoId,
  status,
  empresaId,
  indicadorId
}) => {
  if (!candidatoId) return

  if (!empresaId && !indicadorId) {
    throw new Error('UID do dono é obrigatório para atualizar a indicação.')
  }

  const donoFiltro = empresaId
    ? where('empresaId', '==', empresaId)
    : where('indicadorId', '==', indicadorId)

  const snapshot = await getDocs(query(
    indicacoesCollection,
    where('candidatoId', '==', candidatoId),
    donoFiltro,
    limit(10)
  ))

  snapshot.docs.forEach((indicacaoDoc) => {
    batch.update(indicacaoDoc.ref, {
      status,
      atualizadoEm: serverTimestamp()
    })
  })
}

export const atualizarStatusIndicacaoPorCandidato = async (dados) => {
  const batch = writeBatch(db)

  await adicionarStatusIndicacaoAoBatch({
    batch,
    ...dados
  })
  await batch.commit()
}

export const listarIndicacoesPorIndicador = async (indicadorId) => {
  if (!indicadorId) return []

  const snapshot = await getDocs(query(indicacoesCollection, where('indicadorId', '==', indicadorId), limit(200)))
  return snapshot.docs.map(mapIndicacaoDoc).filter(Boolean).sort(sortByCreatedDesc)
}

export const buscarStatusIndicador = async (indicadorId) => {
  const indicacoes = await listarIndicacoesPorIndicador(indicadorId)
  const totalIndicacoes = indicacoes.length
  const vagasSucesso = indicacoes.filter((indicacao) => indicacao.status === 'contratado').length
  const vagasCanceladas = indicacoes.filter((indicacao) => ['cancelado', 'recusado'].includes(indicacao.status)).length
  const vagasAtivas = indicacoes.filter((indicacao) => !['contratado', 'cancelado', 'recusado'].includes(indicacao.status)).length
  const valorRecebido = indicacoes
    .filter((indicacao) => indicacao.status === 'contratado')
    .reduce((total, indicacao) => total + Number(indicacao.recompensaValor || 0), 0)
  const valorPendente = indicacoes
    .filter((indicacao) => !['contratado', 'cancelado', 'recusado'].includes(indicacao.status))
    .reduce((total, indicacao) => total + Number(indicacao.recompensaValor || 0), 0)

  return {
    totalIndicacoes,
    vagasAtivas,
    vagasCanceladas,
    vagasSucesso,
    valorRecebido,
    valorPendente,
    taxaSucesso: totalIndicacoes ? Number(((vagasSucesso * 100) / totalIndicacoes).toFixed(1)) : 0
  }
}
