import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  Timestamp,
  writeBatch,
  where
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'

import { auth, db, functions } from './firebase'

const pagamentosCollection = collection(db, 'pagamentos')
const movimentacoesCollection = collection(db, 'movimentacoesFinanceiras')
const transacoesPagamentoCollection = collection(db, 'transacoesPagamento')
const mercadoPagoSandboxUrl = import.meta.env.DEV
  ? String(import.meta.env.VITE_MERCADO_PAGO_SANDBOX_URL || '').replace(/\/$/, '')
  : ''
const statusEncerrados = new Set(['approved', 'rejected', 'cancelled', 'refunded', 'failed'])

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
    encerradoEm: converterTimestamp(dados.encerradoEm),
    transacaoEm: converterTimestamp(dados.transacaoEm),
    solicitadoEm: converterTimestamp(dados.solicitadoEm)
  }
}

const ordenarPorCriacao = (a, b) => {
  const dataA = new Date(a.criadoEm || a.solicitadoEm || 0).getTime()
  const dataB = new Date(b.criadoEm || b.solicitadoEm || 0).getTime()

  return dataB - dataA
}

export const criarPagamentoRecompensa = async (payload) => {
  if (mercadoPagoSandboxUrl) {
    return criarPagamentoSandbox(payload)
  }

  const criarPreferencia = httpsCallable(functions, 'criarPreferenciaPagamento')

  try {
    const resultado = await criarPreferencia(payload)
    return resultado.data
  } catch (error) {
    throw normalizarErroFunction(
      error,
      'Não foi possível criar o pagamento.'
    )
  }
}

const criarPagamentoSandbox = async (payload) => {
  const empresaId = String(payload.empresaId || '')
  const candidatoId = String(payload.candidatoId || '')
  const usuario = auth.currentUser

  if (!usuario || usuario.uid !== empresaId) {
    throw new Error('Entre como empresa para criar o pagamento de teste.')
  }

  if (!candidatoId) {
    throw new Error('Candidato não informado para o pagamento.')
  }

  const pagamentoAberto = await buscarPagamentoAbertoSandbox({ empresaId, candidatoId })

  if (pagamentoAberto?.status === 'approved') {
    throw new Error('Já existe pagamento aprovado para este candidato.')
  }

  if (pagamentoAberto?.status === 'pending' && obterCheckoutUrlPagamento(pagamentoAberto)) {
    return {
      pagamentoId: pagamentoAberto.id,
      preferenceId: pagamentoAberto.mercadoPagoPreferenceId,
      checkoutUrl: obterCheckoutUrlPagamento(pagamentoAberto),
      sandboxInitPoint: pagamentoAberto.sandboxCheckoutUrl,
      status: pagamentoAberto.status,
      reused: true
    }
  }

  const dadosPagamento = await validarPagamentoSandbox(payload)
  const pagamentoRef = doc(pagamentosCollection)
  const transacaoRef = doc(transacoesPagamentoCollection, pagamentoRef.id)
  const referenciaExterna = montarReferenciaExterna({
    pagamentoId: pagamentoRef.id,
    ...dadosPagamento
  })
  const loteCriacao = writeBatch(db)

  loteCriacao.set(pagamentoRef, {
    ...dadosPagamento,
    ambiente: 'sandbox',
    mercadoPagoPreferenceId: '',
    mercadoPagoPaymentId: '',
    status: 'created',
    statusDetail: '',
    checkoutUrl: '',
    sandboxCheckoutUrl: '',
    externalReference: referenciaExterna,
    transacaoId: transacaoRef.id,
    creditado: false,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp()
  })

  loteCriacao.set(transacaoRef, {
    pagamentoId: pagamentoRef.id,
    empresaId: dadosPagamento.empresaId,
    indicadorId: dadosPagamento.indicadorId,
    ambiente: 'sandbox',
    status: 'created',
    statusDetail: '',
    mercadoPagoPreferenceId: '',
    mercadoPagoPaymentId: '',
    valor: dadosPagamento.valor,
    moeda: dadosPagamento.moeda,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
    encerradoEm: null,
    transacaoEm: null
  })

  await loteCriacao.commit()

  let resposta

  try {
    resposta = await fetch(`${mercadoPagoSandboxUrl}/criar-preferencia`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pagamentoId: pagamentoRef.id,
        empresaId: dadosPagamento.empresaId,
        candidatoId: dadosPagamento.candidatoId,
        indicacaoId: dadosPagamento.indicacaoId,
        vagaId: dadosPagamento.vagaId,
        indicadorId: dadosPagamento.indicadorId,
        valor: dadosPagamento.valor,
        descricao: dadosPagamento.descricao,
        appUrl: window.location.origin
      })
    })
  } catch {
    await registrarFalhaCriacaoSandbox(
      pagamentoRef,
      transacaoRef,
      'servidor_sandbox_indisponivel'
    )
    throw new Error('O servidor local de testes não está ativo. Execute npm run sandbox:mercado-pago.')
  }

  const corpo = await resposta.json().catch(() => ({}))

  if (!resposta.ok) {
    await registrarFalhaCriacaoSandbox(
      pagamentoRef,
      transacaoRef,
      corpo.error || 'preferencia_recusada'
    )
    throw new Error(corpo.error || 'Não foi possível criar a preferência de teste.')
  }

  const checkoutUrl = corpo.sandboxInitPoint || corpo.checkoutUrl
  const loteAtualizacao = writeBatch(db)

  loteAtualizacao.update(pagamentoRef, {
    mercadoPagoPreferenceId: corpo.preferenceId || '',
    status: 'pending',
    statusDetail: '',
    checkoutUrl,
    sandboxCheckoutUrl: checkoutUrl,
    atualizadoEm: serverTimestamp()
  })
  loteAtualizacao.update(transacaoRef, {
    mercadoPagoPreferenceId: corpo.preferenceId || '',
    status: 'pending',
    statusDetail: '',
    atualizadoEm: serverTimestamp()
  })
  await loteAtualizacao.commit()

  return {
    ...corpo,
    pagamentoId: pagamentoRef.id,
    checkoutUrl,
    sandboxInitPoint: checkoutUrl,
    status: 'pending'
  }
}

