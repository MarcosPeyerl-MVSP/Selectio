const { HttpsError } = require('firebase-functions/v2/https')
const { sanitizar, politicaPergunta } = require('./sanitizacao.cjs')
const invalida = () => new HttpsError('unavailable', 'Resposta sem fundamentação válida.', { motivo: 'resposta_invalida' })
function validarResposta(value, sources, candidates) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some((k) => !['claims', 'limitations'].includes(k))
    || !Array.isArray(value.claims) || value.claims.length > 48 || !Array.isArray(value.limitations)
    || value.limitations.length > 4 || value.limitations.some((v) => !['insufficient_evidence', 'partial_sources', 'human_review'].includes(v))) throw invalida()
  const byId = new Map(sources.map((s) => [s.id, s])); const used = new Map()
  const claims = value.claims.map((claim) => {
    if (!claim || Object.keys(claim).some((k) => !['candidateRef', 'text', 'citationIds'].includes(k))
      || typeof claim.text !== 'string' || !claim.text.trim() || claim.text.length > 600
      || !Array.isArray(claim.citationIds) || !claim.citationIds.length || claim.citationIds.length > 4
      || sanitizar(claim.text, candidates.map((c) => c.nome)).replace(/\s+/g, ' ') !== claim.text.trim().replace(/\s+/g, ' ')
      || /personalidade|personality|(?:^|\s)(?:é|is)\s+(?:mais\s+|more\s+)?proativ|melhor candidato|best candidate/i.test(claim.text)
      || politicaPergunta(claim.text) === 'criterios_profissionais') throw invalida()
    const cited = claim.citationIds.map((id) => {
      const source = byId.get(id)
      if (!source || source.candidateRef !== claim.candidateRef || !candidates.some((c) => c.id === source.candidateId)) throw invalida()
      used.set(id, source); return source
    })
    return { candidateId: cited[0].candidateId, text: claim.text, citationIds: [...new Set(claim.citationIds)] }
  })
  return { claims, limitations: [...new Set([...value.limitations, 'human_review'])], citations: [...used.values()].map((s) => ({
    id: s.id, candidateId: s.candidateId, candidateName: candidates.find((c) => c.id === s.candidateId).nome,
    sourceType: s.sourceType, field: s.field, excerpt: s.text
  })), candidates: candidates.filter((c) => claims.some((v) => v.candidateId === c.id)).map((c) => ({ id: c.id, name: c.nome })) }
}
module.exports = { validarResposta }
