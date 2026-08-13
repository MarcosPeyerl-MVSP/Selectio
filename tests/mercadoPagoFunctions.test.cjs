const assert = require('node:assert/strict')
const test = require('node:test')

const apiUrl = 'http://127.0.0.1:5001/selectio-1f022/southamerica-east1/mercadoPagoApi'

test('function de pagamentos responde ao health check', async () => {
  const response = await fetch(`${apiUrl}/health`)
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.service, 'selectio-mercado-pago-functions')
  assert.equal(body.firestoreProjectId, 'selectio-1f022')
})

test('rotas financeiras exigem token Firebase', async () => {
  const response = await fetch(`${apiUrl}/criar-preferencia`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:5173'
    },
    body: JSON.stringify({ empresaId: 'empresa-1', candidatoId: 'candidato-1' })
  })
  const body = await response.json()

  assert.equal(response.status, 401)
  assert.equal(body.error, 'Autenticacao Firebase obrigatoria.')
})

test('webhook rejeita chamadas sem assinatura', async () => {
  const response = await fetch(`${apiUrl}/webhook/mercado-pago`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { id: '123' } })
  })

  assert.equal(response.status, 401)
})

test('preflight permite o frontend local', async () => {
  const response = await fetch(`${apiUrl}/criar-preferencia`, {
    method: 'OPTIONS',
    headers: { Origin: 'http://localhost:5173' }
  })

  assert.equal(response.status, 204)
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173')
})
