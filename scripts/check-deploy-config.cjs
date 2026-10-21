const fs = require('node:fs')
const path = require('node:path')
const { parseEnv } = require('node:util')

// Valida configuracao sem imprimir valores de .env.
async function main() {
  const { loadEnv } = await import('vite')
  const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env }
  const required = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_APP_ID', 'VITE_RECAPTCHA_ENTERPRISE_SITE_KEY', 'VITE_APP_URL']
  const missing = required.filter((key) => !String(env[key] || '').trim())
  if (missing.length) throw new Error(`Configure antes do deploy: ${missing.join(', ')}.`)
  const appUrl = new URL(env.VITE_APP_URL)
  if (appUrl.protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(appUrl.hostname)) {
    throw new Error('VITE_APP_URL deve ser o endereco HTTPS de producao.')
  }
  if (env.VITE_USE_FUNCTIONS_EMULATOR === 'true') throw new Error('Desative VITE_USE_FUNCTIONS_EMULATOR para o deploy.')
  if (env.VITE_MERCADO_PAGO_API_URL) {
    const apiUrl = new URL(env.VITE_MERCADO_PAGO_API_URL)
    if (apiUrl.protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(apiUrl.hostname)) {
      throw new Error('VITE_MERCADO_PAGO_API_URL deve usar HTTPS em producao.')
    }
  }
  // .env.local das Functions pertence ao emulador e nao configura o deploy.
  const functionsEnv = {}
  for (const file of ['.env', `.env.${env.VITE_FIREBASE_PROJECT_ID}`]) {
    const filePath = path.join(process.cwd(), 'functions', file)
    if (fs.existsSync(filePath)) Object.assign(functionsEnv, parseEnv(fs.readFileSync(filePath, 'utf8')))
  }
  if (!functionsEnv.APP_URL || new URL(functionsEnv.APP_URL).origin !== appUrl.origin) {
    throw new Error('Configure APP_URL nas Functions com a mesma origem de VITE_APP_URL para evitar falhas de CORS e retorno do checkout.')
  }
  if (!['sandbox', 'production'].includes(functionsEnv.MP_ENVIRONMENT)) {
    throw new Error('Configure MP_ENVIRONMENT como sandbox ou production no arquivo de deploy das Functions.')
  }
  console.log('Configuracao local de deploy validada. Confirme enforcement e dominios no console Firebase.')
}
main().catch((error) => { console.error(error.message); process.exitCode = 1 })
