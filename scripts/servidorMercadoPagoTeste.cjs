const crypto = require('node:crypto')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')

const raizProjeto = path.resolve(__dirname, '..')
carregarEnvEmProcesso([
  path.join(raizProjeto, '.env'),
  path.join(raizProjeto, '.env.local'),
  path.join(__dirname, '.env'),
  path.join(__dirname, '.env.local')
])

const admin = require('firebase-admin')

const host = process.env.MERCADO_PAGO_SANDBOX_HOST || '127.0.0.1'
const port = Number(process.env.MERCADO_PAGO_SANDBOX_PORT || process.env.PORT || 8787)
const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN
const mpEnvironment = textoSeguro(process.env.MP_ENVIRONMENT, 'sandbox').toLowerCase()
const appUrlPadrao = textoSeguro(process.env.APP_URL, 'http://localhost:5173').replace(/\/$/, '')
const projectId = textoSeguro(process.env.FIREBASE_PROJECT_ID, 'selectio-1f022')
const moedaPadrao = 'BRL'
const statusEncerrados = new Set(['approved', 'rejected', 'cancelled', 'refunded', 'failed'])
const hostsLocais = new Set(['127.0.0.1', 'localhost', '::1'])

if (!accessToken) {
  throw new Error('MERCADO_PAGO_ACCESS_TOKEN nao configurado no backend local.')
}

if (!hostsLocais.has(host)) {
  throw new Error('O backend local de pagamentos deve escutar apenas em localhost.')
}

inicializarFirebaseAdmin()

const db = admin.firestore()
const FieldValue = admin.firestore.FieldValue
const Timestamp = admin.firestore.Timestamp

const servidor = http.createServer(async (req, res) => {
  const origem = req.headers.origin || ''
  const requestUrl = new URL(req.url, `http://${host}:${port}`)
  const pathname = requestUrl.pathname

  if (origem && !origemPermitida(origem)) {
    responderJson(res, 403, { error: 'Origem nao permitida.' })
    return
  }

  aplicarCors(res, origem)

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  try {
    if (req.method === 'GET' && ['/health', '/status'].includes(pathname)) {
      responderJson(res, 200, {
        ok: true,
        service: 'selectio-mercado-pago-local',
        ambiente: mpEnvironment,
        firestoreProjectId: projectId
      })
      return
    }

    if (req.method === 'POST' && pathname === '/criar-preferencia') {
      const usuario = await autenticarRequisicao(req)
      await criarPreferencia(req, res, usuario)
      return
    }

    if (
      req.method === 'POST'
      && ['/sincronizar-pagamento', '/consultar-pagamento'].includes(pathname)
    ) {
      const usuario = await autenticarRequisicao(req)
      await sincronizarPagamento(req, res, usuario)
      return
    }

    if (req.method === 'POST' && pathname === '/solicitar-saque') {
      const usuario = await autenticarRequisicao(req)
      await solicitarSaque(req, res, usuario)
      return
    }

    if (req.method === 'POST' && pathname === '/webhook/mercado-pago') {
      await receberWebhookMercadoPago(req, res, requestUrl)
      return
    }

    responderJson(res, 404, { error: 'Rota nao encontrada.' })
  } catch (error) {
    console.error('Erro no backend local Mercado Pago:', error)
    const status = Number(error.status) || 500
    responderJson(res, status, {
      error: status < 500
        ? error.message || 'Nao foi possivel processar a operacao.'
        : 'Nao foi possivel processar a operacao.'
    })
  }
})

servidor.listen(port, host, () => {
  console.log(`Backend local Mercado Pago disponivel em http://${host}:${port}`)
})

