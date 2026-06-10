const crypto = require('node:crypto')
const admin = require('firebase-admin')
const functions = require('firebase-functions')

admin.initializeApp()

const db = admin.firestore()
const FieldValue = admin.firestore.FieldValue

const STATUS_PAGAMENTO = {
  approved: 'approved',
  pending: 'pending',
  in_process: 'pending',
  authorized: 'pending',
  rejected: 'rejected',
  cancelled: 'cancelled',
  refunded: 'refunded',
  charged_back: 'refunded',
  failed: 'failed'
}

const moedaPadrao = 'BRL'
const regiao = 'us-central1'
const STATUS_ENCERRADOS = new Set(['approved', 'rejected', 'cancelled', 'refunded', 'failed'])

function erroHttps(codigo, mensagem) {
  throw new functions.https.HttpsError(codigo, mensagem)
}

function obterAccessToken() {
  const token = ambienteSandbox()
    ? process.env.MERCADO_PAGO_TEST_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN
    : process.env.MERCADO_PAGO_ACCESS_TOKEN

  if (!token) {
    throw new Error('Access Token do Mercado Pago não configurado nas Cloud Functions.')
  }

  return token
}

function ambienteSandbox() {
  return String(process.env.MP_ENVIRONMENT || '').toLowerCase() === 'sandbox'
}

function obterAppUrl() {
  return process.env.APP_URL || 'http://localhost:5173'
}

function obterWebhookUrl() {
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || admin.app().options.projectId
  const urlBase = process.env.MP_WEBHOOK_URL || `https://${regiao}-${projectId}.cloudfunctions.net/mercadoPagoWebhook`
  const separador = urlBase.includes('?') ? '&' : '?'
  return `${urlBase}${separador}source_news=webhooks`
}

function validarWebhook(req) {
  const segredo = process.env.MP_WEBHOOK_SECRET

  if (!segredo) return true

  const assinatura = String(req.get('x-signature') || '')
  const requestId = String(req.get('x-request-id') || '')
  const dataId = String(req.query['data.id'] || req.body?.data?.id || '').toLowerCase()
  const partes = Object.fromEntries(
    assinatura.split(',').map((parte) => {
      const [chave, valor] = parte.trim().split('=', 2)
      return [chave, valor]
    })
  )

  if (!partes.ts || !partes.v1 || !requestId || !dataId) return false

  const manifesto = `id:${dataId};request-id:${requestId};ts:${partes.ts};`
  const esperado = crypto
    .createHmac('sha256', segredo)
    .update(manifesto)
    .digest('hex')

  if (esperado.length !== partes.v1.length) return false

  return crypto.timingSafeEqual(
    Buffer.from(esperado, 'utf8'),
    Buffer.from(partes.v1, 'utf8')
  )
}

function numeroPositivo(valor) {
  const numero = Number(valor)

  return Number.isFinite(numero) && numero > 0 ? Number(numero.toFixed(2)) : null
}

function valorMonetario(valor) {
  if (typeof valor === 'number') return numeroPositivo(valor)

  const texto = String(valor || '')
    .replace(/[^\d,.-]/g, '')
    .trim()

  if (!texto) return null

  let normalizado = texto.includes(',')
    ? texto.replace(/\./g, '').replace(',', '.')
    : texto.replace(/,/g, '')

  if (!texto.includes(',') && /^\d{1,3}(\.\d{3})+$/.test(texto)) {
    normalizado = texto.replace(/\./g, '')
  }

  return numeroPositivo(normalizado)
}

function primeiroValorMonetario(...valores) {
  for (const valor of valores) {
    const numero = valorMonetario(valor)
    if (numero) return numero
  }

  return null
}

function valoresIguais(valorA, valorB) {
  return Math.abs(Number(valorA || 0) - Number(valorB || 0)) < 0.01
}

