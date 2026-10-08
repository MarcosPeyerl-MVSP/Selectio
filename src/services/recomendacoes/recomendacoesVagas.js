// Shortlist lexical de oportunidades; não é nota de compatibilidade nem autorização.
export const CONFIG_RECOMENDACOES = Object.freeze({
  versao: 1, limite: 4, maxVagas: 100, maxHistorico: 200, recentes: 20,
  maxCandidatos: 200, maxTokens: 160, minimo: 6,
  minimoAfinidadeCandidato: 0.15, reforcoSecundario: 0.05,
  pesos: Object.freeze({ recente: 30, historico: 20, similaridade: 20, candidatos: 30 }),
})

const palavrasComuns = new Set(('de da do das dos em e a o as os para com por um uma no na nos nas ou que se ao aos the and of to in for with a an on is experiencia experience conhecimento knowledge vaga job profissional professional').split(' '))

export function normalizarTexto(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

const texto = (valor) => Array.isArray(valor) ? valor.join(' ') : typeof valor === 'string' ? valor : ''
const tokens = (valor) => new Set((normalizarTexto(valor).match(/[a-z0-9+#]+/g) || [])
  .filter((palavra) => palavra.length > 1 && !palavrasComuns.has(palavra))
  .slice(0, CONFIG_RECOMENDACOES.maxTokens))
const dataMs = (valor) => {
  const data = valor?.toDate ? valor.toDate() : valor
  return new Date(data || 0).getTime() || 0
}
const dataRegistro = (item) => dataMs(item.criadoEm || item.aplicadoEm || item.createdAt)

export function vagaDisponivelParaRecomendacao(vaga, agora = new Date()) {
  if (!vaga?.id || !(vaga.empresaId || vaga.empresaUid) || (vaga.status || 'aberta') !== 'aberta') return false
  // Solicitações empresariais ainda não publicadas não são oportunidades disponíveis.
  if (vaga.modoEmpresa === 'empresarial' && vaga.statusAprovacao !== 'publicada') return false
  const limite = vaga.expiraEm || vaga.dataLimite
  if (!limite) return true
  const valor = typeof limite === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(limite)
    ? `${limite}T23:59:59-03:00` : limite
  return dataMs(valor) > 0 && dataMs(valor) >= dataMs(agora)
}

function perfilVaga(vaga) {
  const rubrica = vaga.rubricaCompatibilidade?.ativa !== false ? vaga.rubricaCompatibilidade || {} : {}
  return tokens([vaga.titulo, vaga.area, ...[vaga.requisitos, rubrica.requisitosObrigatorios,
    rubrica.requisitosDesejaveis, rubrica.perfilIdeal].map(texto)].join(' '))
}

function perfilCandidato(candidato) {
  // Lista explícita: nunca nome, idade, gênero, contatos, salário ou conteúdo do arquivo.
  return tokens([candidato.cargoAtual, texto(candidato.hardSkills)].join(' '))
}

function similaridade(alvo, perfil) {
  if (!alvo.size || !perfil.size) return 0
  let comuns = 0
  for (const palavra of alvo) if (perfil.has(palavra)) comuns++
  return comuns / Math.sqrt(alvo.size * perfil.size)
}

function frequencias(perfis) {
  const mapa = new Map()
  for (const perfil of perfis) for (const palavra of perfil) mapa.set(palavra, (mapa.get(palavra) || 0) + 1)
  return mapa
}

function afinidadeHistorico(alvo, frequencia, quantidade) {
  if (!alvo.size || !quantidade) return 0
  let soma = 0
  for (const palavra of alvo) soma += frequencia.get(palavra) || 0
  return soma / (alvo.size * quantidade)
}

export function recomendarVagas({ indicadorId, vagas = [], indicacoes = [], candidatos = [], preSalvos = [], agora = new Date(), limite = CONFIG_RECOMENDACOES.limite }) {
  const config = CONFIG_RECOMENDACOES
  const doIndicador = (item) => Boolean(indicadorId) && item.indicadorId === indicadorId
  const historico = indicacoes.filter(doIndicador).sort((a, b) => dataRegistro(b) - dataRegistro(a)).slice(0, config.maxHistorico)
  const candidatosProprios = candidatos.filter(doIndicador)
  const vagasPorId = new Map(vagas.map((vaga) => [vaga.id, vaga]))
  const perfisHistorico = historico.map((item) => perfilVaga(vagasPorId.get(item.vagaId) || { titulo: item.vagaTitulo }))
  const recente = perfisHistorico.slice(0, config.recentes)
  const freqRecente = frequencias(recente)
  const freqHistorica = frequencias(perfisHistorico)
  const unicos = new Map()
  for (const candidato of [...preSalvos.filter(doIndicador), ...candidatosProprios]) {
    const chave = candidato.candidatoPreSalvoId || candidato.id
    if (chave && !unicos.has(chave)) unicos.set(chave, { candidato, perfil: perfilCandidato(candidato) })
    if (unicos.size >= config.maxCandidatos) break
  }
  // Índice invertido evita comparar todos os candidatos com todas as vagas.
  const indice = new Map()
  for (const [chave, { perfil }] of unicos) for (const palavra of perfil) {
    if (!indice.has(palavra)) indice.set(palavra, new Set())
    indice.get(palavra).add(chave)
  }
  const personalizada = perfisHistorico.some((perfil) => perfil.size) || indice.size > 0
  const resultado = []
  const vistas = new Set()
  for (const vaga of vagas.slice(0, config.maxVagas)) {
    if (vistas.has(vaga.id) || !vagaDisponivelParaRecomendacao(vaga, agora)) continue
    vistas.add(vaga.id)
    const alvo = perfilVaga(vaga)
    const relacionadas = new Set()
    for (const palavra of alvo) for (const chave of indice.get(palavra) || []) relacionadas.add(chave)
    let melhorCandidato = 0
    let quantidadeCandidatos = 0
    for (const chave of relacionadas) {
      const { candidato, perfil } = unicos.get(chave)
      const jaIndicado = candidato.vagaId === vaga.id || historico.some((item) => item.vagaId === vaga.id
        && (item.candidatoPreSalvoId === chave || item.candidatoId === candidato.id))
        || candidatosProprios.some((item) => item.vagaId === vaga.id && (item.candidatoPreSalvoId || item.id) === chave)
      if (jaIndicado) continue
      let afinidade = similaridade(alvo, perfil)
      const rubrica = vaga.rubricaCompatibilidade?.ativa !== false ? vaga.rubricaCompatibilidade || {} : {}
      // Sinais secundários só reforçam sobreposição profissional; não excluem pessoas.
      const sinais = [
        [candidato.escolaridade, rubrica.escolaridadeMinima],
        [candidato.proficienciaIdiomas, texto(rubrica.idiomasExigidos)],
        [candidato.modeloTrabalho, rubrica.modeloTrabalho],
      ].filter(([a, b]) => a && b && similaridade(tokens(a), tokens(b)) > 0).length
      const anos = Number(candidato.anosExperiencia)
      const minimoAnos = Number(rubrica.experienciaMinima)
      const experiencia = Number.isFinite(anos) && minimoAnos > 0 && anos >= minimoAnos ? 1 : 0
      afinidade = Math.min(1, afinidade * (1 + config.reforcoSecundario * (sinais + experiencia)))
      if (afinidade >= config.minimoAfinidadeCandidato) quantidadeCandidatos++
      melhorCandidato = Math.max(melhorCandidato, afinidade)
    }
    const sinais = {
      recente: afinidadeHistorico(alvo, freqRecente, recente.length),
      historico: afinidadeHistorico(alvo, freqHistorica, perfisHistorico.length),
      similaridade: Math.max(0, ...perfisHistorico.map((perfil) => similaridade(alvo, perfil))),
      candidatos: quantidadeCandidatos ? melhorCandidato : 0,
    }
    const score = Object.entries(config.pesos).reduce((soma, [chave, peso]) => soma + peso * sinais[chave], 0)
    if (personalizada && score < config.minimo) continue
    const motivos = []
    if (quantidadeCandidatos) motivos.push({ tipo: 'candidatos', count: quantidadeCandidatos })
    if (sinais.recente > 0) motivos.push({ tipo: 'recente' })
    else if (sinais.historico > 0) motivos.push({ tipo: 'historico' })
    if (!motivos.length && sinais.similaridade > 0) motivos.push({ tipo: 'similaridade' })
    resultado.push({ vaga, score, motivos: personalizada ? motivos.slice(0, 2) : [{ tipo: 'neutra' }] })
  }
  resultado.sort((a, b) => b.score - a.score || dataRegistro(b.vaga) - dataRegistro(a.vaga) || String(a.vaga.id).localeCompare(String(b.vaga.id)))
  return { personalizada, vagas: resultado.slice(0, Math.min(config.limite, Math.max(0, Number(limite) || 0))) }
}
