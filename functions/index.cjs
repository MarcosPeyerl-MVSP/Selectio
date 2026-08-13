const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret, defineString } = require('firebase-functions/params')

const { handleMercadoPagoRequest } = require('./src/mercadoPagoCore.cjs')

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