function dinheiro(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

function textoSeguro(valor, fallback = '') {
  const texto = String(valor || '').trim()
  return texto || fallback
}

function normalizarStatusMercadoPago(status) {
  return STATUS_PAGAMENTO[status] || 'failed'
}

function timestampMercadoPago(valor) {
  if (!valor) return null

  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? null : admin.firestore.Timestamp.fromDate(data)
}

function checkoutUrlPreferida(preferencia) {
  if (ambienteSandbox()) {
    return preferencia.sandbox_init_point || preferencia.init_point || ''
  }

  return preferencia.init_point || preferencia.sandbox_init_point || ''
}

async function chamarMercadoPago(caminho, opcoes = {}) {
  const resposta = await globalThis.fetch(`https://api.mercadopago.com${caminho}`, {
    ...opcoes,
    headers: {
      Authorization: `Bearer ${obterAccessToken()}`,
      'Content-Type': 'application/json',
      ...(opcoes.headers || {})
    }
  })

  const corpo = await resposta.json().catch(() => ({}))

  if (!resposta.ok) {
    const mensagem = corpo.message || corpo.error || 'Erro ao consultar Mercado Pago.'
    throw new Error(mensagem)
  }

  return corpo
}

async function buscarPagamentoMercadoPagoPorReferencia(externalReference) {
  const agora = new Date()
  const inicio = new Date(agora)
  inicio.setDate(inicio.getDate() - 30)
  const parametros = new URLSearchParams({
    sort: 'date_created',
    criteria: 'desc',
    external_reference: externalReference,
    range: 'date_created',
    begin_date: inicio.toISOString(),
    end_date: agora.toISOString(),
    limit: '1'
  })
  const resultado = await chamarMercadoPago(`/v1/payments/search?${parametros}`)

  return Array.isArray(resultado.results) ? resultado.results[0] || null : null
}

async function buscarIndicacao({ indicacaoId, candidatoId, empresaId }) {
  if (indicacaoId) {
    const indicacaoDoc = await db.collection('indicacoes').doc(indicacaoId).get()
    return indicacaoDoc.exists ? { id: indicacaoDoc.id, ...indicacaoDoc.data() } : null
  }

  const indicacoesSnap = await db.collection('indicacoes')
    .where('candidatoId', '==', candidatoId)
    .limit(10)
    .get()

  const indicacaoDoc = indicacoesSnap.docs.find((doc) => doc.data().empresaId === empresaId)

  return indicacaoDoc ? { id: indicacaoDoc.id, ...indicacaoDoc.data() } : null
}

async function buscarPagamentoAberto({ candidatoId, empresaId }) {
  const pagamentosSnap = await db.collection('pagamentos')
    .where('candidatoId', '==', candidatoId)
    .limit(20)
    .get()

  const pagamentos = pagamentosSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))

  return {
    aprovado: pagamentos.find((pagamento) => pagamento.empresaId === empresaId && pagamento.status === 'approved'),
    pendente: pagamentos.find((pagamento) => (
      pagamento.empresaId === empresaId
      && ['pending', 'in_process'].includes(pagamento.status)
      && (pagamento.checkoutUrl || pagamento.sandboxCheckoutUrl)
    ))
  }
}

function montarReferenciaExterna({ pagamentoId, empresaId, indicadorId, vagaId, candidatoId, indicacaoId }) {
  return ['selectio', pagamentoId, empresaId, indicadorId, vagaId || 'sem-vaga', candidatoId, indicacaoId || 'sem-indicacao'].join(':')
}

function extrairPagamentoIdDaReferencia(referencia) {
  const partes = String(referencia || '').split(':')

  if (partes[0] !== 'selectio') return null
  return partes[1] || null
}

function extrairPaymentIdWebhook(req) {
  const idDireto = req.body?.data?.id || req.body?.id || req.query.id || req.query['data.id']
  if (idDireto) return String(idDireto)

  const recurso = String(req.body?.resource || req.query.resource || '')
  const match = recurso.match(/\/payments\/(\d+)/)

  return match?.[1] || ''
}

function webhookEhDePagamento(req) {
  const tipo = req.body?.type || req.body?.topic || req.query.type || req.query.topic
  const acao = req.body?.action || ''
  const recurso = req.body?.resource || req.query.resource || ''
  const texto = `${tipo} ${acao} ${recurso}`

  return texto.includes('payment')
}

