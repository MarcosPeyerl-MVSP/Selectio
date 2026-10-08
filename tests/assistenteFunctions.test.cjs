const assert = require('node:assert/strict')
const { test } = require('node:test')
const url = 'http://127.0.0.1:5001/selectio-1f022/southamerica-east1/assistenteCandidatosApi'
test('callable do assistente exige autenticação sem consultar documentos nem Gemini', async () => {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { acao: 'perguntar', vagaId: 'ficticia', question: 'React?' } }) })
  assert.equal(response.status, 401)
  const body = await response.json()
  assert.equal(body.error.status, 'UNAUTHENTICATED')
})
test('callable rejeita método inválido', async () => {
  const response = await fetch(url)
  assert.equal(response.status, 400)
})
