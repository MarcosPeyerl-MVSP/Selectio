const { HttpsError } = require('firebase-functions/v2/https')
const { Timestamp } = require('firebase-admin/firestore')
const { createHash } = require('node:crypto')
const { LIMITES } = require('./config.cjs')
const { criarLimitador } = require('../protecaoAbuso.cjs')
const { camposProfissionais, contextoVaga, sanitizar, fingerprint, politicaPergunta } = require('./sanitizacao.cjs')
const { chunking, recuperar } = require('./retrieval.cjs')
const { validarResposta } = require('./citacoes.cjs')
const { extrairCurriculo } = require('../indicacoesCore.cjs')
const erro = (motivo, code = 'failed-precondition') => new HttpsError(code, 'Não foi possível usar o assistente.', { motivo })
const idValido = (id) => typeof id === 'string' && /^[\w-]{1,180}$/.test(id)
const cacheId = (uid, vagaId, candidatoId) => createHash('sha256').update(JSON.stringify([uid, vagaId, candidatoId])).digest('hex')
function validarEntrada(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
    || Buffer.byteLength(JSON.stringify(payload)) > LIMITES.corpo
    || Object.keys(payload).some((k) => !['acao', 'vagaId', 'question', 'history', 'language'].includes(k))
    || !['vagas', 'contexto', 'indexar', 'perguntar'].includes(payload.acao)) throw erro('entrada_invalida', 'invalid-argument')
  if (payload.acao !== 'vagas' && !idValido(payload.vagaId)) throw erro('entrada_invalida', 'invalid-argument')
  if (payload.language && !['pt-BR', 'en-US'].includes(payload.language)) throw erro('entrada_invalida', 'invalid-argument')
  if (payload.acao === 'perguntar') {
    if (typeof payload.question !== 'string' || !payload.question.trim() || payload.question.length > LIMITES.pergunta
      || !Array.isArray(payload.history || []) || (payload.history || []).length > LIMITES.historico
      || (payload.history || []).some((m) => !m || m.role !== 'user' || typeof m.content !== 'string'
        || m.content.length > LIMITES.mensagem || Object.keys(m).some((k) => !['role', 'content'].includes(k)))) throw erro('entrada_invalida', 'invalid-argument')
  }
}
function criarServicoAssistente({ db, bucket, provider, extrair = extrairCurriculo, agora = Date.now,
  limitar = criarLimitador({ db }) }) {
  async function empresa(uid) {
    if (!idValido(uid)) throw erro('sessao_expirada', 'unauthenticated')
    const [user, company] = await db.getAll(db.doc(`users/${uid}`), db.doc(`empresas/${uid}`))
    if (user.data()?.tipo !== 'empresa' || !company.exists) throw erro('acesso_negado', 'permission-denied')
  }
  async function vagaAutorizada(uid, vagaId) {
    const doc = await db.doc(`vagas/${vagaId}`).get()
    if (!doc.exists) throw erro('vaga_inexistente', 'not-found')
    const vaga = doc.data()
    if ((vaga.empresaId || vaga.empresaUid) !== uid) throw erro('acesso_negado', 'permission-denied')
    return vaga
  }
  async function contexto(uid, vagaId) {
    const vaga = await vagaAutorizada(uid, vagaId)
    const documents = await db.collection('candidatos').where('empresaId', '==', uid)
      .where('vagaId', '==', vagaId).orderBy('__name__').limit(LIMITES.candidatos + 1).get()
    if (documents.size > LIMITES.candidatos) throw erro('muitos_candidatos', 'resource-exhausted')
    const candidates = documents.docs.map((d) => ({ ...d.data(), id: d.id }))
    if (candidates.some((c) => c.empresaId !== uid || c.vagaId !== vagaId)) throw erro('acesso_negado', 'permission-denied')
    const snapshots = candidates.length ? await db.getAll(...candidates.map((c) => db.doc(`assistenteCandidatosDocumentos/${cacheId(uid, vagaId, c.id)}`))) : []
    const indexes = new Map()
    for (let i = 0; i < candidates.length; i++) {
      const index = snapshots[i].data(); const c = candidates[i]
      if (index && index.empresaId === uid && index.vagaId === vagaId && index.candidatoId === c.id
        && index.fingerprint === fingerprint(c) && index.validoAte?.toMillis() > agora()) indexes.set(c.id, index)
    }
    return { vaga, candidates, indexes }
  }
  async function indexar(uid, vagaId, ctx) {
    try { await limitar('__assistente_global__', 'assistenteIndexarGlobal') }
    catch (error) { if (error.status === 429) throw erro('limite_uso', 'resource-exhausted'); throw error }
    const nomes = ctx.candidates.map((c) => c.nome)
    const batch = ctx.candidates.filter((c) => !ctx.indexes.has(c.id)).slice(0, LIMITES.lote)
    const { sanitizarTextoCurriculo } = await import('../../shared/motorCompatibilidade.mjs')
    for (const c of batch) {
      const chunks = Object.entries(camposProfissionais(c)).flatMap(([field, text]) => chunking(sanitizar(text, nomes), field, 'form'))
      let resumeStatus = 'missing'; let generation = ''
      const caminho = c.curriculo?.caminho
      if (caminho) {
        const expected = `curriculos/${c.indicadorId}/candidatos/${c.id}/`
        if (typeof caminho !== 'string' || !caminho.startsWith(expected) || caminho.slice(expected.length).includes('/')
          || !idValido(c.indicadorId)) throw erro('curriculo_nao_autorizado', 'permission-denied')
        let metadata
        try { [metadata] = await bucket.file(caminho).getMetadata() } catch { resumeStatus = 'unreadable' }
        if (metadata) {
          if (metadata.metadata?.empresaId !== uid || metadata.metadata?.registroId !== c.id
            || metadata.metadata?.indicadorId !== c.indicadorId || metadata.metadata?.tipoRegistro !== 'candidatos') throw erro('curriculo_nao_autorizado', 'permission-denied')
          generation = String(metadata.generation)
          if (Number(metadata.size) > 0 && Number(metadata.size) <= LIMITES.arquivo
            && ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(metadata.contentType)) {
            try {
              const [bytes] = await bucket.file(caminho, { generation }).download({ validation: 'crc32c' })
              const extracted = await extrair(bytes, metadata.contentType)
              const text = sanitizar(sanitizarTextoCurriculo(extracted.texto), nomes)
              chunks.push(...chunking(text, 'resume', 'resume')); resumeStatus = text ? 'ready' : 'unreadable'
            } catch { resumeStatus = 'unreadable' }
          } else resumeStatus = 'unreadable'
        }
      }
      // Revalida vínculos e conteúdo depois da extração; nunca grava índice autorizado apenas no início.
      await empresa(uid); await vagaAutorizada(uid, vagaId)
      const fresh = await db.doc(`candidatos/${c.id}`).get()
      if (!fresh.exists || fresh.data().empresaId !== uid || fresh.data().vagaId !== vagaId
        || fingerprint(fresh.data()) !== fingerprint(c)) throw erro('indice_desatualizado')
      await db.doc(`assistenteCandidatosDocumentos/${cacheId(uid, vagaId, c.id)}`).set({
        empresaId: uid, vagaId, candidatoId: c.id, fingerprint: fingerprint(c), generation,
        contentHash: createHash('sha256').update(JSON.stringify(chunks)).digest('hex'),
        chunks: chunks.slice(0, LIMITES.chunksDocumento), resumeStatus, versao: LIMITES.versao,
        atualizadoEm: Timestamp.fromMillis(agora()), validoAte: Timestamp.fromMillis(agora() + LIMITES.validadeMs),
        expiraEm: Timestamp.fromMillis(agora() + LIMITES.retencaoMs)
      })
    }
    const fresh = await contexto(uid, vagaId)
    return resumo(fresh)
  }
  function resumo(ctx) {
    return { candidates: ctx.candidates.map((c) => ({ id: c.id, name: c.nome || c.id,
      indexed: ctx.indexes.has(c.id), resumeStatus: ctx.indexes.get(c.id)?.resumeStatus || 'pending' })),
    pending: ctx.candidates.length - ctx.indexes.size, count: ctx.candidates.length }
  }
  async function executar(uid, payload) {
    validarEntrada(payload); await empresa(uid)
    try { await limitar(uid, payload.acao === 'indexar' ? 'assistenteIndexar'
      : payload.acao === 'perguntar' ? 'assistentePerguntar' : 'assistenteContexto') }
    catch (error) { if (error.status === 429) throw erro('limite_uso', 'resource-exhausted'); throw error }
    if (payload.acao === 'vagas') {
      const docs = await db.collection('vagas').where('empresaId', '==', uid).orderBy('__name__').limit(LIMITES.vagas + 1).get()
      return { vagas: docs.docs.slice(0, LIMITES.vagas).map((d) => ({ id: d.id, title: d.data().titulo || d.id })), truncated: docs.size > LIMITES.vagas }
    }
    const ctx = await contexto(uid, payload.vagaId)
    if (payload.acao === 'contexto') return resumo(ctx)
    if (payload.acao === 'indexar') return indexar(uid, payload.vagaId, ctx)
    if (!ctx.candidates.length) return { claims: [], candidates: [], citations: [], limitations: ['no_candidates', 'human_review'] }
    if (ctx.indexes.size !== ctx.candidates.length) throw erro('indice_desatualizado')
    const policy = politicaPergunta(payload.question)
    if (policy === 'criterios_profissionais') return { claims: [], candidates: [], citations: [], limitations: ['professional_only', 'human_review'] }
    provider.assertConfigured?.()
    const nomes = ctx.candidates.map((c) => c.nome)
    const job = contextoVaga(ctx.vaga, nomes)
    const query = policy === 'iniciativa' ? 'iniciativa criou iniciou liderou propôs automatizou coordenou projetos initiative created led automated' : payload.question
    const retrieved = recuperar({ question: query, selectionQuestion: payload.question, candidates: ctx.candidates, indexes: ctx.indexes, vaga: job })
    if (!retrieved.sources.length) return { claims: [], candidates: [], citations: [], limitations: ['insufficient_evidence', 'human_review'] }
    let aliasedQuestion = query
    for (let i = 0; i < ctx.candidates.length; i++) {
      const name = ctx.candidates[i].nome
      if (name) aliasedQuestion = aliasedQuestion.replaceAll(name, `C${i + 1}`)
    }
    try { await limitar('__assistente_global__', 'assistenteGlobal') }
    catch (error) { if (error.status === 429) throw erro('limite_uso', 'resource-exhausted'); throw error }
    const response = await provider.generateStructuredResponse({ language: payload.language || 'pt-BR',
      question: sanitizar(aliasedQuestion, nomes), history: (payload.history || []).map((m) => ({ role: 'user', content: sanitizar(m.content, nomes) })),
      job, candidateRefs: retrieved.candidateRefs,
      sources: retrieved.sources.map(({ id, candidateRef, text, sourceType, field }) => ({ id, candidateRef, text, sourceType, field })) })
    // Não devolve resposta se acesso, vaga, candidato ou documentos mudaram durante a chamada ao modelo.
    await empresa(uid)
    const fresh = await contexto(uid, payload.vagaId)
    if (JSON.stringify(job) !== JSON.stringify(contextoVaga(fresh.vaga, nomes))
      || fresh.candidates.length !== ctx.candidates.length || fresh.candidates.some((c, i) => c.id !== ctx.candidates[i].id
        || fingerprint(c) !== fingerprint(ctx.candidates[i]) || !fresh.indexes.has(c.id))) throw erro('indice_desatualizado')
    const result = validarResposta(response, retrieved.sources, ctx.candidates)
    if (policy === 'iniciativa') result.limitations.push('initiative_only')
    if (retrieved.uncovered.length || [...ctx.indexes.values()].some((v) => v.resumeStatus !== 'ready')) result.limitations.push('partial_sources')
    if (!result.claims.length) result.limitations.push('insufficient_evidence')
    result.limitations = [...new Set(result.limitations)]
    return result
  }
  return { executar }
}
module.exports = { criarServicoAssistente, validarEntrada, cacheId }