async function criarPreferenciaPagamentoHandler(dados = {}, contexto) {
    if (!contexto.auth) {
      erroHttps('unauthenticated', 'Faca login como empresa para criar pagamento.')
    }

    const empresaId = String(dados.empresaId || '')
    const candidatoId = String(dados.candidatoId || '')
    const indicadorIdInput = String(dados.indicadorId || '')
    const indicacaoId = String(dados.indicacaoId || '')
    const vagaIdInput = String(dados.vagaId || '')
    const valorInformado = valorMonetario(dados.valor)

    if (!empresaId || empresaId !== contexto.auth.uid) {
      erroHttps('permission-denied', 'Esta empresa não pode criar este pagamento.')
    }

    if (!candidatoId) {
      erroHttps('invalid-argument', 'Candidato e obrigatório para criar pagamento.')
    }

    const empresaDoc = await db.collection('empresas').doc(empresaId).get()
    if (!empresaDoc.exists) {
      erroHttps('permission-denied', 'Perfil de empresa não encontrado.')
    }

    const candidatoDoc = await db.collection('candidatos').doc(candidatoId).get()
    if (!candidatoDoc.exists) {
      erroHttps('not-found', 'Candidato não encontrado.')
    }

    const empresa = empresaDoc.data()
    const candidato = candidatoDoc.data()

    if (candidato.empresaId !== empresaId && candidato.empresaUid !== empresaId) {
      erroHttps('permission-denied', 'Candidato não pertence a esta empresa.')
    }

    if (candidato.status !== 'contratado') {
      erroHttps('failed-precondition', 'A recompensa so pode ser paga para candidato contratado.')
    }

    const indicacao = await buscarIndicacao({ indicacaoId, candidatoId, empresaId })

    if (indicacao?.candidatoId && indicacao.candidatoId !== candidatoId) {
      erroHttps('permission-denied', 'Indicação não corresponde ao candidato.')
    }

    if (indicacao?.empresaId && indicacao.empresaId !== empresaId) {
      erroHttps('permission-denied', 'Indicação não pertence a esta empresa.')
    }

    const indicadorIdDocumento = candidato.indicadorId
      || candidato.indicadorUid
      || indicacao?.indicadorId
      || indicacao?.indicadorUid
    const indicadorId = indicadorIdDocumento || indicadorIdInput

    if (!indicadorId) {
      erroHttps('failed-precondition', 'Candidato não possui indicador vinculado.')
    }

    if (indicadorIdInput && indicadorIdDocumento && indicadorIdInput !== indicadorIdDocumento) {
      erroHttps('permission-denied', 'Indicador informado não corresponde ao candidato.')
    }

    if (
      (candidato.indicadorId && candidato.indicadorId !== indicadorId)
      || (candidato.indicadorUid && candidato.indicadorUid !== indicadorId)
      || (indicacao?.indicadorId && indicacao.indicadorId !== indicadorId)
      || (indicacao?.indicadorUid && indicacao.indicadorUid !== indicadorId)
    ) {
      erroHttps('permission-denied', 'Indicador não corresponde ao candidato ou indicação.')
    }

    const { aprovado, pendente } = await buscarPagamentoAberto({ candidatoId, empresaId })

    if (aprovado) {
      erroHttps('already-exists', 'Já existe pagamento aprovado para este candidato.')
    }

    if (pendente) {
      const checkoutUrl = pendente.ambiente === 'sandbox'
        ? pendente.sandboxCheckoutUrl || pendente.checkoutUrl || ''
        : pendente.checkoutUrl || pendente.sandboxCheckoutUrl || ''

      return {
        pagamentoId: pendente.id,
        preferenceId: pendente.mercadoPagoPreferenceId,
        checkoutUrl,
        initPoint: pendente.checkoutUrl,
        sandboxInitPoint: pendente.sandboxCheckoutUrl,
        reused: true
      }
    }

    const indicadorDoc = await db.collection('indicadores').doc(indicadorId).get()
    const vagaId = candidato.vagaId || indicacao?.vagaId || vagaIdInput || ''
    const vagaDoc = vagaId ? await db.collection('vagas').doc(vagaId).get() : null
    const indicador = indicadorDoc.exists ? indicadorDoc.data() : {}
    const vaga = vagaDoc?.exists ? vagaDoc.data() : {}

    if (!indicadorDoc.exists) {
      erroHttps('failed-precondition', 'Perfil de indicador não encontrado.')
    }

    if (vagaDoc?.exists && vaga.empresaId !== empresaId && vaga.empresaUid !== empresaId) {
      erroHttps('permission-denied', 'Vaga não pertence a esta empresa.')
    }

    const valor = primeiroValorMonetario(
      candidato.recompensaValor,
      indicacao?.recompensaValor,
      vaga.recompensaValor,
      candidato.recompensa,
      indicacao?.recompensa,
      vaga.recompensa
    )

    if (!valor) {
      erroHttps('failed-precondition', 'Recompensa da vaga não encontrada ou invalida.')
    }

    if (valorInformado && !valoresIguais(valorInformado, valor)) {
      erroHttps('invalid-argument', 'Valor informado não corresponde a recompensa cadastrada.')
    }

    const pagamentoRef = db.collection('pagamentos').doc()
    const transacaoRef = db.collection('transacoesPagamento').doc(pagamentoRef.id)
    const finalIndicacaoId = indicacao?.id || indicacaoId || ''
    const vagaTitulo = textoSeguro(vaga.titulo || candidato.vagaTitulo || indicacao?.vagaTitulo, 'Vaga Selectio')
    const candidatoNome = textoSeguro(candidato.nome || indicacao?.candidatoNome, 'Candidato')
    const descricao = textoSeguro(dados.descricao, `Recompensa Selectio - ${vagaTitulo} - ${candidatoNome}`)
    const referenciaExterna = montarReferenciaExterna({
      pagamentoId: pagamentoRef.id,
      empresaId,
      indicadorId,
      vagaId,
      candidatoId,
      indicacaoId: finalIndicacaoId
    })

    const agora = FieldValue.serverTimestamp()
    const pagamento = {
      ambiente: ambienteSandbox() ? 'sandbox' : 'producao',
      mercadoPagoPreferenceId: '',
      mercadoPagoPaymentId: '',
      status: 'created',
      statusDetail: '',
      valor,
      moeda: moedaPadrao,
      empresaId,
      empresaNome: empresa.nomeEmpresa || empresa.razaoSocial || '',
      indicadorId,
      indicadorNome: indicador.nome || candidato.indicadorNome || indicacao?.indicadorNome || '',
      candidatoId,
      candidatoNome,
      vagaId,
      vagaTitulo,
      indicacaoId: finalIndicacaoId,
      descricao,
      checkoutUrl: '',
      sandboxCheckoutUrl: '',
      externalReference: referenciaExterna,
      transacaoId: transacaoRef.id,
      creditado: false,
      criadoEm: agora,
      atualizadoEm: agora
    }

    const transacao = {
      pagamentoId: pagamentoRef.id,
      empresaId,
      indicadorId,
      ambiente: ambienteSandbox() ? 'sandbox' : 'producao',
      status: 'created',
      statusDetail: '',
      mercadoPagoPreferenceId: '',
      mercadoPagoPaymentId: '',
      valor,
      moeda: moedaPadrao,
      criadoEm: agora,
      atualizadoEm: agora,
      encerradoEm: null,
      transacaoEm: null
    }

    const loteCriacao = db.batch()
    loteCriacao.set(pagamentoRef, pagamento)
    loteCriacao.set(transacaoRef, transacao)
    await loteCriacao.commit()

    let preferencia

    try {
      const payer = ambienteSandbox()
        ? undefined
        : { email: empresa.email || contexto.auth.token.email || undefined }
      const appUrl = obterAppUrl()
      const autoReturn = appUrl.startsWith('https://') ? { auto_return: 'approved' } : {}

      preferencia = await chamarMercadoPago('/checkout/preferences', {
        method: 'POST',
        headers: {
          'X-Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify({
          items: [
            {
              title: descricao,
              quantity: 1,
              unit_price: valor,
              currency_id: moedaPadrao
            }
          ],
          ...(payer ? { payer } : {}),
          back_urls: {
            success: `${appUrl}/painel/empresa?secao=pagamentos&status=success`,
            failure: `${appUrl}/painel/empresa?secao=pagamentos&status=failure`,
            pending: `${appUrl}/painel/empresa?secao=pagamentos&status=pending`
          },
          ...autoReturn,
          binary_mode: false,
          notification_url: obterWebhookUrl(),
          external_reference: referenciaExterna,
          metadata: {
            empresaId,
            indicadorId,
            candidatoId,
            vagaId,
            indicacaoId: finalIndicacaoId,
            valor
          }
        })
      })
    } catch (error) {
      const atualizacaoFalha = {
        status: 'failed',
        statusDetail: 'erro_criar_preferencia',
        erroCriacao: error.message || 'Erro ao criar preferência Mercado Pago.',
        atualizadoEm: FieldValue.serverTimestamp(),
        encerradoEm: FieldValue.serverTimestamp()
      }
      const loteFalha = db.batch()
      loteFalha.update(pagamentoRef, atualizacaoFalha)
      loteFalha.update(transacaoRef, {
        status: atualizacaoFalha.status,
        statusDetail: atualizacaoFalha.statusDetail,
        atualizadoEm: atualizacaoFalha.atualizadoEm,
        encerradoEm: atualizacaoFalha.encerradoEm
      })
      await loteFalha.commit()
      throw error
    }

    const checkoutUrl = checkoutUrlPreferida(preferencia)
    const lotePreferencia = db.batch()
    lotePreferencia.update(pagamentoRef, {
      mercadoPagoPreferenceId: preferencia.id || '',
      status: 'pending',
      checkoutUrl,
      sandboxCheckoutUrl: preferencia.sandbox_init_point || '',
      atualizadoEm: FieldValue.serverTimestamp()
    })
    lotePreferencia.update(transacaoRef, {
      mercadoPagoPreferenceId: preferencia.id || '',
      status: 'pending',
      atualizadoEm: FieldValue.serverTimestamp()
    })
    await lotePreferencia.commit()

    return {
      pagamentoId: pagamentoRef.id,
      preferenceId: preferencia.id,
      checkoutUrl,
      initPoint: preferencia.init_point || '',
      sandboxInitPoint: preferencia.sandbox_init_point || '',
      ambiente: ambienteSandbox() ? 'sandbox' : 'producao',
      status: 'pending'
    }
}

