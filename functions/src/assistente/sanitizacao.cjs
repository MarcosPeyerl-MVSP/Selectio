const { createHash } = require('node:crypto')
const CAMPOS_PROFISSIONAIS = Object.freeze(['cargoAtual', 'anosExperiencia', 'escolaridade',
  'proficienciaIdiomas', 'hardSkills', 'pontosFortes', 'destaquesProjetos', 'narrativa', 'observacoesProfissionais'])
const CAMPOS_VAGA = Object.freeze(['rubricaCompatibilidade', 'titulo', 'descricaoLonga', 'descricao', 'responsabilidades', 'requisitos',
  'experiencia', 'escolaridade', 'idiomas', 'modeloTrabalho'])
const normalizar = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const protegidos = /\b(idade|nascimento|genero|sexo|raca|etnia|religiao|sexual|deficiencia|medica|medico|gravidez|gravida|civil|filhos|politica|sindical|nacionalidade|age|birth|gender|race|ethnicity|religion|disability|pregnancy|marital|children|nationality)\b/i
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
function sanitizar(text, nomes = []) {
  let result = String(text || '').replace(/\r/g, '\n')
    .split(/\n|(?<=[.!?;])\s+/).filter((line) => !protegidos.test(normalizar(line))
      && !/^\s*(nome|name|endereco|address|rua|avenida|cep|cpf|rg|contato|contact)\b/i.test(normalizar(line))).join('\n')
    .replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi, '[contato omitido]')
    .replace(/(?:https?:\/\/|www\.)\S+/gi, '[link omitido]')
    .replace(/\b\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}\b/g, '[identificador omitido]')
    .replace(/(?:\+\d{1,3}[\s-]*)?(?:\(\d{2}\)|\b\d{2})[\s-]*\d{4,5}[\s-]*\d{4}\b/g, '[contato omitido]')
    .replace(/\b(?:rua|avenida|av\.|street|address|endere[cç]o)\s+[^\n;]+/gi, '[endereço omitido]')
    .replace(/\b\d{2}[/.-]\d{2}[/.-]\d{4}\b/g, '[data omitida]')
  for (const name of nomes.filter(Boolean).sort((a, b) => b.length - a.length)) {
    for (const part of [name, ...name.split(/\s+/).filter((v) => v.length >= 3)]) {
      result = result.replace(new RegExp(`(?<![\\p{L}])${escape(part)}(?![\\p{L}])`, 'giu'), '[identidade omitida]')
    }
  }
  return result.replace(/[\t ]+/g, ' ').trim()
}
function valorProfissional(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value).slice(0, 5000)
  if (Array.isArray(value)) return value.slice(0, 100).filter((v) => typeof v === 'string').join(', ').slice(0, 5000)
  return ''
}
function camposProfissionais(candidate) {
  return Object.fromEntries(CAMPOS_PROFISSIONAIS.map((key) => [key, valorProfissional(candidate[key])]))
}
function contextoVaga(vaga, nomes) {
  let remaining = require('./config.cjs').LIMITES.vagaContexto
  return Object.fromEntries(CAMPOS_VAGA.map((key) => {
    const text = sanitizar(key === 'rubricaCompatibilidade' ? JSON.stringify(vaga[key] || {}).slice(0, 4000) : valorProfissional(vaga[key]), nomes)
    const selected = text.slice(0, Math.min(2000, remaining)); remaining -= selected.length
    return [key, selected]
  }))
}
const fingerprint = (candidate) => createHash('sha256').update(JSON.stringify({
  versao: require('./config.cjs').LIMITES.versao, empresaId: candidate.empresaId, vagaId: candidate.vagaId,
  nome: candidate.nome || '', campos: camposProfissionais(candidate), curriculo: candidate.curriculo || {},
  indicadorId: candidate.indicadorId || ''
})).digest('hex')
function politicaPergunta(question) {
  const value = normalizar(question)
  if (protegidos.test(value) || /\b(contrate|contratar automaticamente|recuse|rejeite|demita|hire|reject|fire)\b/.test(value)) return 'criterios_profissionais'
  return /proativ|personalidade|personality|proactive/.test(value) ? 'iniciativa' : ''
}
module.exports = { sanitizar, normalizar, camposProfissionais, contextoVaga, fingerprint, politicaPergunta }