async function criarPreferencia(req, res, usuario) {
  const dados = await lerJson(req)
  const empresaId = textoSeguro(dados.empresaId)
  const candidatoId = textoSeguro(dados.candidatoId)

  if (!empresaId || !candidatoId) {
    responderJson(res, 400, { error: 'Empresa e candidato sao obrigatorios.' })
    return
  }

  if (empresaId !== usuario.uid) {
    erro(403, 'Esta empresa nao pode criar este pagamento.')
  }

  const existente = await buscarPagamentoAberto({ empresaId, candidatoId })

  if (existente?.aprovado) {
    responderJson(res, 409, {
      error: 'Ja existe pagamento aprovado para este candidato.',
      pagamentoId: existente.aprovado.id,
      status: existente.aprovado.status
    })
    return
  }

  if (existente?.pendente && obterCheckoutUrlPagamento(existente.pendente)) {
    responderJson(res, 200, respostaPagamentoExistente(existente.pendente))
    return
  }

  const pagamentoValidado = await validarPagamento({
    empresaId,
    candidatoId,
    indicacaoId: textoSeguro(dados.indicacaoId),
    vagaId: textoSeguro(dados.vagaId),
    descricao: textoSeguro(dados.descricao)
  })
  const pagamentoRef = db.collection('pagamentos').doc(
    criarPagamentoId({ empresaId, candidatoId })
  )
  const transacaoRef = db.collection('transacoesPagamento').doc(pagamentoRef.id)
  const referenciaExterna = montarReferenciaExterna({
    pagamentoId: pagamentoRef.id,
    ...pagamentoValidado
  })
  const appUrl = obterAppUrl(dados.appUrl)
  const agora = FieldValue.serverTimestamp()

  await db.batch()
    .set(pagamentoRef, {
      ...pagamentoValidado,
      ambiente: mpEnvironment,
      mercadoPagoPreferenceId: '',
      mercadoPagoPaymentId: '',
      status: 'created',
      statusDetail: '',
      checkoutUrl: '',
      sandboxCheckoutUrl: '',
      externalReference: referenciaExterna,
      transacaoId: transacaoRef.id,
      creditado: false,
      criadoEm: agora,
      atualizadoEm: agora
    }, { merge: true })
    .set(transacaoRef, {
      pagamentoId: pagamentoRef.id,
      empresaId: pagamentoValidado.empresaId,
      indicadorId: pagamentoValidado.indicadorId,
      ambiente: mpEnvironment,
      status: 'created',
      statusDetail: '',
      mercadoPagoPreferenceId: '',
      mercadoPagoPaymentId: '',
      valor: pagamentoValidado.valor,
      moeda: moedaPadrao,
      criadoEm: agora,
      atualizadoEm: agora,
      encerradoEm: null,
      transacaoEm: null
    }, { merge: true })
    .commit()

  let preferencia

  try {
    preferencia = await criarPreferenciaMercadoPago({
      pagamentoId: pagamentoRef.id,
      pagamento: pagamentoValidado,
      referenciaExterna,
      appUrl
    })
  } catch (error) {
    await marcarPagamentoComoFalhou({
      pagamentoRef,
      transacaoRef,
      pagamento: pagamentoValidado,
      detalhe: error.message || 'erro_criar_preferencia'
    })
    throw error
  }

  const checkoutUrl = escolherCheckoutUrl(preferencia)

  if (!checkoutUrl) {
    await marcarPagamentoComoFalhou({
      pagamentoRef,
      transacaoRef,
      pagamento: pagamentoValidado,
      detalhe: 'checkout_url_ausente'
    })
    responderJson(res, 502, { error: 'O Mercado Pago nao retornou uma URL de checkout.' })
    return
  }

  await db.batch()
    .update(pagamentoRef, {
      mercadoPagoPreferenceId: preferencia.id || '',
      status: 'pending',
      statusDetail: '',
      checkoutUrl,
      sandboxCheckoutUrl: preferencia.sandbox_init_point || '',
      atualizadoEm: FieldValue.serverTimestamp()
    })
    .update(transacaoRef, {
      mercadoPagoPreferenceId: preferencia.id || '',
      status: 'pending',
      statusDetail: '',
      atualizadoEm: FieldValue.serverTimestamp()
    })
    .commit()

  await notificarPagamento({
    pagamentoId: pagamentoRef.id,
    pagamento: {
      ...pagamentoValidado,
      checkoutUrl,
      sandboxCheckoutUrl: preferencia.sandbox_init_point || ''
    },
    statusAnterior: 'created',
    statusAtual: 'pending'
  })

  responderJson(res, 201, {
    pagamentoId: pagamentoRef.id,
    preferenceId: preferencia.id || '',
    checkoutUrl,
    initPoint: preferencia.init_point || '',
    sandboxInitPoint: preferencia.sandbox_init_point || '',
    externalReference: referenciaExterna,
    status: 'pending',
    valor: pagamentoValidado.valor,
    ambiente: mpEnvironment
  })
}

async function sincronizarPagamento(req, res, usuario) {
  const dados = await lerJson(req)
  const resultado = await sincronizarPagamentoMercadoPago({
    pagamentoId: textoSeguro(dados.pagamentoId),
    preferenceId: textoSeguro(dados.preferenceId),
    paymentId: textoSeguro(dados.paymentId || dados.mercadoPagoPaymentId),
    empresaId: usuario.uid
  })

  responderJson(res, 200, resultado)
}

