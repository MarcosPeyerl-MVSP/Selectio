const { createHash } = require('node:crypto')
const { Timestamp } = require('firebase-admin/firestore')

const POLITICAS = Object.freeze({
  analisar: { minuto: 6, dia: 100 },
  finalizar: { minuto: 12, dia: 200 },
  financeiro: { minuto: 20, dia: 300 }
})

function erroHttp(status, message) {
  return Object.assign(new Error(message), { status })
}

// O contador compartilhado impede que trocar de instancia reinicie a cota.
// O cache guarda apenas recusas: nunca autoriza chamadas sem a transacao.
function criarLimitador({ db, agora = Date.now }) {
  const bloqueados = new Map()
  return async function limitar(uid, acao) {
    const politica = POLITICAS[acao]
    if (!uid || !politica) throw erroHttp(400, 'Operacao invalida.')
    const instante = agora()
    const id = createHash('sha256').update(JSON.stringify([uid, acao])).digest('hex')
    const recusar = (ate) => {
      const error = erroHttp(429, 'Limite de operacoes atingido. Aguarde e tente novamente.')
      error.retryAfter = Math.max(1, Math.ceil((ate - instante) / 1000))
      throw error
    }
    if (bloqueados.get(id) > instante) recusar(bloqueados.get(id))
    bloqueados.delete(id)
    const minuto = Math.floor(instante / 60000)
    const dia = Math.floor(instante / 86400000)
    const ref = db.doc(`limitesUso/${id}`)
    const bloqueadoAte = await db.runTransaction(async (tx) => {
      const anterior = (await tx.get(ref)).data() || {}
      const porMinuto = anterior.minuto === minuto ? anterior.porMinuto : 0
      const porDia = anterior.dia === dia ? anterior.porDia : 0
      if (porDia >= politica.dia) return (dia + 1) * 86400000
      if (porMinuto >= politica.minuto) return (minuto + 1) * 60000
      tx.set(ref, { minuto, dia, porMinuto: porMinuto + 1, porDia: porDia + 1,
        expiraEm: Timestamp.fromMillis((dia + 2) * 86400000) })
      return 0
    })
    if (bloqueadoAte) {
      if (bloqueados.size >= 2000) bloqueados.delete(bloqueados.keys().next().value)
      bloqueados.set(id, bloqueadoAte)
      recusar(bloqueadoAte)
    }
  }
}

function validarCorpoJson(req, maxBytes = 100000) {
  const tamanho = Buffer.isBuffer(req.rawBody) ? req.rawBody.length
    : Buffer.isBuffer(req.body) ? req.body.length
      : Buffer.byteLength(typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}))
  if (tamanho > maxBytes || Number(req.headers?.['content-length']) > maxBytes) {
    throw erroHttp(413, 'Corpo da requisicao muito grande.')
  }
  if (req.body != null && typeof req.body === 'object' && !Buffer.isBuffer(req.body)
    && Array.isArray(req.body)) throw erroHttp(400, 'Envie um objeto JSON.')
}

module.exports = { criarLimitador, validarCorpoJson, erroHttp, POLITICAS }