async function criarPreferenciaPagamentoCallable(dados, contexto) {
  try {
    return await criarPreferenciaPagamentoHandler(dados, contexto)
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error
    }

    console.error('Erro ao criar preferência de pagamento:', error)
    erroHttps(
      'unavailable',
      'Não foi possível criar o pagamento no Mercado Pago. Verifique a configuração e tente novamente.'
    )
  }
}

exports.criarPreferenciaPagamento = functions
  .region(regiao)
  .https.onCall(criarPreferenciaPagamentoCallable)

exports.createMercadoPagoPreference = functions
  .region(regiao)
  .https.onCall(criarPreferenciaPagamentoCallable)

exports.solicitarSaqueIndicador = functions
  .region(regiao)
  .https.onCall(async (dados, contexto) => {
    if (!contexto.auth) {
      erroHttps('unauthenticated', 'Faca login como indicador para solicitar saque.')
    }

    const indicadorId = String(dados.indicadorId || '')
    const valor = numeroPositivo(dados.valor)
    const chavePix = textoSeguro(dados.chavePix)

    if (!indicadorId || indicadorId !== contexto.auth.uid) {
      erroHttps('permission-denied', 'Este indicador não pode solicitar saque para outra conta.')
    }

    if (!valor || !chavePix) {
      erroHttps('invalid-argument', 'Valor e chave Pix são obrigatórios.')
    }

    const indicadorDoc = await db.collection('indicadores').doc(indicadorId).get()
    if (!indicadorDoc.exists) {
      erroHttps('permission-denied', 'Perfil de indicador não encontrado.')
    }

    const indicador = indicadorDoc.data()
    const saldoRef = db.collection('indicadorSaldos').doc(indicadorId)
    const saqueRef = db.collection('saques').doc()
    const movimentacaoRef = db.collection('movimentacoesFinanceiras').doc()

    await db.runTransaction(async (transaction) => {
      const saldoDoc = await transaction.get(saldoRef)
      const saldo = saldoDoc.exists ? saldoDoc.data() : {}
      const saldoDisponivel = Number(saldo.saldoDisponivel || 0)

      if (saldoDisponivel < valor) {
        throw new functions.https.HttpsError('failed-precondition', 'Saldo disponível insuficiente.')
      }

      const agora = FieldValue.serverTimestamp()

      transaction.set(saqueRef, {
        indicadorId,
        indicadorNome: indicador.nome || '',
        valor,
        chavePix,
        status: 'solicitado',
        solicitadoEm: agora,
        atualizadoEm: agora,
        observacao: textoSeguro(dados.observacao)
      })

      transaction.set(movimentacaoRef, {
        indicadorId,
        tipo: 'saque_solicitado',
        valor,
        status: 'solicitado',
        saqueId: saqueRef.id,
        descricao: `Solicitação de saque de ${dinheiro(valor)}`,
        criadoEm: agora
      })

      transaction.set(saldoRef, {
        indicadorId,
        saldoDisponivel: FieldValue.increment(-valor),
        saldoPendente: FieldValue.increment(valor),
        atualizadoEm: agora
      }, { merge: true })
    })

    return {
      saqueId: saqueRef.id,
      status: 'solicitado'
    }
  })