async function receberWebhookMercadoPago(req, res, requestUrl) {
  const dados = await lerJson(req).catch(() => ({}))

  if (!validarWebhookMercadoPago(req, requestUrl, dados)) {
    responderJson(res, 401, { error: 'Assinatura do webhook invalida.' })
    return
  }

  const paymentId = textoSeguro(
    dados?.data?.id
    || dados?.id
    || requestUrl.searchParams.get('data.id')
    || requestUrl.searchParams.get('id')
  )

  if (!paymentId) {
    responderJson(res, 200, { ok: true, ignored: true })
    return
  }

  const resultado = await sincronizarPagamentoMercadoPago({ paymentId })
  responderJson(res, 200, { ok: true, resultado })
}

async function solicitarSaque(req, res, usuario) {
  const dados = await lerJson(req)
  const indicadorId = textoSeguro(dados.indicadorId)
  const valor = Number(dados.valor || 0)
  const chavePix = textoSeguro(dados.chavePix)

  if (!indicadorId || !valor || valor <= 0 || !chavePix) {
    responderJson(res, 400, { error: 'Indicador, valor e chave Pix sao obrigatorios.' })
    return
  }

  if (indicadorId !== usuario.uid) {
    erro(403, 'Este indicador nao pode solicitar saque para outra conta.')
  }

  const resultado = await db.runTransaction(async (transaction) => {
    const indicadorRef = db.collection('indicadores').doc(indicadorId)
    const saldoRef = db.collection('indicadorSaldos').doc(indicadorId)
    const saqueRef = db.collection('saques').doc()
    const movimentacaoRef = db.collection('movimentacoesFinanceiras').doc()
    const [indicadorDoc, saldoDoc] = await Promise.all([
      transaction.get(indicadorRef),
      transaction.get(saldoRef)
    ])

    if (!indicadorDoc.exists) {
      erro(403, 'Perfil de indicador nao encontrado.')
    }

    const saldo = saldoDoc.exists ? saldoDoc.data() : {}
    const saldoDisponivel = Number(saldo.saldoDisponivel || 0)

    if (valor > saldoDisponivel) {
      erro(400, 'Saldo disponivel insuficiente.')
    }

    const agora = FieldValue.serverTimestamp()
    const indicador = indicadorDoc.data() || {}

    transaction.set(saldoRef, {
      indicadorId,
      saldoDisponivel: FieldValue.increment(-valor),
      saldoPendente: FieldValue.increment(valor),
      atualizadoEm: agora
    }, { merge: true })

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
      descricao: `Solicitacao de saque de ${dinheiro(valor)}`,
      criadoEm: agora
    })

    return { saqueId: saqueRef.id, status: 'solicitado' }
  })

  await registrarNotificacao(
    ['saque', resultado.saqueId, 'indicador', 'solicitado'],
    {
      userId: indicadorId,
      tipo: 'saque_solicitado',
      titulo: 'Saque solicitado',
      mensagem: `Sua solicitacao de saque foi enviada para validacao: ${dinheiro(valor)}.`,
      link: '/painel/indicador?secao=financeiro',
      metadata: {
        saqueId: resultado.saqueId,
        indicadorId,
        statusAtual: 'solicitado'
      }
    }
  )

  responderJson(res, 201, resultado)
}

async function validarPagamento({ empresaId, candidatoId, indicacaoId, vagaId, descricao }) {
  const candidatoDoc = await db.collection('candidatos').doc(candidatoId).get()

  if (!candidatoDoc.exists) {
    erro(404, 'Candidato nao encontrado.')
  }

  const candidato = candidatoDoc.data() || {}

  if (![candidato.empresaId, candidato.empresaUid].includes(empresaId)) {
    erro(403, 'Este candidato nao pertence a empresa informada.')
  }

  if (candidato.status !== 'contratado') {
    erro(400, 'A recompensa so pode ser paga para candidato contratado.')
  }

  const vagaFinalId = candidato.vagaId || vagaId
  const vagaDoc = vagaFinalId ? await db.collection('vagas').doc(vagaFinalId).get() : null
  const vaga = vagaDoc?.exists ? vagaDoc.data() || {} : {}

  if (vagaDoc?.exists && ![vaga.empresaId, vaga.empresaUid].includes(empresaId)) {
    erro(403, 'A vaga nao pertence a empresa informada.')
  }

  const indicadorId = textoSeguro(candidato.indicadorId || candidato.indicadorUid)

  if (!indicadorId) {
    erro(400, 'Candidato sem indicador vinculado.')
  }

  const valor = obterValorRecompensaFixa({ vaga, candidato })
  const candidatoNome = textoSeguro(candidato.nome || candidato.candidatoNome, 'Candidato')
  const vagaTitulo = textoSeguro(vaga.titulo || candidato.vagaTitulo, 'Vaga Selectio')

  return {
    empresaId,
    indicadorId,
    candidatoId,
    candidatoNome,
    vagaId: vagaFinalId || '',
    vagaTitulo,
    indicacaoId: indicacaoId || candidato.indicacaoId || '',
    indicadorNome: textoSeguro(candidato.indicadorNome),
    descricao: textoSeguro(
      descricao,
      `Recompensa Selectio - ${vagaTitulo} - ${candidatoNome}`
    ),
    valor,
    moeda: moedaPadrao
  }
}

