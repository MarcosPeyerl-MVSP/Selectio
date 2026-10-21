// Por padrao apenas consulta. --apply adiciona a origem canonica ao CORS do bucket.
const { getProjectDefaultAccount, getAccessToken } = require('firebase-tools/lib/auth')

const bucket = 'selectio-1f022.firebasestorage.app'
const origin = 'https://selectio.app.br'
const endpoint = `https://storage.googleapis.com/storage/v1/b/${bucket}`

async function main() {
  const account = getProjectDefaultAccount(process.cwd())
  if (!account) throw new Error('Entre com npx firebase login antes de continuar.')
  const token = await getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform'])
  const headers = { Authorization: `Bearer ${token.access_token}` }
  const response = await fetch(`${endpoint}?fields=name,cors,metageneration`, { headers })
  if (!response.ok) throw new Error(`Falha ao consultar CORS: HTTP ${response.status}.`)
  const current = await response.json()
  const cors = current.cors || []
  if (cors.some(rule => rule.origin?.includes(origin) && rule.method?.includes('GET'))) {
    console.log('A origem canonica ja esta autorizada para leitura no CORS do bucket.')
    return
  }
  const updated = [...cors, { origin: [origin], method: ['GET', 'HEAD'], responseHeader: ['Content-Type', 'Content-Length'], maxAgeSeconds: 3600 }]
  console.log(`Bucket: ${bucket}. Adicionar GET/HEAD para ${origin}; preservar configuracao atual.`)
  if (!process.argv.includes('--apply')) {
    console.log('Somente consulta. Execute novamente com --apply para aplicar ao bucket publicado.')
    return
  }
  const result = await fetch(`${endpoint}?ifMetagenerationMatch=${encodeURIComponent(current.metageneration)}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ cors: updated })
  })
  if (!result.ok) throw new Error(`Falha ao atualizar CORS: HTTP ${result.status}. Consulte novamente antes de tentar outra vez.`)
  console.log('CORS atualizado. As regras de acesso, arquivos e permissoes do Storage foram preservados.')
}

main().catch(error => {
  // Nao imprime respostas de autenticacao nem credenciais.
  console.error(error.message?.startsWith('Falha ao') ? error.message : 'Nao foi possivel configurar o CORS. Confira o login e as permissoes da conta Firebase.')
  process.exitCode = 1
})
