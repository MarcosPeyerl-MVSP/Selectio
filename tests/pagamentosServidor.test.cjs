const assert = require('node:assert/strict')
const { test, before, beforeEach, after } = require('node:test')
const crypto = require('node:crypto')
const { createRequire } = require('node:module')
const path = require('node:path')
const deps = createRequire(path.resolve('functions/package.json'))
process.env.GCLOUD_PROJECT = 'selectio-1f022'
process.env.FUNCTIONS_EMULATOR = 'true'
process.env.APP_URL = 'https://selectio.app.br'
process.env.MP_ENVIRONMENT = 'production'
process.env.MERCADO_PAGO_ACCESS_TOKEN = 'dummy'
process.env.MP_WEBHOOK_SECRET = 'dummy'
const { getFirestore } = deps('firebase-admin/firestore')
const { getAuth } = deps('firebase-admin/auth')
const { getApp, deleteApp } = deps('firebase-admin/app')
// Nunca deixa os testes financeiros acessarem Firestore real.
assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'Use o emulador Firestore')
const { handleMercadoPagoRequest, validarWebhookMercadoPago } = require('../functions/src/mercadoPagoCore.cjs')
const db = getFirestore()
const originalFetch = global.fetch
let requests, postRequests, responseMp, verifyOriginal, preferenceResponse, preferencePayload, vendedorResponse