async function processarPagamentoMercadoPago(pagamentoMp, empresaIdEsperada = '') {
  const referenciaExterna = pagamentoMp.external_reference
  const pagamentoId = extrairPagamentoIdDaReferencia(referenciaExterna)

  if (!pagamentoId) {
    throw new Error('Pagamento sem referência externa válida.')
  }

  const pagamentoRef = db.collection('pagamentos').doc(pagamentoId)
  const transacaoRef = db.collection('transacoesPagamento').doc(pagamentoId)
  const statusRecebido = normalizarStatusMercadoPago(pagamentoMp.status)
  const valorPago = Number(pagamentoMp.transaction_amount || 0)
  let resultado

  await db.runTransaction(async (transaction) => {
    const pagamentoDoc = await transaction.get(pagamentoRef)

    if (!pagamentoDoc.exists) {
      throw new Error('Pagamento interno não encontrado.')
    }

    const pagamento = pagamentoDoc.data()
    if (empresaIdEsperada && pagamento.empresaId !== empresaIdEsperada) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Este pagamento não pertence à empresa autenticada.'
      )
    }

    const agora = FieldValue.serverTimestamp()
    const valorEsperado = Number(pagamento.valor || 0)
    const valorConfere = Math.abs(valorPago - valorEsperado) < 0.01
    const status = valorConfere ? statusRecebido : 'failed'
    const statusDetail = valorConfere
      ? textoSeguro(pagamentoMp.status_detail)
      : 'valor_divergente'
    const mercadoPagoPaymentId = String(pagamentoMp.id || '')
    const transacaoEm = timestampMercadoPago(pagamentoMp.date_created) || agora
    const encerradoEm = STATUS_ENCERRADOS.has(status)
      ? timestampMercadoPago(pagamentoMp.date_last_updated)
        || timestampMercadoPago(pagamentoMp.date_approved)
        || agora
      : null

    const atualizacaoPagamento = {
      status,
      statusDetail,
      mercadoPagoPaymentId,
      transacaoEm,
      atualizadoEm: agora
    }

    if (status === 'approved') {
      atualizacaoPagamento.aprovadoEm = timestampMercadoPago(pagamentoMp.date_approved) || agora
    }
    if (encerradoEm) atualizacaoPagamento.encerradoEm = encerradoEm

    transaction.set(transacaoRef, {
      pagamentoId,
      empresaId: pagamento.empresaId,
      indicadorId: pagamento.indicadorId,
      ambiente: pagamento.ambiente || (ambienteSandbox() ? 'sandbox' : 'producao'),
      status,
      statusDetail,
      mercadoPagoPreferenceId: pagamento.mercadoPagoPreferenceId || '',
      mercadoPagoPaymentId,
      valor: valorEsperado,
      moeda: pagamento.moeda || moedaPadrao,
      criadoEm: pagamento.criadoEm || agora,
      atualizadoEm: agora,
      transacaoEm,
      encerradoEm
    }, { merge: true })

    const deveCreditar = status === 'approved'
      && !pagamento.creditado
      && pagamento.ambiente !== 'sandbox'

    if (!deveCreditar) {
      transaction.update(pagamentoRef, atualizacaoPagamento)
      resultado = {
        pagamentoId,
        empresaId: pagamento.empresaId,
        status,
        statusDetail,
        mercadoPagoPaymentId,
        ambiente: pagamento.ambiente || 'producao',
        creditado: Boolean(pagamento.creditado)
      }
      return
    }

    const saldoRef = db.collection('indicadorSaldos').doc(pagamento.indicadorId)
    const movimentacaoRef = db.collection('movimentacoesFinanceiras').doc()
    const notificacaoIndicadorRef = db.collection('notificacoes').doc()
    const notificacaoEmpresaRef = db.collection('notificacoes').doc()

    transaction.set(saldoRef, {
      indicadorId: pagamento.indicadorId,
      saldoDisponivel: FieldValue.increment(valorEsperado),
      saldoPendente: FieldValue.increment(0),
      totalRecebido: FieldValue.increment(valorEsperado),
      totalSacado: FieldValue.increment(0),
      atualizadoEm: agora
    }, { merge: true })

    transaction.set(movimentacaoRef, {
      indicadorId: pagamento.indicadorId,
      tipo: 'credito_recompensa',
      valor: valorEsperado,
      status: 'approved',
      pagamentoId,
      candidatoId: pagamento.candidatoId,
      vagaId: pagamento.vagaId,
      empresaId: pagamento.empresaId,
      descricao: `Credito de recompensa por ${pagamento.candidatoNome || 'candidato'} em ${pagamento.vagaTitulo || 'vaga'}`,
      criadoEm: agora
    })

    transaction.set(notificacaoIndicadorRef, {
      userId: pagamento.indicadorId,
      tipo: 'pagamento_aprovado',
      titulo: 'Pagamento recebido',
      mensagem: `Você recebeu ${dinheiro(valorEsperado)} pela indicação de ${pagamento.candidatoNome || 'um candidato'} para a vaga ${pagamento.vagaTitulo || 'informada'}.`,
      lida: false,
      link: '/painel/indicador?secao=financeiro',
      metadata: {
        pagamentoId,
        candidatoId: pagamento.candidatoId,
        vagaId: pagamento.vagaId
      },
      criadoEm: agora
    })

    transaction.set(notificacaoEmpresaRef, {
      userId: pagamento.empresaId,
      tipo: 'pagamento_aprovado',
      titulo: 'Pagamento aprovado',
      mensagem: `Pagamento de ${dinheiro(valorEsperado)} aprovado para ${pagamento.candidatoNome || 'o candidato'}.`,
      lida: false,
      link: '/painel/empresa?secao=pagamentos',
      metadata: {
        pagamentoId,
        candidatoId: pagamento.candidatoId,
        vagaId: pagamento.vagaId
      },
      criadoEm: agora
    })

    transaction.update(pagamentoRef, {
      ...atualizacaoPagamento,
      creditado: true
    })

    resultado = {
      pagamentoId,
      empresaId: pagamento.empresaId,
      status,
      statusDetail,
      mercadoPagoPaymentId,
      ambiente: pagamento.ambiente || 'producao',
      creditado: true
    }
  })

  return resultado
}

