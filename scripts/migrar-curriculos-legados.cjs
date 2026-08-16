const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')
const requireFunctions = createRequire(path.resolve(__dirname, '..', 'functions', 'package.json'))
const { cert, getApps, initializeApp } = requireFunctions('firebase-admin/app')
const { getFirestore } = requireFunctions('firebase-admin/firestore')

const apply = process.argv.includes('--apply')
const credentialPath = path.resolve(__dirname, '..', 'serviceAccount.local.json')

if (!getApps().length) {
  initializeApp({
    ...(fs.existsSync(credentialPath)
      ? { credential: cert(require(credentialPath)) }
      : {})
  })
}

const db = getFirestore()

const normalize = (data) => {
  const current = data.curriculo && typeof data.curriculo === 'object' ? data.curriculo : {}
  const nome = String(current.nome || current.name || data.curriculoNome || '').trim()
  const tipo = String(current.tipo || current.type || data.curriculoTipo || '').trim()
  const tamanho = Number(current.tamanho || current.size || data.curriculoTamanho || 0)
  const caminho = String(current.caminho || current.path || '').trim()

  if (!nome && !tipo && !tamanho && !caminho) return null

  return {
    caminho,
    nome,
    tamanho: Number.isFinite(tamanho) && tamanho >= 0 ? tamanho : 0,
    tipo,
    status: caminho ? 'disponivel' : 'pendente_reenvio'
  }
}

const migrateCollection = async (collectionName) => {
  const snapshot = await db.collection(collectionName).get()
  const changes = []

  snapshot.forEach((doc) => {
    const data = doc.data()
    const curriculo = normalize(data)
    if (!curriculo) return

    const current = data.curriculo || {}
    if (
      current.caminho === curriculo.caminho
      && current.nome === curriculo.nome
      && current.tamanho === curriculo.tamanho
      && current.tipo === curriculo.tipo
      && current.status === curriculo.status
      && !current.url
    ) return

    changes.push({ ref: doc.ref, curriculo })
  })

  if (apply) {
    for (let offset = 0; offset < changes.length; offset += 400) {
      const batch = db.batch()
      changes.slice(offset, offset + 400).forEach(({ ref, curriculo }) => {
        batch.update(ref, { curriculo })
      })
      await batch.commit()
    }
  }

  return { collectionName, scanned: snapshot.size, changes: changes.length }
}

Promise.all([
  migrateCollection('candidatosPreSalvos'),
  migrateCollection('candidatos')
]).then((results) => {
  console.log(apply ? 'Migracao aplicada.' : 'Simulacao concluida; nada foi alterado.')
  results.forEach(({ collectionName, scanned, changes }) => {
    console.log(`${collectionName}: ${scanned} lidos, ${changes} para migrar.`)
  })
  if (!apply) console.log('Para aplicar: npm run storage:migrate -- --apply')
}).catch((error) => {
  console.error('Falha na migracao de curriculos:', error)
  process.exitCode = 1
})