async function buscarPagamentoAberto({ empresaId, candidatoId }) {
  const snapshot = await db.collection('pagamentos')
    .where('empresaId', '==', empresaId)
    .where('candidatoId', '==', candidatoId)
    .limit(20)
    .get()
  const pagamentos = snapshot.docs.map((documento) => ({
    id: documento.id,
    ...documento.data()
  }))

  return {
    aprovado: pagamentos.find((pagamento) => pagamento.status === 'approved'),
    pendente: pagamentos
      .filter((pagamento) => ['created', 'pending', 'in_process', 'authorized'].includes(pagamento.status))
      .sort((a, b) => dataMs(b.criadoEm) - dataMs(a.criadoEm))[0]
  }
}

async function sincronizarPagamentoMercadoPago({ pagamentoId, preferenceId, paymentId, empresaId = '' }) {
  const contexto = await resolverPagamentoInterno({ pagamentoId, preferenceId, paymentId })

  if (!contexto.pagamentoId || !contexto.pagamento) {
    return {
      encontrado: false,
      status: 'pending',
      pagamentoId: pagamentoId || ''
    }
  }

  if (empresaId && contexto.pagamento.empresaId !== empresaId) {
    erro(403, 'Este pagamento nao pertence a empresa autenticada.')
  }

  const pagamentoMp = contexto.paymentId
    ? await chamarMercadoPago(`/v1/payments/${contexto.paymentId}`)
    : await buscarPagamentoPorReferencia(contexto.pagamento.externalReference)

  if (!pagamentoMp) {
    return {
      encontrado: false,
      pagamentoId: contexto.pagamentoId,
      status: contexto.pagamento.status || 'pending',
      externalReference: contexto.pagamento.externalReference || ''
    }
  }

  const referencia = textoSeguro(pagamentoMp.external_reference)

  if (referencia && referencia !== contexto.pagamento.externalReference) {
    erro(403, 'Pagamento retornado nao pertence ao registro interno.')
  }

  return processarPagamentoMercadoPago({
    pagamentoId: contexto.pagamentoId,
    pagamentoMp
  })
}

async function resolverPagamentoInterno({ pagamentoId, preferenceId, paymentId }) {
  if (pagamentoId) {
    const pagamentoDoc = await db.collection('pagamentos').doc(pagamentoId).get()
    return {
      pagamentoId,
      pagamento: pagamentoDoc.exists ? pagamentoDoc.data() : null,
      paymentId
    }
  }

  if (paymentId && /^\d+$/.test(paymentId)) {
    const pagamentoMp = await chamarMercadoPago(`/v1/payments/${paymentId}`)
    const pagamentoIdExterno = extrairPagamentoIdDaReferencia(pagamentoMp.external_reference)

    if (!pagamentoIdExterno) {
      erro(403, 'Pagamento nao pertence ao Selectio.')
    }

    const pagamentoDoc = await db.collection('pagamentos').doc(pagamentoIdExterno).get()
    return {
      pagamentoId: pagamentoIdExterno,
      pagamento: pagamentoDoc.exists ? pagamentoDoc.data() : null,
      paymentId
    }
  }

  if (preferenceId) {
    const snapshot = await db.collection('pagamentos')
      .where('mercadoPagoPreferenceId', '==', preferenceId)
      .limit(1)
      .get()
    const documento = snapshot.docs[0]

    return {
      pagamentoId: documento?.id || '',
      pagamento: documento?.exists ? documento.data() : null,
      paymentId: ''
    }
  }

  erro(400, 'Informe pagamentoId, preferenceId ou paymentId.')
}

