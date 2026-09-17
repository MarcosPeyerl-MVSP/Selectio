const assert = require('node:assert/strict')
const { test, before, after } = require('node:test')
const { createRequire } = require('node:module')
const path = require('node:path')
const deps = createRequire(path.resolve('functions/package.json'))
const { initializeApp, deleteApp } = deps('firebase-admin/app')
const { getFirestore } = deps('firebase-admin/firestore')
const { criarLimitador, validarCorpoJson } = require('../functions/src/protecaoAbuso.cjs')
let db, app
before(() => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'Use o emulador Firestore')
  app = initializeApp({ projectId: 'selectio-1f022' }, 'abuso-testes')
  db = getFirestore(app)
})
after(async () => { await db.terminate(); await deleteApp(app) })

test('corpo ja processado, rawBody, arrays e Content-Length sao validados', () => {
  assert.throws(() => validarCorpoJson({ body: { texto: 'x'.repeat(100001) } }), { status: 413 })
  assert.throws(() => validarCorpoJson({ rawBody: Buffer.alloc(100001), body: {} }), { status: 413 })
  assert.throws(() => validarCorpoJson({ headers: { 'content-length': '100001' } }), { status: 413 })
  assert.throws(() => validarCorpoJson({ body: [] }), { status: 400 })
  assert.doesNotThrow(() => validarCorpoJson({ body: { nome: 'Pessoa' } }))
})

test('cota compartilhada entre instancias resiste a concorrencia e reseta por minuto', async () => {
  let now = 1800000000000
  const uid = `concorrencia-${Date.now()}`
  const a = criarLimitador({ db, agora: () => now })
  const b = criarLimitador({ db, agora: () => now })
  const results = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => (i % 2 ? a : b)(uid, 'analisar')))
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 6)
  assert.ok(results.filter((r) => r.status === 'rejected').every((r) => r.reason.status === 429))
  await assert.rejects(a(uid, 'analisar'), { status: 429 })
  await b(`${uid}-outro`, 'analisar')
  now += 60000
  await a(uid, 'analisar')
})

test('cota diaria permanece apos virada do minuto e reinicializacao da instancia', async () => {
  let now = 1800000000000
  const uid = `diaria-${Date.now()}`
  const limit = criarLimitador({ db, agora: () => now })
  for (let i = 0; i < 100; i++) {
    await limit(uid, 'analisar')
    now += 60000
  }
  const outraInstancia = criarLimitador({ db, agora: () => now })
  await assert.rejects(outraInstancia(uid, 'analisar'), { status: 429 })
  now += 86400000
  await outraInstancia(uid, 'analisar')
})
