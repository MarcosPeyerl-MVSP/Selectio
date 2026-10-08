// Fixtures exclusivamente locais: não lê secrets remotos nem altera configuração publicada.
const fs = require('node:fs')
const { spawnSync } = require('node:child_process')
const paths = ['functions/.secret.local', 'functions/.env.local']
const original = new Map(paths.map((path) => [path, fs.existsSync(path) ? fs.readFileSync(path) : null]))
try {
  fs.writeFileSync(paths[0], 'GEMINI_API_KEY=emulator-placeholder\nMERCADO_PAGO_ACCESS_TOKEN=emulator-placeholder\nMP_WEBHOOK_SECRET=emulator-placeholder\n')
  const result = spawnSync(process.execPath, [require.resolve('firebase-tools/lib/bin/firebase.js'),
    'emulators:exec', '--only', 'functions',
    'node --test --test-concurrency=1 tests/mercadoPagoFunctions.test.cjs tests/assistenteFunctions.test.cjs'], {
    stdio: 'inherit', env: { ...process.env, DEBUG: '',
      GEMINI_API_KEY: 'emulator-placeholder', MERCADO_PAGO_ACCESS_TOKEN: 'emulator-placeholder', MP_WEBHOOK_SECRET: 'emulator-placeholder',
      ASSISTANT_DATA_POLICY: 'disabled', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:19099',
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:18080', STORAGE_EMULATOR_HOST: '127.0.0.1:9199'
    }
  })
  process.exitCode = result.status ?? 1
} finally {
  for (const [path, value] of original) {
    if (value === null) { if (fs.existsSync(path)) fs.unlinkSync(path) }
    else fs.writeFileSync(path, value)
  }
}
