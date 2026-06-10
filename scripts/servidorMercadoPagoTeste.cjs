const crypto = require('node:crypto')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')

const host = '127.0.0.1'
const port = Number(process.env.MERCADO_PAGO_SANDBOX_PORT || 8787)
const raizProjeto = path.resolve(__dirname, '..')
const variaveis = carregarEnv(path.join(raizProjeto, 'functions', '.env'))
const accessToken = process.env.MERCADO_PAGO_TEST_ACCESS_TOKEN
  || variaveis.MERCADO_PAGO_TEST_ACCESS_TOKEN
const statusEncerrados = new Set([
  'approved',
  'rejected',
  'cancelled',
  'refunded',
  'charged_back'
])

if (!accessToken) {
  throw new Error(
    'MERCADO_PAGO_TEST_ACCESS_TOKEN não configurado em functions/.env. Use a credencial da seção Testes > Credenciais de teste.'
  )
}

const servidor = http.createServer(async (req, res) => {
  const origem = req.headers.origin || ''

  if (origem && !origemLocalPermitida(origem)) {
    responderJson(res, 403, { error: 'Origem não permitida.' })
    return
  }

  aplicarCors(res, origem)

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method === 'GET' && req.url === '/status') {
    responderJson(res, 200, {
      ativo: true,
      ambiente: 'sandbox',
      armazenamentoCartao: false
    })
    return
  }

  if (req.method === 'POST' && req.url === '/criar-preferencia') {
    await criarPreferencia(req, res)
    return
  }

  if (req.method === 'POST' && req.url === '/consultar-pagamento') {
    await consultarPagamento(req, res)
    return
  }

  responderJson(res, 404, { error: 'Rota não encontrada.' })
})

async function criarPreferencia(req, res) {
  try {
    const dados = await lerJson(req)
    const valor = Number(dados.valor)
    const pagamentoId = textoSeguro(dados.pagamentoId)
    const empresaId = textoSeguro(dados.empresaId)

    if (!pagamentoId || !empresaId || !Number.isFinite(valor) || valor <= 0) {
      responderJson(res, 400, { error: 'Informe um valor de teste válido.' })
      return
    }

    const descricao = textoSeguro(dados.descricao, 'Teste Selectio - Recompensa')
    const referencia = montarReferenciaExterna({
      pagamentoId,
      empresaId,
      indicadorId: textoSeguro(dados.indicadorId),
      vagaId: textoSeguro(dados.vagaId),
      candidatoId: textoSeguro(dados.candidatoId),
      indicacaoId: textoSeguro(dados.indicacaoId)
    })
    const appUrl = obterAppUrlLocal(dados.appUrl)

    const corpo = await chamarMercadoPago('/checkout/preferences', {
      method: 'POST',
      headers: {
        'X-Idempotency-Key': crypto.randomUUID()
      },
      body: JSON.stringify({
        items: [{
          title: descricao.slice(0, 120),
          quantity: 1,
          unit_price: Number(valor.toFixed(2)),
          currency_id: 'BRL'
        }],
        back_urls: {
          success: `${appUrl}/painel/empresa?secao=pagamentos&status=success`,
          failure: `${appUrl}/painel/empresa?secao=pagamentos&status=failure`,
          pending: `${appUrl}/painel/empresa?secao=pagamentos&status=pending`
        },
        binary_mode: false,
        external_reference: referencia,
        metadata: {
          ambiente: 'sandbox',
          pagamentoId,
          candidatoId: textoSeguro(dados.candidatoId),
          empresaId: textoSeguro(dados.empresaId),
          indicadorId: textoSeguro(dados.indicadorId),
          vagaId: textoSeguro(dados.vagaId)
        }
      })
    })

    const checkoutUrl = corpo.sandbox_init_point || ''
    if (!checkoutUrl) {
      responderJson(res, 502, { error: 'O Mercado Pago não retornou uma URL de sandbox.' })
      return
    }

    responderJson(res, 201, {
      pagamentoId,
      preferenceId: corpo.id,
      checkoutUrl,
      initPoint: corpo.init_point || '',
      sandboxInitPoint: checkoutUrl,
      externalReference: referencia,
      status: 'pending',
      ambiente: 'sandbox'
    })
  } catch (error) {
    console.error('Erro no servidor sandbox Mercado Pago:', error)
    responderJson(res, error.status || 500, {
      error: error.message || 'Não foi possível criar a preferência de sandbox.'
    })
  }
}

