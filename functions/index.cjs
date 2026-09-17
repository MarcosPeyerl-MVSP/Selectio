const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { getFirestore } = require('firebase-admin/firestore')
const { getStorage } = require('firebase-admin/storage')
const { criarServicoIndicacoes } = require('./src/indicacoesCore.cjs')
const { defineSecret, defineString } = require('firebase-functions/params')

const { handleMercadoPagoRequest } = require('./src/mercadoPagoCore.cjs')

const servicoIndicacoes = () => criarServicoIndicacoes({ db: getFirestore(), bucket: getStorage().bucket() })

exports.indicacoesApi = onCall({
  region: 'southamerica-east1', timeoutSeconds: 120, memory: '1GiB', concurrency: 4, maxInstances: 10
}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Entre novamente para continuar.', { motivo: 'sessao_expirada' })
  const servico = servicoIndicacoes()
  if (request.data?.acao === 'analisar') return servico.analisar(request.auth.uid, request.data)
  if (request.data?.acao === 'finalizar') return servico.finalizar(request.auth.uid, request.data)
  throw new HttpsError('invalid-argument', 'Operação inválida.')
})

exports.limparValidacoesIndicacao = onSchedule({
  schedule: 'every 24 hours', region: 'southamerica-east1', timeoutSeconds: 540, memory: '256MiB'
}, () => servicoIndicacoes().limparExpiradas())

const mercadoPagoAccessToken = defineSecret('MERCADO_PAGO_ACCESS_TOKEN')
const mercadoPagoWebhookSecret = defineSecret('MP_WEBHOOK_SECRET')
const mpEnvironment = defineString('MP_ENVIRONMENT', { default: 'sandbox' })
const appUrl = defineString('APP_URL', {
  default: 'https://selectio-1f022.web.app'
})

exports.mercadoPagoApi = onRequest({
  region: 'southamerica-east1',
  invoker: 'public',
  timeoutSeconds: 120,
  memory: '256MiB',
  concurrency: 20,
  maxInstances: 10,
  secrets: [mercadoPagoAccessToken, mercadoPagoWebhookSecret]
}, async (req, res) => {
  process.env.MERCADO_PAGO_ACCESS_TOKEN = mercadoPagoAccessToken.value()
  process.env.MP_WEBHOOK_SECRET = mercadoPagoWebhookSecret.value()
  process.env.MP_ENVIRONMENT = mpEnvironment.value()
  process.env.APP_URL = appUrl.value()

  await handleMercadoPagoRequest(req, res)
})