exports.sincronizarPagamentoMercadoPago = functions
  .region(regiao)
  .https.onCall(async (dados, contexto) => {
    if (!contexto.auth) {
      erroHttps('unauthenticated', 'Faça login como empresa para atualizar o pagamento.')
    }

    try {
      const paymentId = String(dados.mercadoPagoPaymentId || '')
      const pagamentoId = String(dados.pagamentoId || '')
      let pagamentoMp

      if (/^\d+$/.test(paymentId)) {
        pagamentoMp = await chamarMercadoPago(`/v1/payments/${paymentId}`)
      } else if (pagamentoId) {
        const pagamentoDoc = await db.collection('pagamentos').doc(pagamentoId).get()

        if (!pagamentoDoc.exists || pagamentoDoc.data().empresaId !== contexto.auth.uid) {
          erroHttps('permission-denied', 'Este pagamento não pertence à empresa autenticada.')
        }

        pagamentoMp = await buscarPagamentoMercadoPagoPorReferencia(
          pagamentoDoc.data().externalReference
        )
      } else {
        erroHttps('invalid-argument', 'Identificador do pagamento inválido.')
      }

      if (!pagamentoMp) {
        return {
          pagamentoId,
          status: 'pending',
          encontrado: false
        }
      }

      return await processarPagamentoMercadoPago(pagamentoMp, contexto.auth.uid)
    } catch (error) {
      if (error instanceof functions.https.HttpsError) throw error

      console.error('Erro ao sincronizar pagamento Mercado Pago:', error)
      erroHttps('unavailable', 'Não foi possível atualizar o pagamento no Mercado Pago.')
    }
  })

exports.mercadoPagoWebhook = functions
  .region(regiao)
  .https.onRequest(async (req, res) => {
    if (!validarWebhook(req)) {
      res.status(401).send('invalid signature')
      return
    }

    try {
      const paymentId = extrairPaymentIdWebhook(req)

      if (!paymentId || !webhookEhDePagamento(req)) {
        res.status(200).send('ignored')
        return
      }

      const pagamentoMp = await chamarMercadoPago(`/v1/payments/${paymentId}`)
      await processarPagamentoMercadoPago(pagamentoMp)
      res.status(200).send('ok')
    } catch (error) {
      console.error('Erro no webhook Mercado Pago:', error)
      res.status(500).send('webhook error')
    }
  })