before(() => {
  verifyOriginal = getAuth().verifyIdToken
  getAuth().verifyIdToken = async (uid) => ({ uid })
})
beforeEach(async () => {
  await originalFetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/selectio-1f022/databases/(default)/documents`, { method: 'DELETE' })
  requests = 0
  postRequests = 0
  process.env.MP_ENVIRONMENT = 'production'
  process.env.MERCADO_PAGO_ACCESS_TOKEN = 'dummy'
  vendedorResponse = { id: 12345, tags: ['test_user'] }
  preferenceResponse = { id: 'pref', init_point: 'https://www.mercadopago.com.br/checkout', sandbox_init_point: 'https://sandbox.mercadopago.com.br/checkout' }
  preferencePayload = null
  responseMp = { id: '123', external_reference: 'ref', transaction_amount: 100, currency_id: 'BRL', status: 'approved', live_mode: true }
  global.fetch = async (url, options) => {
    assert.match(String(url), /^https:\/\/api\.mercadopago\.com\//)
    requests++
    if (String(url).endsWith('/users/me')) return { ok: true, json: async () => vendedorResponse }
    if (options?.method === 'POST') {
      postRequests++
      preferencePayload = JSON.parse(options.body)
      return { ok: true, json: async () => preferenceResponse }
    }
    if (String(url).includes('/checkout/preferences/')) return { ok: true, json: async () => preferenceResponse }
    return { ok: true, json: async () => responseMp }
  }
})
after(async () => {
  global.fetch = originalFetch
  getAuth().verifyIdToken = verifyOriginal
  await db.terminate()
  await deleteApp(getApp())
})

async function request(url, body, uid = 'empresa-1', headers = {}) {
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v }, writeHead(status) { this.status = status }, end(value) { this.body = JSON.parse(value || '{}') } }
  await handleMercadoPagoRequest({ url, method: 'POST', headers: { authorization: `Bearer ${uid}`, ...headers }, body }, res)
  return res
}
async function seedPayment() {
  await db.doc('pagamentos/pagamento-1').set({ empresaId: 'empresa-1', indicadorId: 'indicador-1', candidatoId: 'candidato-1', vagaId: 'vaga-1',
    valor: 100, status: 'pending', creditado: false, ambiente: 'production', externalReference: 'ref' })
}

async function prepararReparoLegado() {
  await seedPayment()
  process.env.MP_ENVIRONMENT = 'sandbox'
  process.env.MERCADO_PAGO_ACCESS_TOKEN = 'APP_USR-fixture'
  const original = `selectio:pagamento-1:${'legado'.repeat(45)}`
  await db.doc('pagamentos/pagamento-1').update({ ambiente: 'sandbox', externalReference: original, mercadoPagoPreferenceId: 'pref-legada' })
  const state = {
    puts: 0, failPut: false, payment: null,
    preference: { id: 'pref-legada', collector_id: 12345, external_reference: original, metadata: { pagamentoId: 'pagamento-1' }, items: [{ currency_id: 'BRL', unit_price: 100, quantity: 1 }] },
    orders: { total: 1, elements: [{ payments: [], paid_amount: 0 }] }
  }
  global.fetch = async (url, options) => {
    const path = new URL(url).pathname
    requests++
    if (options?.method === 'POST') postRequests++
    if (path === '/users/me') return { ok: true, json: async () => vendedorResponse }
    if (path.startsWith('/checkout/preferences/')) {
      if (options?.method === 'PUT') {
        state.puts++
        assert.deepEqual(Object.keys(JSON.parse(options.body)), ['external_reference'])
        Object.assign(state.preference, JSON.parse(options.body))
        if (state.failPut) throw new Error('timeout apos aceite do PUT')
      }
      return { ok: true, json: async () => state.preference }
    }
    if (path === '/merchant_orders/search') return { ok: true, json: async () => state.orders }
    if (path === '/v1/payments/search') return { ok: true, json: async () => ({ paging: { total: 0 }, results: [] }) }
    if (path.startsWith('/v1/payments/')) return { ok: true, json: async () => state.payment || responseMp }
    throw new Error('Rota inesperada no teste de reparo')
  }
  return { state, original }
}

test('repara somente a referencia da mesma preferencia sandbox sem criar cobranca e permite repetir', async () => {
  const { state, original } = await prepararReparoLegado()
  for (let i = 0; i < 2; i++) {
    const resultado = await request('/sincronizar-pagamento', { pagamentoId: 'pagamento-1' })
    assert.equal(resultado.status, 200)
    assert.equal(resultado.body.encontrado, false)
    assert.equal(resultado.body.checkoutReparado, true)
  }
  const salvo = (await db.doc('pagamentos/pagamento-1').get()).data()
  assert.equal(salvo.externalReference, original)
  assert.equal(salvo.externalReferenceReparada, 'selectio:pagamento-1')
  assert.equal(salvo.mercadoPagoPreferenceId, 'pref-legada')
  assert.equal(state.preference.external_reference, 'selectio:pagamento-1')
  assert.equal(state.puts, 1)
  assert.equal(postRequests, 0)
})

test('reparo aceita confirmacoes na referencia nova e original sem liberar saldo sandbox', async () => {
  const { state, original } = await prepararReparoLegado()
  await request('/sincronizar-pagamento', { pagamentoId: 'pagamento-1' })
  for (const reference of ['selectio:pagamento-1', original, 'selectio:pagamento-1']) {
    state.payment = { ...responseMp, external_reference: reference, live_mode: false }
    const resultado = await request('/sincronizar-pagamento', { paymentId: '123' })
    assert.equal(resultado.status, 200)
    assert.equal(resultado.body.status, 'approved')
  }
  assert.equal((await db.doc('indicadorSaldos/indicador-1').get()).exists, false)
  assert.equal((await db.collection('movimentacoesFinanceiras').get()).size, 0)
})

test('reparo ignora producao, aprovados, ordens incompletas e ordens com pagamento', async () => {
  for (const scenario of ['production', 'approved', 'incomplete', 'paid', 'wrong-metadata', 'wrong-seller', 'real-seller']) {
    const { state } = await prepararReparoLegado()
    if (scenario === 'production') await db.doc('pagamentos/pagamento-1').update({ ambiente: 'production' })
    if (scenario === 'approved') await db.doc('pagamentos/pagamento-1').update({ status: 'approved' })
    if (scenario === 'incomplete') state.orders.total = 2
    if (scenario === 'paid') state.orders.elements[0].paid_amount = 100
    if (scenario === 'wrong-metadata') state.preference.metadata.pagamentoId = 'outro'
    if (scenario === 'wrong-seller') state.preference.collector_id = 98765
    if (scenario === 'real-seller') vendedorResponse = { tags: [] }
    const resultado = await request('/sincronizar-pagamento', { pagamentoId: 'pagamento-1' })
    assert.ok([200, 400].includes(resultado.status), scenario)
    assert.equal(state.puts, 0, scenario)
    assert.equal((await db.doc('pagamentos/pagamento-1').get()).data().externalReferenceReparada, undefined, scenario)
    vendedorResponse = { id: 12345, tags: ['test_user'] }
  }
})

test('timeout do reparo preserva ambas as referencias para conciliacao e retry sem outro PUT', async () => {
  const { state, original } = await prepararReparoLegado()
  state.failPut = true
  const primeira = await request('/sincronizar-pagamento', { pagamentoId: 'pagamento-1' })
  assert.equal(primeira.status, 500)
  const salvo = (await db.doc('pagamentos/pagamento-1').get()).data()
  assert.equal(salvo.externalReference, original)
  assert.equal(salvo.externalReferenceReparada, 'selectio:pagamento-1')
  state.failPut = false
  const segunda = await request('/sincronizar-pagamento', { pagamentoId: 'pagamento-1' })
  assert.equal(segunda.status, 200)
  assert.equal(segunda.body.checkoutReparado, true)
  assert.equal(state.puts, 1)
})

test('outro usuario nao repara a preferencia e referencia curta nao registrada continua recusada', async () => {
  const { state } = await prepararReparoLegado()
  const outraEmpresa = await request('/sincronizar-pagamento', { pagamentoId: 'pagamento-1' }, 'outra-empresa')
  assert.equal(outraEmpresa.status, 403)
  assert.equal(state.puts, 0)
  state.payment = { ...responseMp, external_reference: 'selectio:pagamento-1', live_mode: false }
  const resultado = await request('/sincronizar-pagamento', { paymentId: '123' })
  assert.equal(resultado.status, 403)
  assert.equal((await db.doc('pagamentos/pagamento-1').get()).data().status, 'pending')
})

test('preferencias concorrentes geram uma unica cobranca', async () => {
  await db.doc('candidatos/candidato-1').set({ empresaId: 'empresa-1', indicadorId: 'indicador-1', status: 'contratado', vagaId: 'vaga-1' })
  await db.doc('vagas/vaga-1').set({ empresaId: 'empresa-1', recompensaTipo: 'fixo', recompensaValorFixo: 100 })
  const responses = await Promise.all(Array.from({ length: 5 }, () => request('/criar-preferencia', { empresaId: 'empresa-1', candidatoId: 'candidato-1' })))
  assert.equal(responses.filter((r) => r.status === 201).length, 1)
  assert.ok(responses.every((r) => [200, 201, 409].includes(r.status)), JSON.stringify(responses))
  assert.equal((await db.collection('pagamentos').get()).size, 1)
  assert.equal(postRequests, 1)
})

test('timeout do provedor preserva reserva e impede segunda cobranca', async () => {
  await db.doc('candidatos/candidato-1').set({ empresaId: 'empresa-1', indicadorId: 'indicador-1', status: 'contratado', vagaId: 'vaga-1' })
  await db.doc('vagas/vaga-1').set({ empresaId: 'empresa-1', recompensaTipo: 'fixo', recompensaValorFixo: 100 })
  global.fetch = async () => { postRequests++; throw new Error('timeout simulado') }
  const body = { empresaId: 'empresa-1', candidatoId: 'candidato-1' }
  assert.equal((await request('/criar-preferencia', body)).status, 500)
  assert.equal((await request('/criar-preferencia', body)).status, 409)
  assert.equal(postRequests, 1)
  assert.equal((await db.collection('pagamentos').get()).docs[0].data().status, 'created')
})

test('checkout com IDs longos usa referencia curta e preserva os vinculos em metadata e no banco', async () => {
  const empresaId = 'e'.repeat(28)
  const indicadorId = 'i'.repeat(28)
  const candidatoId = 'c'.repeat(36)
  const vagaId = 'v'.repeat(20)
  const indicacaoId = 'n'.repeat(72)
  await db.doc(`candidatos/${candidatoId}`).set({ empresaId, indicadorId, status: 'contratado', vagaId, indicacaoId })
  await db.doc(`vagas/${vagaId}`).set({ empresaId, recompensaTipo: 'fixo', recompensaValorFixo: 1850 })
  const primeira = await request('/criar-preferencia', { empresaId, candidatoId, indicacaoId, vagaId }, empresaId)
  assert.equal(primeira.status, 201)
  const pagamentoId = primeira.body.pagamentoId
  const antiga = ['selectio', pagamentoId, empresaId, indicadorId, vagaId, candidatoId, indicacaoId].join(':')
  assert.ok(antiga.length > 256)
  assert.equal(preferencePayload.external_reference, `selectio:${pagamentoId}`)
  assert.ok(preferencePayload.external_reference.length <= 189)
  assert.equal(preferencePayload.items[0].unit_price, 1850)
  assert.deepEqual(preferencePayload.metadata, {
    ambiente: 'production', pagamentoId, candidatoId, empresaId, indicadorId, vagaId
  })
  const salvo = (await db.doc(`pagamentos/${pagamentoId}`).get()).data()
  assert.equal(salvo.externalReference, preferencePayload.external_reference)
  assert.equal(salvo.indicacaoId, indicacaoId)
  const segunda = await request('/criar-preferencia', { empresaId, candidatoId }, empresaId)
  assert.equal(segunda.status, 200)
  assert.equal(segunda.body.externalReference, salvo.externalReference)
  assert.equal(postRequests, 1)
})

test('sincronizacao por paymentId aceita referencia curta e preserva idempotencia do credito', async () => {
  await seedPayment()
  await db.doc('pagamentos/pagamento-1').update({ externalReference: 'selectio:pagamento-1' })
  responseMp = { ...responseMp, external_reference: 'selectio:pagamento-1' }
  for (let i = 0; i < 2; i++) {
    const resultado = await request('/sincronizar-pagamento', { paymentId: '123' })
    assert.equal(resultado.status, 200)
    assert.equal(resultado.body.pagamentoId, 'pagamento-1')
    assert.equal(resultado.body.status, 'approved')
  }
  assert.equal((await db.doc('indicadorSaldos/indicador-1').get()).data().saldoDisponivel, 100)
  assert.equal((await db.collection('movimentacoesFinanceiras').get()).size, 1)
})

test('checkout sandbox inclui retorno rastreavel e retoma a mesma preferencia', async () => {
  process.env.MP_ENVIRONMENT = 'sandbox'
  await db.doc('candidatos/candidato-1').set({ empresaId: 'empresa-1', indicadorId: 'indicador-1', status: 'contratado', vagaId: 'vaga-1' })
  await db.doc('vagas/vaga-1').set({ empresaId: 'empresa-1', recompensaTipo: 'fixo', recompensaValorFixo: 100 })
  const body = { empresaId: 'empresa-1', candidatoId: 'candidato-1', appUrl: 'https://selectio.app.br' }
  const primeira = await request('/criar-preferencia', body)
  assert.equal(primeira.status, 201)
  assert.equal(primeira.body.checkoutUrl, preferenceResponse.sandbox_init_point)
  for (const url of Object.values(preferencePayload.back_urls)) {
    const retorno = new URL(url)
    assert.equal(retorno.origin, 'https://selectio.app.br')
    assert.equal(retorno.searchParams.get('pagamento_id'), primeira.body.pagamentoId)
    assert.equal(retorno.searchParams.get('secao'), 'pagamentos')
  }
  const segunda = await request('/criar-preferencia', body)
  assert.equal(segunda.status, 200)
  assert.equal(segunda.body.reused, true)
  assert.equal(segunda.body.checkoutUrl, preferenceResponse.sandbox_init_point)
  assert.equal(postRequests, 1)
})

test('retomada de producao preserva checkout de producao apesar da URL sandbox', async () => {
  await db.doc('candidatos/candidato-1').set({ empresaId: 'empresa-1', indicadorId: 'indicador-1', status: 'contratado', vagaId: 'vaga-1' })
  await db.doc('vagas/vaga-1').set({ empresaId: 'empresa-1', recompensaTipo: 'fixo', recompensaValorFixo: 100 })
  const body = { empresaId: 'empresa-1', candidatoId: 'candidato-1' }
  await request('/criar-preferencia', body)
  const segunda = await request('/criar-preferencia', body)
  assert.equal(segunda.status, 200)
  assert.equal(segunda.body.checkoutUrl, preferenceResponse.init_point)
  assert.equal(postRequests, 1)
})

test('sandbox com vendedor test_user APP_USR usa init_point na criacao e retomada', async () => {
  process.env.MP_ENVIRONMENT = 'sandbox'
  process.env.MERCADO_PAGO_ACCESS_TOKEN = 'APP_USR-fixture'
  await db.doc('candidatos/candidato-1').set({ empresaId: 'empresa-1', indicadorId: 'indicador-1', status: 'contratado', vagaId: 'vaga-1' })
  await db.doc('vagas/vaga-1').set({ empresaId: 'empresa-1', recompensaTipo: 'fixo', recompensaValorFixo: 100 })
  const body = { empresaId: 'empresa-1', candidatoId: 'candidato-1' }
  const primeira = await request('/criar-preferencia', body)
  assert.equal(primeira.status, 201)
  assert.equal(primeira.body.checkoutUrl, preferenceResponse.init_point)
  assert.equal(primeira.body.ambiente, 'sandbox')
  const segunda = await request('/criar-preferencia', body)
  assert.equal(segunda.status, 200)
  assert.equal(segunda.body.checkoutUrl, preferenceResponse.init_point)
  assert.equal(postRequests, 1)
  assert.equal((await db.doc(`pagamentos/${primeira.body.pagamentoId}`).get()).data().ambiente, 'sandbox')
})

test('sandbox recusa vendedor real APP_USR antes de reservar ou criar preferencia', async () => {
  process.env.MP_ENVIRONMENT = 'sandbox'
  process.env.MERCADO_PAGO_ACCESS_TOKEN = 'APP_USR-fixture'
  vendedorResponse = { tags: [] }
  const resultado = await request('/criar-preferencia', { empresaId: 'empresa-1', candidatoId: 'candidato-1' })
  assert.equal(resultado.status, 400)
  assert.equal(postRequests, 0)
  assert.equal((await db.collection('pagamentos').get()).size, 0)
})

test('falha de notificacao apos persistir checkout nao transforma sucesso em erro', async () => {
  await db.doc('candidatos/candidato-1').set({ empresaId: 'empresa-1', indicadorId: 'indicador-1', status: 'contratado', vagaId: 'vaga-1' })
  await db.doc('vagas/vaga-1').set({ empresaId: 'empresa-1', recompensaTipo: 'fixo', recompensaValorFixo: 100 })
  const collectionOriginal = db.collection
  db.collection = function (nome) {
    if (nome === 'notificacoes') return { doc: () => ({ set: async () => { throw new Error('Falha simulada de notificacao') } }) }
    return collectionOriginal.call(this, nome)
  }
  try {
    const resultado = await request('/criar-preferencia', { empresaId: 'empresa-1', candidatoId: 'candidato-1' })
    assert.equal(resultado.status, 201)
    assert.equal((await db.doc(`pagamentos/${resultado.body.pagamentoId}`).get()).data().status, 'pending')
    assert.equal(resultado.body.checkoutUrl, preferenceResponse.init_point)
    assert.equal(postRequests, 1)
  } finally { db.collection = collectionOriginal }
})

test('aprovacao sandbox e webhook duplicado confirmam pagamento sem liberar saldo real', async () => {
  await seedPayment()
  await db.doc('pagamentos/pagamento-1').update({ ambiente: 'sandbox', externalReference: 'selectio:pagamento-1:empresa-1' })
  responseMp = { ...responseMp, live_mode: false, external_reference: 'selectio:pagamento-1:empresa-1' }
  const ts = String(Date.now())
  const digest = crypto.createHmac('sha256', 'dummy').update(`id:123;request-id:teste;ts:${ts};`).digest('hex')
  const headers = { 'x-request-id': 'teste', 'x-signature': `ts=${ts},v1=${digest}` }
  for (let i = 0; i < 2; i++) {
    const resultado = await request('/webhook/mercado-pago?data.id=123', { type: 'payment', data: { id: '123' } }, '', headers)
    assert.equal(resultado.status, 200)
    assert.equal(resultado.body.resultado.status, 'approved')
  }
  assert.equal((await db.doc('pagamentos/pagamento-1').get()).data().status, 'approved')
  assert.equal((await db.doc('pagamentos/pagamento-1').get()).data().creditado, false)
  assert.equal((await db.doc('indicadorSaldos/indicador-1').get()).exists, false)
  assert.equal((await db.collection('movimentacoesFinanceiras').get()).size, 0)
})

test('API financeira em producao exige App Check antes das operacoes', async () => {
  process.env.FUNCTIONS_EMULATOR = 'false'
  try {
    const res = await request('/criar-preferencia', { empresaId: 'empresa-1', candidatoId: 'candidato-1' })
    assert.equal(res.status, 401)
    assert.equal(requests, 0)
    assert.equal((await db.collection('pagamentos').get()).size, 0)
  } finally { process.env.FUNCTIONS_EMULATOR = 'true' }
})

test('pagamento nao pertence a outro usuario e nao permite credito duplicado', async () => {
  await seedPayment()
  assert.equal((await request('/sincronizar-pagamento', { pagamentoId: 'pagamento-1', paymentId: '123' }, 'outra-empresa')).status, 403)
  assert.equal(requests, 0)
  const responses = await Promise.all(Array.from({ length: 4 }, () => request('/sincronizar-pagamento', { pagamentoId: 'pagamento-1', paymentId: '123' })))
  assert.ok(responses.every((r) => r.status === 200), JSON.stringify(responses))
  assert.equal((await db.doc('indicadorSaldos/indicador-1').get()).data().saldoDisponivel, 100)
})

test('moeda, modo sandbox e referencia ausente nao liberam saldo', async () => {
  for (const fields of [{ currency_id: 'USD' }, { live_mode: false }, { external_reference: '' }]) {
    await seedPayment()
    const original = { ...responseMp }
    responseMp = { ...responseMp, ...fields }
    await request('/sincronizar-pagamento', { pagamentoId: 'pagamento-1', paymentId: '123' })
    assert.equal((await db.doc('indicadorSaldos/indicador-1').get()).exists, false)
    responseMp = original
  }
})

test('saque com NaN ou fracao de centavo nao altera saldo', async () => {
  for (const valor of ['invalido', 'Infinity', 0.001]) {
    assert.equal((await request('/solicitar-saque', { indicadorId: 'indicador-1', valor, chavePix: 'pessoa@example.com' }, 'indicador-1')).status, 400)
  }
  assert.equal((await db.collection('saques').get()).size, 0)
})

test('webhook exige assinatura recente e o mesmo paymentId no corpo e URL', () => {
  const make = (ts) => {
    const digest = crypto.createHmac('sha256', 'dummy').update(`id:123;request-id:teste;ts:${ts};`).digest('hex')
    return { headers: { 'x-request-id': 'teste', 'x-signature': `ts=${ts},v1=${digest}` } }
  }
  const url = new URL('https://example.com/?data.id=123')
  assert.equal(validarWebhookMercadoPago(make(Date.now()), url, { data: { id: '123' } }), true)
  assert.equal(validarWebhookMercadoPago(make(Date.now()), url, { data: { id: '456' } }), false)
  assert.equal(validarWebhookMercadoPago(make(Date.now() - 660000), url, { data: { id: '123' } }), false)
})

test('JSON grande e barrado antes de autenticar ou acessar banco', async () => {
  assert.equal((await request('/criar-preferencia', { value: 'x'.repeat(100001) })).status, 413)
  assert.equal(requests, 0)
})

test('JSON malformado e valores primitivos retornam erro de entrada', async () => {
  for (const body of [Buffer.from('{invalido'), '123', 'null', '[]']) {
    assert.equal((await request('/criar-preferencia', body)).status, 400)
  }
  assert.equal(requests, 0)
})