export const sincronizarPagamentoMercadoPago = async ({ paymentId, pagamentoId }) => {
  if (!paymentId && !pagamentoId) return null

  if (mercadoPagoSandboxUrl) {
    return sincronizarPagamentoSandbox({ paymentId, pagamentoId })
  }

  const sincronizarPagamento = httpsCallable(functions, 'sincronizarPagamentoMercadoPago')

  try {
    const resultado = await sincronizarPagamento({
      mercadoPagoPaymentId: paymentId ? String(paymentId) : '',
      pagamentoId: pagamentoId || ''
    })
    return resultado.data
  } catch (error) {
    throw normalizarErroFunction(error, 'Não foi possível atualizar o pagamento.')
  }
}

const sincronizarPagamentoSandbox = async ({ paymentId, pagamentoId }) => {
  let externalReference = ''

  if (pagamentoId) {
    const pagamentoDoc = await getDoc(doc(pagamentosCollection, pagamentoId))
    if (!pagamentoDoc.exists()) return null

    const pagamento = pagamentoDoc.data()
    if (pagamento.empresaId !== auth.currentUser?.uid || pagamento.ambiente !== 'sandbox') {
      throw new Error('Este pagamento não pertence à empresa autenticada.')
    }
    externalReference = pagamento.externalReference || ''
  }

  let resposta

  try {
    resposta = await fetch(`${mercadoPagoSandboxUrl}/consultar-pagamento`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        paymentId: paymentId ? String(paymentId) : '',
        externalReference
      })
    })
  } catch {
    throw new Error('O servidor local de testes não está ativo.')
  }

  const dados = await resposta.json().catch(() => ({}))
  if (!resposta.ok) {
    throw new Error(dados.error || 'Não foi possível consultar o pagamento de teste.')
  }
  if (!dados.encontrado) return dados

  const pagamentoInternoId = extrairPagamentoIdDaReferencia(dados.externalReference)
  if (!pagamentoInternoId) {
    throw new Error('O pagamento retornado não pertence ao Selectio.')
  }

  const pagamentoRef = doc(pagamentosCollection, pagamentoInternoId)
  const transacaoRef = doc(transacoesPagamentoCollection, pagamentoInternoId)
  const pagamentoDoc = await getDoc(pagamentoRef)

  if (!pagamentoDoc.exists()) {
    throw new Error('Registro interno do pagamento não encontrado.')
  }

  const pagamento = pagamentoDoc.data()
  if (pagamento.empresaId !== auth.currentUser?.uid || pagamento.ambiente !== 'sandbox') {
    throw new Error('Este pagamento não pertence à empresa autenticada.')
  }

  if (Math.abs(Number(dados.valor || 0) - Number(pagamento.valor || 0)) >= 0.01) {
    dados.status = 'failed'
    dados.statusDetail = 'valor_divergente'
  }

  const lote = writeBatch(db)
  const atualizacaoPagamento = {
    mercadoPagoPaymentId: dados.mercadoPagoPaymentId,
    status: dados.status,
    statusDetail: dados.statusDetail || '',
    transacaoEm: timestampSeguro(dados.transacaoEm),
    atualizadoEm: timestampSeguro(dados.atualizadoEm) || serverTimestamp()
  }
  const atualizacaoTransacao = {
    mercadoPagoPaymentId: dados.mercadoPagoPaymentId,
    status: dados.status,
    statusDetail: dados.statusDetail || '',
    transacaoEm: timestampSeguro(dados.transacaoEm),
    atualizadoEm: timestampSeguro(dados.atualizadoEm) || serverTimestamp()
  }

  if (dados.status === 'approved') {
    atualizacaoPagamento.aprovadoEm = timestampSeguro(dados.aprovadoEm) || serverTimestamp()
  }

  if (statusEncerrados.has(dados.status)) {
    const encerradoEm = timestampSeguro(dados.encerradoEm) || serverTimestamp()
    atualizacaoPagamento.encerradoEm = encerradoEm
    atualizacaoTransacao.encerradoEm = encerradoEm
  }

  lote.update(pagamentoRef, atualizacaoPagamento)
  lote.update(transacaoRef, atualizacaoTransacao)
  await lote.commit()

  return {
    pagamentoId: pagamentoInternoId,
    ...dados
  }
}

