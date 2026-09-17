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
  console.log('Configuracao local de deploy validada. Confirme enforcement e dominios no console Firebase.')
}
main().catch((error) => { console.error(error.message); process.exitCode = 1 })