async function processarPagamentoMercadoPago({ pagamentoId, pagamentoMp }) {
  const pagamentoRef = db.collection('pagamentos').doc(pagamentoId)
  const transacaoRef = db.collection('transacoesPagamento').doc(pagamentoId)
  const statusOriginal = normalizarStatus(pagamentoMp.status)
  const mercadoPagoPaymentId = String(pagamentoMp.id || '')
  const statusDetail = textoSeguro(pagamentoMp.status_detail)
  const valorPago = Number(pagamentoMp.transaction_amount || 0)
  let resultado
  let notificacaoContexto

  await db.runTransaction(async (transaction) => {
    const pagamentoDoc = await transaction.get(pagamentoRef)

    if (!pagamentoDoc.exists) {
      erro(404, 'Registro interno do pagamento nao encontrado.')
    }

    const pagamento = pagamentoDoc.data() || {}
    const valorEsperado = Number(pagamento.valor || 0)
    let status = statusOriginal
    let detalhe = statusDetail

    if (Math.abs(valorPago - valorEsperado) >= 0.01) {
      status = 'failed'
      detalhe = 'valor_divergente'
    }

    const agora = FieldValue.serverTimestamp()
    const transacaoEm = timestampSeguro(pagamentoMp.date_created)
    const atualizadoEm = timestampSeguro(pagamentoMp.date_last_updated) || agora
    const encerradoEm = statusEncerrados.has(status)
      ? timestampSeguro(pagamentoMp.date_last_updated || pagamentoMp.date_approved) || agora
      : null
    const atualizacaoPagamento = {
      mercadoPagoPaymentId,
      status,
      statusDetail: detalhe,
      transacaoEm,
      atualizadoEm
    }

    if (status === 'approved') {
      atualizacaoPagamento.aprovadoEm = timestampSeguro(pagamentoMp.date_approved) || agora
    }

    if (encerradoEm) {
      atualizacaoPagamento.encerradoEm = encerradoEm
    }

    transaction.update(pagamentoRef, atualizacaoPagamento)
    transaction.set(transacaoRef, {
      pagamentoId,
      empresaId: pagamento.empresaId,
      indicadorId: pagamento.indicadorId,
      ambiente: pagamento.ambiente || mpEnvironment,
      status,
      statusDetail: detalhe,
      mercadoPagoPreferenceId: pagamento.mercadoPagoPreferenceId || '',
      mercadoPagoPaymentId,
      valor: valorEsperado,
      moeda: pagamento.moeda || moedaPadrao,
      criadoEm: pagamento.criadoEm || agora,
      atualizadoEm,
      encerradoEm,
      transacaoEm
    }, { merge: true })

    if (
      status === 'approved'
      && !pagamento.creditado
      && pagamento.ambiente !== 'sandbox'
    ) {
      const saldoRef = db.collection('indicadorSaldos').doc(pagamento.indicadorId)
      const movimentacaoRef = db.collection('movimentacoesFinanceiras').doc()

      transaction.set(saldoRef, {
        indicadorId: pagamento.indicadorId,
        saldoDisponivel: FieldValue.increment(valorEsperado),
        saldoPendente: FieldValue.increment(0),
        totalRecebido: FieldValue.increment(valorEsperado),
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

      transaction.update(pagamentoRef, { creditado: true })
    }

    resultado = {
      encontrado: true,
      pagamentoId,
      empresaId: pagamento.empresaId,
      indicadorId: pagamento.indicadorId,
      status,
      statusDetail: detalhe,
      mercadoPagoPaymentId,
      valor: valorEsperado,
      ambiente: pagamento.ambiente || mpEnvironment,
      externalReference: pagamento.externalReference || '',
      transacaoEm: pagamentoMp.date_created || null,
      aprovadoEm: pagamentoMp.date_approved || null,
      atualizadoEm: pagamentoMp.date_last_updated || null,
      encerradoEm: statusEncerrados.has(status)
        ? pagamentoMp.date_last_updated || pagamentoMp.date_approved || null
        : null
    }
    notificacaoContexto = {
      pagamento,
      statusAnterior: pagamento.status || 'pending',
      statusAtual: status
    }
  })

  if (notificacaoContexto) {
    await notificarPagamento({
      pagamentoId,
      pagamento: notificacaoContexto.pagamento,
      statusAnterior: notificacaoContexto.statusAnterior,
      statusAtual: notificacaoContexto.statusAtual
    })
  }

  return resultado
}

async function criarPreferenciaMercadoPago({ pagamentoId, pagamento, referenciaExterna, appUrl }) {
  return chamarMercadoPago('/checkout/preferences', {
    method: 'POST',
    headers: {
      'X-Idempotency-Key': pagamentoId
    },
    body: JSON.stringify({
      items: [{
        title: pagamento.descricao.slice(0, 120),
        quantity: 1,
        unit_price: Number(pagamento.valor.toFixed(2)),
        currency_id: moedaPadrao
      }],
      back_urls: {
        success: `${appUrl}/painel/empresa?secao=pagamentos&status=success`,
        failure: `${appUrl}/painel/empresa?secao=pagamentos&status=failure`,
        pending: `${appUrl}/painel/empresa?secao=pagamentos&status=pending`
      },
      binary_mode: false,
      external_reference: referenciaExterna,
      metadata: {
        ambiente: mpEnvironment,
        pagamentoId,
        candidatoId: pagamento.candidatoId,
        empresaId: pagamento.empresaId,
        indicadorId: pagamento.indicadorId,
        vagaId: pagamento.vagaId
      }
    })
  })
}

async function buscarPagamentoPorReferencia(externalReference) {
  if (!externalReference) return null

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

async function marcarPagamentoComoFalhou({ pagamentoRef, transacaoRef, pagamento, detalhe }) {
  const atualizacao = {
    status: 'failed',
    statusDetail: String(detalhe || 'erro_criar_preferencia').slice(0, 180),
    atualizadoEm: FieldValue.serverTimestamp(),
    encerradoEm: FieldValue.serverTimestamp()
  }

  await db.batch()
    .update(pagamentoRef, atualizacao)
    .update(transacaoRef, atualizacao)
    .commit()

  await notificarPagamento({
    pagamentoId: pagamentoRef.id,
    pagamento,
    statusAnterior: 'created',
    statusAtual: 'failed'
  })
}

async function notificarPagamento({ pagamentoId, pagamento, statusAnterior = '', statusAtual }) {
  const status = normalizarStatus(statusAtual)
  const info = infoStatusPagamento(status)

  if (!info) return

  const valor = dinheiro(pagamento.valor)
  const candidatoNome = textoSeguro(pagamento.candidatoNome, 'Candidato')
  const vagaTitulo = textoSeguro(pagamento.vagaTitulo, 'vaga informada')
  const metadata = {
    pagamentoId,
    candidatoId: textoSeguro(pagamento.candidatoId),
    vagaId: textoSeguro(pagamento.vagaId),
    empresaId: textoSeguro(pagamento.empresaId),
    indicadorId: textoSeguro(pagamento.indicadorId),
    statusAnterior,
    statusAtual: status
  }

  if (pagamento.indicadorId) {
    const mensagem = status === 'approved'
      ? `Voce recebeu ${valor} pela indicacao de ${candidatoNome} para ${vagaTitulo}.`
      : `${info.mensagemIndicador}: ${valor} por ${candidatoNome} em ${vagaTitulo}.`

    await registrarNotificacao(
      ['pagamento', pagamentoId, 'indicador', status],
      {
        userId: pagamento.indicadorId,
        tipo: info.tipo,
        titulo: info.tituloIndicador || info.titulo,
        mensagem,
        link: '/painel/indicador?secao=financeiro',
        metadata
      }
    )
  }

  if (pagamento.empresaId) {
    const mensagem = status === 'approved'
      ? `Pagamento de ${valor} aprovado para ${candidatoNome}.`
      : `${info.mensagemEmpresa}: ${valor} para ${candidatoNome} em ${vagaTitulo}.`

    await registrarNotificacao(
      ['pagamento', pagamentoId, 'empresa', status],
      {
        userId: pagamento.empresaId,
        tipo: info.tipo,
        titulo: info.tituloEmpresa || info.titulo,
        mensagem,
        link: '/painel/empresa?secao=pagamentos',
        metadata
      }
    )
  }
}

async function registrarNotificacao(id, payload) {
  if (!payload?.userId) return

  await db.collection('notificacoes')
    .doc(notificacaoId(...id))
    .set({
      ...payload,
      lida: false,
      origem: 'backend-local',
      criadoEm: FieldValue.serverTimestamp()
    }, { merge: true })
}

function obterValorRecompensaFixa({ vaga, candidato }) {
  const tipo = textoSeguro(vaga.recompensaTipo || candidato.recompensaTipo).toLowerCase()

  if (tipo && tipo !== 'fixo') {
    erroRecompensaFixa()
  }

  const valorNumerico = primeiroNumeroValido(
    vaga.recompensaValorFixo,
    candidato.recompensaValorFixo
  )

  if (valorNumerico) return valorNumerico

  const texto = textoSeguro(vaga.recompensa || candidato.recompensa)

  if (!texto || recompensaParecePercentualOuLivre(texto) || !recompensaPareceValorFixo(texto)) {
    erroRecompensaFixa()
  }

  const valor = valorMonetario(texto)

  if (!valor) erroRecompensaFixa()

  return valor
}

function erroRecompensaFixa() {
  erro(
    400,
    'Esta vaga nao possui recompensa fixa. Defina um valor fixo para liberar pagamento automatico.'
  )
}

function recompensaParecePercentualOuLivre(texto) {
  return /%|percent|sal[aá]rio|combinar|consultar|a definir|sob consulta/i.test(texto)
}

function recompensaPareceValorFixo(texto) {
  return /^(r\$\s*)?\d[\d.\s]*(,\d{1,2})?$/i.test(texto.trim())
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

function primeiroNumeroValido(...valores) {
  for (const valor of valores) {
    const numero = valorMonetario(valor)
    if (numero) return numero
  }

  return null
}

function respostaPagamentoExistente(pagamento) {
  return {
    pagamentoId: pagamento.id,
    preferenceId: pagamento.mercadoPagoPreferenceId || '',
    checkoutUrl: obterCheckoutUrlPagamento(pagamento),
    initPoint: pagamento.checkoutUrl || '',
    sandboxInitPoint: pagamento.sandboxCheckoutUrl || '',
    externalReference: pagamento.externalReference || '',
    status: pagamento.status,
    valor: Number(pagamento.valor || 0),
    ambiente: pagamento.ambiente || mpEnvironment,
    reused: true
  }
}

function obterCheckoutUrlPagamento(pagamento) {
  return pagamento?.sandboxCheckoutUrl || pagamento?.checkoutUrl || ''
}

function escolherCheckoutUrl(preferencia) {
  if (mpEnvironment === 'sandbox') {
    return preferencia.sandbox_init_point || preferencia.init_point || ''
  }

  return preferencia.init_point || preferencia.sandbox_init_point || ''
}

function criarPagamentoId({ empresaId, candidatoId }) {
  return notificacaoId('pagamento', empresaId, candidatoId)
}

function notificacaoId(...partes) {
  return partes
    .map((parte) => textoSeguro(parte, 'sem-valor').toLowerCase())
    .join('_')
    .replace(/[^a-z0-9_-]+/g, '-')
    .slice(0, 180)
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

function normalizarStatus(status) {
  const statuses = {
    created: 'created',
    approved: 'approved',
    pending: 'pending',
    in_process: 'pending',
    authorized: 'pending',
    rejected: 'rejected',
    cancelled: 'cancelled',
    canceled: 'cancelled',
    refunded: 'refunded',
    charged_back: 'refunded',
    failed: 'failed'
  }

  return statuses[status] || 'failed'
}

function infoStatusPagamento(status) {
  return {
    created: {
      tipo: 'pagamento_criado',
      titulo: 'Pagamento criado',
      mensagemIndicador: 'A empresa iniciou o pagamento da sua recompensa',
      mensagemEmpresa: 'Pagamento de recompensa criado'
    },
    pending: {
      tipo: 'pagamento_pendente',
      titulo: 'Pagamento pendente',
      mensagemIndicador: 'Pagamento da recompensa aguardando confirmacao do Mercado Pago',
      mensagemEmpresa: 'Pagamento aguardando confirmacao do Mercado Pago'
    },
    approved: {
      tipo: 'pagamento_aprovado',
      tituloIndicador: 'Pagamento recebido',
      tituloEmpresa: 'Pagamento aprovado',
      mensagemIndicador: 'Voce recebeu a recompensa',
      mensagemEmpresa: 'Pagamento de recompensa aprovado'
    },
    rejected: {
      tipo: 'pagamento_recusado',
      titulo: 'Pagamento recusado',
      mensagemIndicador: 'O pagamento da recompensa foi recusado',
      mensagemEmpresa: 'O Mercado Pago recusou o pagamento'
    },
    cancelled: {
      tipo: 'pagamento_cancelado',
      titulo: 'Pagamento cancelado',
      mensagemIndicador: 'O pagamento da recompensa foi cancelado',
      mensagemEmpresa: 'Pagamento de recompensa cancelado'
    },
    refunded: {
      tipo: 'pagamento_estornado',
      titulo: 'Pagamento estornado',
      mensagemIndicador: 'O pagamento da recompensa foi estornado',
      mensagemEmpresa: 'Pagamento de recompensa estornado'
    },
    failed: {
      tipo: 'pagamento_falhou',
      titulo: 'Pagamento falhou',
      mensagemIndicador: 'Nao foi possivel confirmar o pagamento da recompensa',
      mensagemEmpresa: 'O pagamento de recompensa falhou'
    }
  }[status]
}

async function chamarMercadoPago(caminho, opcoes = {}) {
  const resposta = await fetch(`https://api.mercadopago.com${caminho}`, {
    ...opcoes,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(opcoes.headers || {})
    }
  })
  const corpo = await resposta.json().catch(() => ({}))

  if (!resposta.ok) {
    const error = new Error(
      corpo.message
      || corpo.error
      || 'O Mercado Pago recusou a operacao.'
    )
    error.status = resposta.status >= 400 && resposta.status < 500 ? 400 : 502
    throw error
  }

  return corpo
}

function inicializarFirebaseAdmin() {
  if (admin.apps.length) return

  const credenciaisPath = textoSeguro(process.env.GOOGLE_APPLICATION_CREDENTIALS)

  if (credenciaisPath) {
    const caminhoResolvido = path.isAbsolute(credenciaisPath)
      ? credenciaisPath
      : path.join(raizProjeto, credenciaisPath)
    const serviceAccount = JSON.parse(fs.readFileSync(caminhoResolvido, 'utf8'))

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: projectId || serviceAccount.project_id
    })
    return
  }

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId
  })
}

