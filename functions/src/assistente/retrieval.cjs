const { LIMITES } = require('./config.cjs')
const { normalizar } = require('./sanitizacao.cjs')
const stop = new Set('quais quem qual com para como sobre mais candidatos candidato compare comparar requisitos vaga experiencia entre this the with which who candidate candidates compare experience'.split(' '))
function tokens(value) { return [...new Set(normalizar(value).match(/[a-z0-9+#.]{2,}/g) || [])].filter((v) => !stop.has(v)) }
function chunking(text, field, sourceType) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const chunks = []; let current = ''
  for (const word of words) {
    if (current.length + word.length + 1 > LIMITES.chunk) {
      if (current) chunks.push({ text: current, field, sourceType })
      current = ''
    }
    current = (current ? `${current} ` : '') + word.slice(0, LIMITES.chunk)
  }
  if (current) chunks.push({ text: current, field, sourceType })
  return chunks.slice(0, LIMITES.chunksDocumento)
}
function score(text, query) {
  const normalized = normalizar(text)
  return tokens(query).reduce((sum, token) => {
    const safe = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const suffix = token === 'react' ? '(?!\\s+native)' : ''
    return sum + (new RegExp(`(?<![a-z0-9])${safe}(?![a-z0-9])${suffix}`).test(normalized) ? 1 : 0)
  }, 0)
}
function detectarCandidato(question, candidates) {
  const q = normalizar(question)
  const named = candidates.filter((c) => {
    const name = normalizar(c.nome)
    return name && (` ${q} `).includes(` ${name} `)
  })
  if (named.length) return named
  return candidates.filter((c) => {
    const first = normalizar(c.nome).split(' ')[0]
    return first.length >= 3 && new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(q)
  })
}
function recuperar({ question, selectionQuestion = question, candidates, indexes, vaga }) {
  const named = detectarCandidato(selectionQuestion, candidates)
  const chosen = named.length ? named : candidates
  const selected = []; let length = 0
  for (const candidate of chosen) {
    const ref = `C${candidates.findIndex((c) => c.id === candidate.id) + 1}`
    const chunks = (indexes.get(candidate.id)?.chunks || []).map((chunk, i) => ({ ...chunk,
      candidateId: candidate.id, candidateRef: ref, id: `SRC_${ref}_${i + 1}`,
      score: score(chunk.text, question) * 3 + score(chunk.text, JSON.stringify(vaga)) * 0.1
    })).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    for (const chunk of chunks.slice(0, LIMITES.chunksCandidato)) {
      if (selected.length >= LIMITES.chunksContexto || length + chunk.text.length > LIMITES.contexto) break
      selected.push(chunk); length += chunk.text.length
    }
  }
  return { sources: selected, candidateRefs: chosen.map((c) => `C${candidates.findIndex((item) => item.id === c.id) + 1}`),
    uncovered: chosen.filter((c) => !selected.some((s) => s.candidateId === c.id)).map((c) => c.id) }
}
module.exports = { chunking, score, tokens, recuperar, detectarCandidato }