export const listarTransacoesPagamentoPorEmpresa = async (empresaId) => {
  if (!empresaId) return []

  const documentos = await getDocs(query(
    transacoesPagamentoCollection,
    where('empresaId', '==', empresaId),
    limit(100)
  ))

  return documentos.docs.map(mapearDocumento).filter(Boolean).sort(ordenarPorCriacao)
}

export const obterCheckoutUrlPagamento = (pagamento) => (
  pagamento?.sandboxCheckoutUrl || pagamento?.checkoutUrl || ''
)

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

  try {
    const resultado = await solicitarSaque({ indicadorId, valor, chavePix, observacao })
    return resultado.data
  } catch (error) {
    throw normalizarErroFunction(
      error,
      'Não foi possível solicitar o saque.'
    )
  }
}

async function buscarPagamentoAbertoSandbox({ empresaId, candidatoId }) {
  const documentos = await getDocs(query(
    pagamentosCollection,
    where('empresaId', '==', empresaId),
    where('candidatoId', '==', candidatoId),
    limit(20)
  ))

  return documentos.docs
    .map(mapearDocumento)
    .sort(ordenarPorCriacao)
    .find((pagamento) => ['approved', 'pending'].includes(pagamento.status))
}

async function validarPagamentoSandbox(payload) {
  const empresaId = String(payload.empresaId || '')
  const candidatoId = String(payload.candidatoId || '')
  const candidatoDoc = await getDoc(doc(db, 'candidatos', candidatoId))

  if (!candidatoDoc.exists()) {
    throw new Error('Candidato não encontrado.')
  }

  const candidato = candidatoDoc.data()
  if (
    ![candidato.empresaId, candidato.empresaUid].includes(empresaId)
    || candidato.status !== 'contratado'
  ) {
    throw new Error('A recompensa só pode ser paga pela empresa para um candidato contratado.')
  }

  const vagaId = candidato.vagaId || String(payload.vagaId || '')
  const vagaDoc = vagaId ? await getDoc(doc(db, 'vagas', vagaId)) : null
  const vaga = vagaDoc?.exists() ? vagaDoc.data() : {}

  if (vagaDoc?.exists() && ![vaga.empresaId, vaga.empresaUid].includes(empresaId)) {
    throw new Error('A vaga não pertence à empresa autenticada.')
  }

  const indicadorId = candidato.indicadorId
    || candidato.indicadorUid
    || String(payload.indicadorId || '')
  if (!indicadorId) {
    throw new Error('Candidato sem indicador vinculado.')
  }

  const valor = primeiroValorMonetario(
    candidato.recompensaValor,
    vaga.recompensaValor,
    candidato.recompensa,
    vaga.recompensa,
    payload.valor
  )
  if (!valor) {
    throw new Error('Recompensa da vaga não encontrada ou inválida.')
  }

  const valorInformado = valorMonetario(payload.valor)
  if (valorInformado && Math.abs(valorInformado - valor) >= 0.01) {
    throw new Error('O valor informado não corresponde à recompensa cadastrada.')
  }

  const candidatoNome = textoSeguro(candidato.nome, 'Candidato')
  const vagaTitulo = textoSeguro(vaga.titulo || candidato.vagaTitulo, 'Vaga Selectio')

  return {
    empresaId,
    indicadorId,
    candidatoId,
    candidatoNome,
    vagaId,
    vagaTitulo,
    indicacaoId: String(payload.indicacaoId || candidato.indicacaoId || ''),
    indicadorNome: textoSeguro(candidato.indicadorNome),
    descricao: textoSeguro(
      payload.descricao,
      `Recompensa Selectio - ${vagaTitulo} - ${candidatoNome}`
    ),
    valor,
    moeda: 'BRL'
  }
}

