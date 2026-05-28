import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'

import { db, functions } from './firebase'

const pagamentosCollection = collection(db, 'pagamentos')
const movimentacoesCollection = collection(db, 'movimentacoesFinanceiras')

const converterTimestamp = (valor) => {
  if (!valor) return null
  if (typeof valor.toDate === 'function') return valor.toDate().toISOString()
  return valor
}

const mapearDocumento = (documento) => {
  if (!documento.exists()) return null

  const dados = documento.data()

  return {
    id: documento.id,
    ...dados,
    criadoEm: converterTimestamp(dados.criadoEm),
    atualizadoEm: converterTimestamp(dados.atualizadoEm),
    aprovadoEm: converterTimestamp(dados.aprovadoEm),
    solicitadoEm: converterTimestamp(dados.solicitadoEm)
  }
}

const ordenarPorCriacao = (a, b) => {
  const dataA = new Date(a.criadoEm || a.solicitadoEm || 0).getTime()
  const dataB = new Date(b.criadoEm || b.solicitadoEm || 0).getTime()

  return dataB - dataA
}

export const criarPagamentoRecompensa = async (payload) => {
  const criarPreferencia = httpsCallable(functions, 'createMercadoPagoPreference')
  const resultado = await criarPreferencia(payload)

  return resultado.data
}

export const listarPagamentosPorEmpresa = async (empresaId) => {
  if (!empresaId) return []

  const documentos = await getDocs(query(
    pagamentosCollection,
    where('empresaId', '==', empresaId),
    limit(100)
  ))

  return documentos.docs.map(mapearDocumento).filter(Boolean).sort(ordenarPorCriacao)
}

export const listarPagamentosPorIndicador = async (indicadorId) => {
  if (!indicadorId) return []

  const documentos = await getDocs(query(
    pagamentosCollection,
    where('indicadorId', '==', indicadorId),
    limit(100)
  ))

  return documentos.docs.map(mapearDocumento).filter(Boolean).sort(ordenarPorCriacao)
}

export const buscarSaldoIndicador = async (indicadorId) => {
  if (!indicadorId) {
    return {
      indicadorId: '',
      saldoDisponivel: 0,
      saldoPendente: 0,
      totalRecebido: 0,
      totalSacado: 0
    }
  }

  const documento = await getDoc(doc(db, 'indicadorSaldos', indicadorId))

  if (!documento.exists()) {
    return {
      indicadorId,
      saldoDisponivel: 0,
      saldoPendente: 0,
      totalRecebido: 0,
      totalSacado: 0
    }
  }

  return mapearDocumento(documento)
}

export const listarMovimentacoesIndicador = async (indicadorId) => {
  if (!indicadorId) return []

  const documentos = await getDocs(query(
    movimentacoesCollection,
    where('indicadorId', '==', indicadorId),
    limit(100)
  ))

  return documentos.docs.map(mapearDocumento).filter(Boolean).sort(ordenarPorCriacao)
}

export const solicitarSaqueIndicador = async ({ indicadorId, valor, chavePix, observacao }) => {
  const solicitarSaque = httpsCallable(functions, 'solicitarSaqueIndicador')
  const resultado = await solicitarSaque({ indicadorId, valor, chavePix, observacao })

  return resultado.data
}