async function consultarPagamento(req, res) {
  try {
    const dados = await lerJson(req)
    const paymentId = String(dados.paymentId || '').trim()
    const externalReference = textoSeguro(dados.externalReference)
    let pagamento

    if (/^\d+$/.test(paymentId)) {
      pagamento = await chamarMercadoPago(`/v1/payments/${paymentId}`)
    } else if (externalReference.startsWith('selectio:')) {
      pagamento = await buscarPagamentoPorReferencia(externalReference)
    } else {
      responderJson(res, 400, { error: 'Identificador ou referência de pagamento inválida.' })
      return
    }

    if (!pagamento) {
      responderJson(res, 200, {
        encontrado: false,
        status: 'pending',
        externalReference
      })
      return
    }

    const referencia = textoSeguro(pagamento.external_reference)

    if (!referencia.startsWith('selectio:')) {
      responderJson(res, 403, { error: 'Pagamento não pertence ao Selectio.' })
      return
    }

    const status = normalizarStatus(pagamento.status)

    responderJson(res, 200, {
      encontrado: true,
      mercadoPagoPaymentId: String(pagamento.id || paymentId),
      status,
      statusDetail: textoSeguro(pagamento.status_detail),
      valor: Number(pagamento.transaction_amount || 0),
      moeda: textoSeguro(pagamento.currency_id, 'BRL'),
      externalReference: referencia,
      transacaoEm: pagamento.date_created || null,
      aprovadoEm: pagamento.date_approved || null,
      atualizadoEm: pagamento.date_last_updated || null,
      encerradoEm: statusEncerrados.has(pagamento.status)
        ? pagamento.date_last_updated || pagamento.date_approved || null
        : null,
      ambiente: 'sandbox'
    })
  } catch (error) {
    console.error('Erro ao consultar pagamento sandbox:', error)
    responderJson(res, error.status || 500, {
      error: error.message || 'Não foi possível consultar o pagamento de sandbox.'
    })
  }
}

async function buscarPagamentoPorReferencia(externalReference) {
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

validarContaSandbox()
  .then(() => {
    servidor.listen(port, host, () => {
      console.log(`Sandbox Mercado Pago disponível em http://${host}:${port}`)
    })
  })
  .catch((error) => {
    console.error('Não foi possível iniciar o sandbox Mercado Pago:', error.message)
    process.exitCode = 1
  })

async function validarContaSandbox() {
  const usuario = await chamarMercadoPago('/users/me')
  const nickname = textoSeguro(usuario.nickname)

  if (!nickname.startsWith('TESTUSER')) {
    throw new Error(
      'MERCADO_PAGO_TEST_ACCESS_TOKEN não pertence a um usuário de teste TESTUSER.'
    )
  }
}

function carregarEnv(arquivo) {
  if (!fs.existsSync(arquivo)) return {}

  return fs.readFileSync(arquivo, 'utf8')
    .split(/\r?\n/)
    .reduce((resultado, linha) => {
      const conteudo = linha.trim()
      if (!conteudo || conteudo.startsWith('#')) return resultado

      const separador = conteudo.indexOf('=')
      if (separador < 1) return resultado

      const chave = conteudo.slice(0, separador).trim()
      const valor = conteudo.slice(separador + 1).trim().replace(/^(['"])(.*)\1$/, '$2')
      resultado[chave] = valor
      return resultado
    }, {})
}

function aplicarCors(res, origem) {
  if (origem) res.setHeader('Access-Control-Allow-Origin', origem)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
}

function origemLocalPermitida(origem) {
  try {
    const url = new URL(origem)
    return ['localhost', '127.0.0.1'].includes(url.hostname)
      && /^51\d{2}$/.test(url.port)
  } catch {
    return false
  }
}

function obterAppUrlLocal(valor) {
  const appUrl = textoSeguro(valor, 'http://localhost:5173')

  if (!origemLocalPermitida(appUrl)) {
    throw new Error('URL local do aplicativo inválida.')
  }

  return appUrl.replace(/\/$/, '')
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

function normalizarStatus(status) {
  const statuses = {
    approved: 'approved',
    pending: 'pending',
    in_process: 'pending',
    authorized: 'pending',
    rejected: 'rejected',
    cancelled: 'cancelled',
    refunded: 'refunded',
    charged_back: 'refunded'
  }

  return statuses[status] || 'failed'
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
      || 'O Mercado Pago recusou a operação de sandbox.'
    )
    error.status = resposta.status >= 400 && resposta.status < 500 ? 400 : 502
    throw error
  }

  return corpo
}

function responderJson(res, status, corpo) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(corpo))
}

function textoSeguro(valor, fallback = '') {
  const texto = String(valor || '').trim()
  return texto || fallback
}

function lerJson(req) {
  return new Promise((resolve, reject) => {
    let corpo = ''

    req.on('data', (parte) => {
      corpo += parte
      if (corpo.length > 100_000) {
        reject(new Error('Corpo da requisição muito grande.'))
        req.destroy()
      }
    })

    req.on('end', () => {
      try {
        resolve(corpo ? JSON.parse(corpo) : {})
      } catch {
        reject(new Error('JSON inválido.'))
      }
    })

    req.on('error', reject)
  })
}