async function registrarFalhaCriacaoSandbox(pagamentoRef, transacaoRef, detalhe) {
  const lote = writeBatch(db)
  const atualizacao = {
    status: 'failed',
    statusDetail: String(detalhe || 'erro_criar_preferencia').slice(0, 180),
    atualizadoEm: serverTimestamp(),
    encerradoEm: serverTimestamp()
  }

  lote.update(pagamentoRef, atualizacao)
  lote.update(transacaoRef, atualizacao)
  await lote.commit()
}

function montarReferenciaExterna({
  pagamentoId,
  empresaId,
  indicadorId,
  vagaId,
  candidatoId,
  indicacaoId
}) {
  return [
    'selectio',
    pagamentoId,
    empresaId,
    indicadorId || 'sem-indicador',
    vagaId || 'sem-vaga',
    candidatoId || 'sem-candidato',
    indicacaoId || 'sem-indicacao'
  ].join(':')
}

function extrairPagamentoIdDaReferencia(referencia) {
  const partes = String(referencia || '').split(':')
  return partes[0] === 'selectio' ? partes[1] || '' : ''
}

function timestampSeguro(valor) {
  if (!valor) return null

  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? null : Timestamp.fromDate(data)
}

function valorMonetario(valor) {
  if (typeof valor === 'number') {
    return Number.isFinite(valor) && valor > 0 ? Number(valor.toFixed(2)) : null
  }

  const texto = String(valor || '').replace(/[^\d,.-]/g, '')
  if (!texto) return null

  const normalizado = texto.includes(',')
    ? texto.replace(/\./g, '').replace(',', '.')
    : texto
  const numero = Number(normalizado)

  return Number.isFinite(numero) && numero > 0 ? Number(numero.toFixed(2)) : null
}

function primeiroValorMonetario(...valores) {
  for (const valor of valores) {
    const numero = valorMonetario(valor)
    if (numero) return numero
  }

  return null
}

function textoSeguro(valor, fallback = '') {
  const texto = String(valor || '').trim()
  return texto || fallback
}

function normalizarErroFunction(error, fallback) {
  const codigo = String(error?.code || '')
  const mensagem = String(error?.message || '').trim()

  if (
    codigo === 'functions/internal'
    || codigo === 'functions/not-found'
    || mensagem.toLowerCase() === 'internal'
  ) {
    return new Error(
      'O serviço de pagamentos ainda não está disponível no Firebase. Publique as Cloud Functions e tente novamente.'
    )
  }

  if (codigo === 'functions/unavailable') {
    return new Error(
      mensagem || 'O serviço de pagamentos está temporariamente indisponível. Tente novamente.'
    )
  }

  return new Error(mensagem || fallback)
}
