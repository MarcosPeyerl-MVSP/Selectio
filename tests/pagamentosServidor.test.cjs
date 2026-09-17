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
let requests, postRequests, responseMp, verifyOriginal

before(() => {
  verifyOriginal = getAuth().verifyIdToken
  getAuth().verifyIdToken = async (uid) => ({ uid })
})
beforeEach(async () => {
  await originalFetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/selectio-1f022/databases/(default)/documents`, { method: 'DELETE' })
  requests = 0
  postRequests = 0
  responseMp = { id: '123', external_reference: 'ref', transaction_amount: 100, currency_id: 'BRL', status: 'approved', live_mode: true }
  global.fetch = async (url, options) => {
    assert.match(String(url), /^https:\/\/api\.mercadopago\.com\//)
    requests++
    if (options?.method === 'POST') {
      postRequests++
      return { ok: true, json: async () => ({ id: 'pref', init_point: 'https://www.mercadopago.com.br/checkout' }) }
    }
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
