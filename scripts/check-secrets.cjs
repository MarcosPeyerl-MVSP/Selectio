const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const projectRoot = path.resolve(__dirname, '..')
const stagedOnly = process.argv.includes('--staged')
const selfTest = process.argv.includes('--self-test')
const historyMode = process.argv.includes('--history')
const rangeIndex = process.argv.indexOf('--range')
const revisionRange = rangeIndex >= 0 ? process.argv[rangeIndex + 1] : ''
const findings = []
const allowedFixturePaths = new Set([
  'Server/node_modules/node-gyp/test/fixtures/server.key'
])

const privateKeyMarkers = [
  ' PRIVATE KEY-----',
  ' RSA PRIVATE KEY-----',
  ' EC PRIVATE KEY-----',
  ' OPENSSH PRIVATE KEY-----'
].map((suffix) => ['-----BEGIN', suffix].join(''))
const knownTokenPatterns = [
  {
    name: 'token do GitHub',
    regex: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g
  },
  {
    name: 'chave privada da OpenAI',
    regex: /\bsk-[A-Za-z0-9_-]{20,}\b/g
  },
  {
    name: 'Access Token do Mercado Pago',
    regex: /\bAPP_USR-[A-Za-z0-9-]{20,}\b/g
  }
]

const sensitiveEnvKey = /(?:SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE_KEY|ACCESS_KEY|CLIENT_SECRET|WEBHOOK_SECRET)/i
const assignmentPattern = /^[ \t]*(?:export[ \t]+)?([A-Z][A-Z0-9_]*)[ \t]*=[ \t]*([^\r\n]*)[ \t]*$/gm

if (selfTest) {
  runSelfTest()
} else {
  runScan()
}

function runScan() {
  for (const entry of listEntries()) {
    const file = entry.file
    const normalizedPath = file.replaceAll('\\', '/')
    const findingPath = entry.commit
      ? `${normalizedPath}@${entry.commit.slice(0, 8)}`
      : normalizedPath

    if (allowedFixturePaths.has(normalizedPath)) continue

    if (isSensitiveFilename(normalizedPath)) {
      addFinding(findingPath, 1, 'nome de arquivo reservado para credenciais')
      continue
    }

    const content = readContent(entry)
    if (content === null || content.includes('\0')) continue

    scanContent(findingPath, content)
  }

  if (findings.length) {
    console.error('Commit bloqueado: possiveis segredos ou credenciais foram encontrados.')
    findings.forEach(({ file, line, reason }) => {
      console.error(`- ${file}:${line} (${reason})`)
    })
    console.error('Mova o valor para um .env ignorado e mantenha apenas placeholders nos exemplos.')
    process.exit(1)
  }

  const scope = revisionRange || historyMode
    ? 'historico selecionado'
    : stagedOnly
      ? 'arquivos staged'
      : 'arquivos versionados'
  console.log(`Verificacao de segredos concluida (${scope}).`)
}

function runSelfTest() {
  const secretKey = ['MP_WEBHOOK', '_SECRET'].join('')
  const fakeSecret = `${secretKey}=valor-real-que-nao-pode-ser-versionado`

  if (!isSensitiveFilename('config/projeto-firebase-adminsdk-chave.json')) {
    throw new Error('Autoteste falhou ao detectar nome de service account.')
  }

  scanContent('fixture.env', fakeSecret)

  if (!findings.some((finding) => finding.reason.includes(secretKey))) {
    throw new Error('Autoteste falhou ao detectar valor sensivel.')
  }

  scanContent('fixture.txt', ['-----BEGIN', ' OPENSSH PRIVATE KEY-----'].join(''))

  if (!findings.some((finding) => finding.reason === 'chave privada')) {
    throw new Error('Autoteste falhou ao detectar chave privada.')
  }

  findings.length = 0
  scanContent('fixture.env', `${secretKey}=SEU_WEBHOOK_SECRET_AQUI`)

  if (findings.length) {
    throw new Error('Autoteste tratou placeholder como segredo real.')
  }

  console.log('Autoteste do verificador de segredos concluido.')
}

function listEntries() {
  if (revisionRange || historyMode) {
    return listHistoryEntries()
  }

  const args = stagedOnly
    ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']
    : ['ls-files', '--cached', '--others', '--exclude-standard', '-z']
  const output = runGit(args)

  return output.split('\0').filter(Boolean).map((file) => ({ file }))
}

function listHistoryEntries() {
  const commitArgs = historyMode
    ? ['rev-list', '--reverse', '--all']
    : ['rev-list', '--reverse', revisionRange]
  const commits = runGit(commitArgs).split(/\r?\n/).filter(Boolean)
  const entries = []

  for (const commit of commits) {
    const output = runGit([
      'diff-tree',
      '--root',
      '--no-commit-id',
      '--name-only',
      '--diff-filter=ACMR',
      '-r',
      '-z',
      commit
    ])

    output.split('\0').filter(Boolean).forEach((file) => {
      entries.push({ file, commit })
    })
  }

  return entries
}

function runGit(args) {
  return execFileSync('git', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024
  })
}

function readContent({ file, commit }) {
  try {
    if (commit) {
      return runGit(['show', `${commit}:${file}`])
    }

    if (stagedOnly) {
      return runGit(['show', `:${file}`])
    }

    return fs.readFileSync(path.join(projectRoot, file), 'utf8')
  } catch {
    return null
  }
}

function isSensitiveFilename(file) {
  const basename = path.posix.basename(file).toLowerCase()

  if (basename.startsWith('.env')) {
    return !basename.endsWith('.example') && !basename.endsWith('.sample')
  }

  if (
    basename.includes('serviceaccount')
    || basename.includes('service-account')
    || basename.includes('firebase-adminsdk')
    || basename === 'application_default_credentials.json'
    || basename === 'application-default-credentials.json'
    || basename === 'credentials.local.json'
  ) {
    return true
  }

  return /\.(?:pem|key|p12|pfx)$/i.test(basename)
}

function scanContent(file, content) {
  for (const marker of privateKeyMarkers) {
    if (content.includes(marker)) {
      addFinding(file, lineNumber(content, content.indexOf(marker)), 'chave privada')
    }
  }

  for (const pattern of knownTokenPatterns) {
    pattern.regex.lastIndex = 0
    const match = pattern.regex.exec(content)
    if (match) addFinding(file, lineNumber(content, match.index), pattern.name)
  }

  assignmentPattern.lastIndex = 0
  let assignment

  while ((assignment = assignmentPattern.exec(content))) {
    const [, key, rawValue] = assignment
    if (!sensitiveEnvKey.test(key) || isPlaceholder(rawValue)) continue

    addFinding(file, lineNumber(content, assignment.index), `valor sensivel em ${key}`)
  }

  if (/["']type["']\s*:\s*["']service_account["']/.test(content)) {
    addFinding(file, 1, 'JSON de service account')
  }
}

function isPlaceholder(rawValue) {
  const value = String(rawValue || '').trim().replace(/^(['"])(.*)\1$/, '$2')

  return (
    !value
    || /^\$\{[A-Z0-9_]+\}$/.test(value)
    || /^<[^>]+>$/.test(value)
    || /^(?:seu|sua|your|example|exemplo|placeholder|changeme|troque|substitua|gere|xxx|dummy)[-_A-Z0-9]*$/i.test(value)
    || value.includes('process.env.')
  )
}

function lineNumber(content, index) {
  return content.slice(0, index).split(/\r?\n/).length
}

function addFinding(file, line, reason) {
  if (findings.some((item) => item.file === file && item.line === line && item.reason === reason)) {
    return
  }

  findings.push({ file, line, reason })
}