async function autenticarRequisicao(req) {
  const authorization = textoSeguro(req.headers.authorization)
  const match = authorization.match(/^Bearer\s+(.+)$/i)

  if (!match) {
    erro(401, 'Autenticacao Firebase obrigatoria.')
  }

  try {
    return await admin.auth().verifyIdToken(match[1], true)
  } catch {
    erro(401, 'Sessao Firebase invalida ou expirada.')
  }
}

function validarWebhookMercadoPago(req, requestUrl, dados) {
  const segredo = textoSeguro(process.env.MP_WEBHOOK_SECRET)
  if (!segredo) return false

  const assinatura = textoSeguro(req.headers['x-signature'])
  const requestId = textoSeguro(req.headers['x-request-id'])
  const dataId = textoSeguro(
    requestUrl.searchParams.get('data.id')
    || requestUrl.searchParams.get('id')
    || dados?.data?.id
    || dados?.id
  ).toLowerCase()
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

function carregarEnvEmProcesso(arquivos) {
  arquivos.forEach((arquivo) => {
    if (!fs.existsSync(arquivo)) return

    fs.readFileSync(arquivo, 'utf8')
      .split(/\r?\n/)
      .forEach((linha) => {
        const conteudo = linha.trim()
        if (!conteudo || conteudo.startsWith('#')) return

        const separador = conteudo.indexOf('=')
        if (separador < 1) return

        const chave = conteudo.slice(0, separador).trim()
        const valor = conteudo.slice(separador + 1).trim().replace(/^(['"])(.*)\1$/, '$2')

        if (!(chave in process.env)) {
          process.env[chave] = valor
        }
      })
  })
}

function aplicarCors(res, origem) {
  if (origem) res.setHeader('Access-Control-Allow-Origin', origem)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
}

function origemPermitida(origem) {
  try {
    const url = new URL(origem)
    const appUrl = new URL(appUrlPadrao)
    return ['localhost', '127.0.0.1'].includes(url.hostname)
      || url.origin === appUrl.origin
  } catch {
    return false
  }
}

function obterAppUrl(valor) {
  const appUrl = textoSeguro(valor, appUrlPadrao).replace(/\/$/, '')

  if (!origemPermitida(appUrl)) {
    erro(400, 'URL local do aplicativo invalida.')
  }

  return appUrl
}

function timestampSeguro(valor) {
  if (!valor) return null

  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? null : Timestamp.fromDate(data)
}

function dataMs(valor) {
  if (!valor) return 0
  if (typeof valor.toDate === 'function') return valor.toDate().getTime()

  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? 0 : data.getTime()
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

function responderJson(res, status, corpo) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(corpo))
}

function lerJson(req) {
  return new Promise((resolve, reject) => {
    let corpo = ''

    req.on('data', (parte) => {
      corpo += parte
      if (corpo.length > 100_000) {
        reject(new Error('Corpo da requisicao muito grande.'))
        req.destroy()
      }
    })

    req.on('end', () => {
      try {
        resolve(corpo ? JSON.parse(corpo) : {})
      } catch {
        reject(new Error('JSON invalido.'))
      }
    })

    req.on('error', reject)
  })
}

function erro(status, message) {
  const error = new Error(message)
  error.status = status
  throw error
}
