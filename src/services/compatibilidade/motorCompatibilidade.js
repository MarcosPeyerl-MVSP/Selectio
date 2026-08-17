import { normalizarRubricaDaVaga, textoParaLista } from '../../utils/rubricaCompatibilidade.js'

export const ANALISE_VERSAO = '2.0.0'

const FATORES = Object.freeze({
  atende: 1,
  atende_parcialmente: 0.5,
  nao_atende: 0,
  nao_comprovado: 0,
  nao_aplicavel: 0
})

const STOPWORDS = new Set([
  'a', 'ao', 'aos', 'as', 'com', 'como', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'na', 'nas',
  'no', 'nos', 'o', 'os', 'ou', 'para', 'por', 'que', 'se', 'the', 'an', 'and', 'for', 'in',
  'of', 'on', 'or', 'to', 'with', 'profissional', 'pessoa', 'conhecimento', 'experiencia'
])

const SINONIMOS = Object.freeze({
  reactjs: 'react',
  'react.js': 'react',
  typescript: 'typescript',
  'type script': 'typescript',
  javascript: 'javascript',
  'java script': 'javascript',
  ecmascript: 'javascript',
  nodejs: 'node',
  'node.js': 'node',
  ingles: 'ingles',
  english: 'ingles',
  remoto: 'remoto',
  remote: 'remoto',
  hibrido: 'hibrido',
  hybrid: 'hibrido',
  presencial: 'presencial',
  onsite: 'presencial',
  'on site': 'presencial'
})

const REGRAS_SKILLS = Object.freeze([
  {
    ids: ['react'],
    completos: ['react', 'reactjs', 'react.js', 'react web', 'react para web'],
    parciais: ['react native'],
    excluirParciaisDosCompletos: true
  },
  { ids: ['javascript', 'java script', 'js'], completos: ['javascript', 'ecmascript', 'es6', 'es2015'] },
  { ids: ['typescript', 'type script'], completos: ['typescript', 'type script'] },
  { ids: ['node', 'nodejs', 'node.js'], completos: ['node', 'nodejs', 'node.js'] },
  {
    ids: ['html semantico', 'html semantic', 'semantic html'],
    completos: ['html semantico', 'semantic html'],
    parciais: ['html', 'html5']
  },
  {
    ids: ['css responsivo', 'responsive css'],
    completos: ['css responsivo', 'responsive css', 'design responsivo', 'responsive design'],
    todosNaMesmaEvidencia: ['css', 'responsiv'],
    parciais: ['css', 'css3']
  },
  { ids: ['git'], completos: ['git'] },
  {
    ids: ['testes automatizados', 'automated tests', 'testes de software'],
    completos: ['testes automatizados', 'automated tests', 'jest', 'vitest', 'cypress', 'playwright', 'testing library'],
    parciais: ['testes', 'teste unitario', 'unit test']
  },
  {
    ids: ['acessibilidade web', 'web accessibility', 'a11y'],
    completos: ['acessibilidade web', 'web accessibility', 'wcag', 'a11y', 'aria'],
    parciais: ['acessibilidade']
  },
  { ids: ['apis rest', 'api rest', 'rest api'], completos: ['api rest', 'apis rest', 'rest api', 'restful'] },
  {
    ids: ['web performance', 'performance web', 'desempenho web'],
    completos: ['web performance', 'performance web', 'desempenho web', 'core web vitals', 'lighthouse'],
    parciais: ['performance', 'desempenho']
  }
])

const normalizar = (valor) => String(valor ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9+#.\s-]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const canonizar = (valor) => {
  const texto = normalizar(valor)
  return SINONIMOS[texto] || texto
}

const escaparRegex = (valor) => valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const regexTermo = (termo) => {
  const partes = normalizar(termo).split(/\s+/).filter(Boolean).map(escaparRegex)
  if (!partes.length) return null
  return new RegExp(`(^|[^a-z0-9+#])${partes.join('\\s+')}(?=$|[^a-z0-9+#])`, 'i')
}

const contemTermo = (texto, termo) => {
  const regex = regexTermo(termo)
  return Boolean(regex && regex.test(normalizar(texto)))
}

const tokens = (valor) => new Set(normalizar(valor)
  .split(/\s+/)
  .map(canonizar)
  .filter((token) => token.length > 1 && !STOPWORDS.has(token)))

const frases = (texto) => String(texto || '')
  .split(/\n+|(?<=[.!?;])\s+/)
  .map((item) => item.replace(/\s+/g, ' ').trim())
  .filter(Boolean)

const encontrarFraseComTermo = (texto, termos) => frases(texto)
  .find((frase) => termos.some((termo) => contemTermo(frase, termo))) || ''

const arredondar = (valor, casas = 1) => {
  const fator = 10 ** casas
  return Math.round(Number(valor || 0) * fator) / fator
}

export const sanitizarTextoCurriculo = (valor) => {
  const linhas = String(valor || '').replace(/\r/g, '\n').split('\n')
  const primeiras = linhas.slice(0, 8).join(' ')
  const primeiraLinha = linhas.findIndex((linha) => linha.trim())
  if (
    primeiraLinha >= 0
    && linhas[primeiraLinha].trim().split(/\s+/).length <= 8
    && /\b(idade|tel(?:efone)?|celular|e-?mail|cpf|endere[cç]o)\b/i.test(primeiras)
  ) {
    linhas[primeiraLinha] = '[identificacao omitida]'
  }

  return linhas
    .filter((linha) => !/^\s*(?:idade\s*:|tel\.?\s*:|telefone\s*:|celular\s*:|e-?mail\s*:|cpf\s*:|rg\s*:|endere[cç]o\s*:)/i.test(linha))
    .join('\n')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[e-mail omitido]')
    .replace(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9?\d{4})[-.\s]?\d{4}/g, '[telefone omitido]')
    .replace(/\b\d{3}[.-]\d{3}[.-]\d{3}-\d{2}\b/g, '[documento omitido]')
    .replace(/https?:\/\/\S+|\b(?:www\.|linkedin\.com\/|github\.com\/)\S+/gi, '[link omitido]')
    .replace(/[\t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export const dividirTextoEmTrechos = (texto, tamanho = 420, sobreposicao = 60) => {
  const unidades = String(texto || '')
    .split(/\n{2,}|(?<=[.!?])\s+(?=[A-ZÀ-Ý])/)
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const resultado = []
  let atual = ''

  unidades.forEach((unidade) => {
    if (`${atual} ${unidade}`.trim().length <= tamanho) {
      atual = `${atual} ${unidade}`.trim()
      return
    }

    if (atual) resultado.push(atual)
    const prefixo = atual.slice(-sobreposicao)
    atual = `${prefixo} ${unidade}`.trim().slice(0, tamanho)
  })

  if (atual) resultado.push(atual)
  return resultado.length ? resultado : [String(texto || '').slice(0, tamanho)].filter(Boolean)
}

export const similaridadeLexical = (a, b) => {
  const tokensA = tokens(a)
  const tokensB = tokens(b)
  if (!tokensA.size || !tokensB.size) return 0
  let intersecao = 0
  tokensA.forEach((token) => {
    if (tokensB.has(token)) intersecao += 1
  })
  return intersecao / Math.sqrt(tokensA.size * tokensB.size)
}

const buscarRegraSkill = (descricao) => {
  const consulta = normalizar(descricao)
  return REGRAS_SKILLS.find((regra) => regra.ids.some((id) => normalizar(id) === consulta)) || null
}

export const prepararConsultasSemanticas = (vaga) => {
  const rubrica = normalizarRubricaDaVaga(vaga?.rubricaCompatibilidade)
  const consultas = []
  textoParaLista(rubrica.requisitosObrigatorios).forEach((texto, indice) => {
    consultas.push({ id: `obrigatorio_${indice}`, texto })
  })
  textoParaLista(rubrica.requisitosDesejaveis).forEach((texto, indice) => {
    consultas.push({ id: `desejavel_${indice}`, texto })
  })
  if (rubrica.perfilIdeal || vaga?.descricaoLonga) {
    consultas.push({ id: 'responsabilidades', texto: [rubrica.perfilIdeal, vaga?.descricaoLonga].filter(Boolean).join('. ') })
  }
  return consultas
}

const encontrarMelhorEvidenciaLexical = (consulta, trechos) => {
  let melhor = { similaridade: 0, evidencia: '' }
  trechos.forEach((trecho) => {
    const similaridade = similaridadeLexical(consulta, trecho)
    if (similaridade > melhor.similaridade) melhor = { similaridade, evidencia: trecho.slice(0, 320) }
  })
  return melhor
}

const avaliarSkill = ({ id, descricao, textoCompleto, trechos, semantica }) => {
  const regra = buscarRegraSkill(descricao)
  let textoParaCompletos = textoCompleto
  if (regra?.excluirParciaisDosCompletos) {
    regra.parciais.forEach((termo) => {
      const regex = regexTermo(termo)
      if (regex) textoParaCompletos = normalizar(textoParaCompletos).replace(new RegExp(regex.source, 'gi'), ' ')
    })
  }

  const termosCompletos = regra?.completos || [descricao]
  const termoCompleto = termosCompletos.find((termo) => contemTermo(textoParaCompletos, termo))
  const evidenciaConjunta = regra?.todosNaMesmaEvidencia
    ? frases(textoCompleto).find((frase) => regra.todosNaMesmaEvidencia.every((termo) => normalizar(frase).includes(normalizar(termo))))
    : ''
  if (termoCompleto || evidenciaConjunta) {
    const evidencia = evidenciaConjunta || encontrarFraseComTermo(textoCompleto, [termoCompleto])
    return { resultado: 'atende', similaridade: 1, evidencia, fonte: 'evidencia_objetiva' }
  }

  const termoParcial = regra?.parciais?.find((termo) => contemTermo(textoCompleto, termo))
  if (termoParcial) {
    return {
      resultado: 'atende_parcialmente',
      similaridade: 0.65,
      evidencia: encontrarFraseComTermo(textoCompleto, [termoParcial]),
      fonte: 'habilidade_relacionada'
    }
  }

  const lexical = encontrarMelhorEvidenciaLexical(descricao, trechos)
  const similaridadeSemantica = Number(semantica?.[id]?.similaridade || 0)
  const apoioLexical = Math.max(
    lexical.similaridade,
    similaridadeLexical(descricao, semantica?.[id]?.evidencia || '')
  )
  const consultaEspecifica = tokens(descricao).size >= 2
  if (!regra && consultaEspecifica && similaridadeSemantica >= 0.82 && apoioLexical >= 0.22) {
    return {
      resultado: 'atende_parcialmente',
      similaridade: Math.min(0.79, similaridadeSemantica),
      evidencia: semantica[id]?.evidencia || lexical.evidencia,
      fonte: 'semantica_com_apoio_lexical'
    }
  }

  return {
    resultado: 'nao_comprovado',
    similaridade: Math.max(apoioLexical, similaridadeSemantica),
    evidencia: '',
    fonte: 'sem_evidencia_suficiente'
  }
}

const avaliarTexto = ({ id, descricao, textoCompleto, trechos, semantica }) => {
  const correspondenciaDireta = contemTermo(textoCompleto, descricao)
  const lexical = encontrarMelhorEvidenciaLexical(descricao, trechos)
  const resultadoSemantico = semantica?.[id]
  const similaridadeSemantica = Number(resultadoSemantico?.similaridade || 0)
  const apoioLexical = Math.max(
    lexical.similaridade,
    similaridadeLexical(descricao, resultadoSemantico?.evidencia || '')
  )
  const evidencia = correspondenciaDireta
    ? encontrarFraseComTermo(textoCompleto, [descricao])
    : resultadoSemantico?.evidencia || lexical.evidencia

  if (correspondenciaDireta || (similaridadeSemantica >= 0.78 && apoioLexical >= 0.16)) {
    return { resultado: 'atende', similaridade: correspondenciaDireta ? 1 : similaridadeSemantica, evidencia, fonte: correspondenciaDireta ? 'direta' : 'semantica_calibrada' }
  }
  if (apoioLexical >= 0.42 || (similaridadeSemantica >= 0.64 && apoioLexical >= 0.1)) {
    return { resultado: 'atende_parcialmente', similaridade: Math.max(apoioLexical, similaridadeSemantica), evidencia, fonte: 'parcial_calibrada' }
  }
  return { resultado: 'nao_comprovado', similaridade: Math.max(apoioLexical, similaridadeSemantica), evidencia: '', fonte: 'sem_evidencia_suficiente' }
}

const resultadoPeloFator = (fator, possuiNaoAtende = false) => {
  if (fator >= 0.85) return 'atende'
  if (fator > 0) return 'atende_parcialmente'
  return possuiNaoAtende ? 'nao_atende' : 'nao_comprovado'
}

const extrairAnosFormulario = (valor) => {
  const texto = normalizar(valor)
  if (/^\d{1,2}(?:[.,]\d)?$/.test(texto)) return Number(texto.replace(',', '.'))
  const match = texto.match(/(\d{1,2}(?:[.,]\d)?)\s*(?:anos?|years?)/)
  return match ? Number(match[1].replace(',', '.')) : 0
}

const TIPOS_CABECALHO = Object.freeze({
  experiencia: /^(experiencia(?: profissional)?|historico profissional|trajetoria profissional|professional experience|work experience)$/,
  educacao: /^(educacao(?: e idiomas)?|formacao(?: academica)?|escolaridade|education|academic background)$/,
  idiomas: /^(idiomas|linguas|languages)$/,
  habilidades: /^(habilidades(?: e competencias)?|competencias|skills|tecnologias)$/,
  projetos: /^(projetos|projects|portfolio)$/,
  cursos: /^(cursos(?: extracurriculares)?(?: e voluntariado)?|certificacoes|certifications|voluntariado)$/,
  objetivo: /^(objetivo|resumo(?: profissional)?|perfil(?: profissional)?|summary|objective)$/
})

const tipoCabecalho = (linha) => {
  const texto = normalizar(linha).replace(/:$/, '').trim()
  if (!texto || texto.length > 70) return ''
  return Object.entries(TIPOS_CABECALHO).find(([, regex]) => regex.test(texto))?.[0] || ''
}

const extrairSecao = (texto, tipos) => {
  const linhas = String(texto || '').split(/\n+/)
  const resultado = []
  let coletando = false
  for (const linha of linhas) {
    const tipo = tipoCabecalho(linha)
    if (tipo) {
      if (coletando && !tipos.includes(tipo)) break
      coletando = tipos.includes(tipo)
      continue
    }
    if (coletando && linha.trim()) resultado.push(linha.trim())
  }
  return resultado.join('\n')
}

const extrairAnosCurriculo = (textoCurriculo) => {
  const texto = sanitizarTextoCurriculo(textoCurriculo)
  const normalizado = normalizar(texto)
  const explicitos = [
    ...normalizado.matchAll(/(?:experiencia|atuacao)(?: profissional)?(?: comprovada)?\s*(?:de|por|com|ha)?\s*(\d{1,2}(?:[.,]\d)?)\s*anos?/g),
    ...normalizado.matchAll(/(\d{1,2}(?:[.,]\d)?)\s*anos?\s*(?:de|em)?\s*(?:experiencia|atuacao)(?: profissional)?/g)
  ].map((match) => Number(match[1].replace(',', '.')))

  const secaoExperiencia = normalizar(extrairSecao(texto, ['experiencia']))
  const intervalos = [...secaoExperiencia.matchAll(/\b(19\d{2}|20\d{2})\s*(?:-|a|ate|to)\s*(19\d{2}|20\d{2}|atual|presente|current)\b/g)]
    .map((match) => {
      const inicio = Number(match[1])
      const fim = /atual|presente|current/.test(match[2]) ? new Date().getFullYear() : Number(match[2])
      return Math.max(0, Math.min(60, fim - inicio))
    })

  return Math.max(0, ...explicitos, ...intervalos)
}

const NIVEL_ESCOLARIDADE = Object.freeze({
  medio: 1,
  tecnico: 2,
  superior_cursando: 3,
  superior_completo: 4,
  pos_graduacao: 5
})

const detectarEscolaridade = (valor, { curriculo = false } = {}) => {
  const sanitizado = sanitizarTextoCurriculo(valor)
  let textoBase = sanitizado
  if (curriculo) {
    const secao = extrairSecao(sanitizado, ['educacao'])
    textoBase = secao || sanitizado.split(/\n+/)
      .filter((linha) => /\b(ensino|formacao|graduacao|bacharel|tecnologo|tecnico|universidade|faculdade)\b/i.test(normalizar(linha)))
      .join('\n')
  }
  const texto = normalizar(textoBase)
  if (/pos[- ]?graduacao|mba|mestrado|doutorado|especializacao/.test(texto)) return 'pos_graduacao'
  if (/superior completo|graduacao completa|bacharel|tecnologo completo/.test(texto)) return 'superior_completo'
  if (/superior cursando|graduacao cursando|universitario/.test(texto)) return 'superior_cursando'
  if (/tecnico|ensino medio tecnico/.test(texto)) return 'tecnico'
  if (/medio|ensino medio/.test(texto)) return 'medio'
  return ''
}

const detectarModelo = (valor) => {
  const texto = normalizar(valor)
  if (/hibrid|hybrid/.test(texto)) return 'hibrido'
  if (/remot|home office/.test(texto)) return 'remoto'
  if (/presencial|on.?site/.test(texto)) return 'presencial'
  return ''
}

const NIVEL_IDIOMA = Object.freeze({ basico: 1, iniciante: 1, intermediario: 2, avancado: 3, fluente: 4, nativo: 5 })

const detectarNivelIdioma = (valor) => Object.entries(NIVEL_IDIOMA)
  .find(([nivel]) => contemTermo(valor, nivel))?.[1] || 0

const avaliarIdioma = (exigencia, textoCompleto) => {
  const palavrasNivel = Object.keys(NIVEL_IDIOMA)
  const idioma = normalizar(exigencia).split(/\s+/).filter((parte) => !palavrasNivel.includes(parte)).join(' ')
  const evidencia = encontrarFraseComTermo(textoCompleto, [idioma])
  if (!evidencia) return { resultado: 'nao_comprovado', evidencia: '', similaridade: 0 }
  const nivelExigido = detectarNivelIdioma(exigencia)
  const nivelEncontrado = detectarNivelIdioma(evidencia)
  if (!nivelExigido || nivelEncontrado >= nivelExigido) return { resultado: 'atende', evidencia, similaridade: 1 }
  if (!nivelEncontrado) return { resultado: 'atende_parcialmente', evidencia, similaridade: 0.6 }
  return { resultado: 'nao_atende', evidencia, similaridade: 0.2 }
}

const criarCriterio = ({ id, categoria, titulo, peso, resultado, evidencias = [], detalhes = [], fator, cobertura = resultado === 'nao_comprovado' || resultado === 'nao_aplicavel' ? 0 : 1, aplicavel = true }) => {
  const pesoConfigurado = Number(peso || 0)
  const pesoAplicavel = aplicavel ? pesoConfigurado : 0
  const fatorFinal = Number.isFinite(Number(fator)) ? Number(fator) : (FATORES[resultado] || 0)
  return {
    id,
    categoria,
    titulo,
    peso: pesoAplicavel,
    pesoConfigurado,
    resultado: aplicavel ? resultado : 'nao_aplicavel',
    pontos: arredondar(pesoAplicavel * fatorFinal),
    cobertura: arredondar(Math.max(0, Math.min(1, cobertura)), 3),
    evidencias: evidencias.filter(Boolean).map(sanitizarTextoCurriculo).filter(Boolean).slice(0, 5),
    detalhes
  }
}

const encontrarEvidenciaEliminatoria = (descricao, textoCompleto) => {
  const alvo = normalizar(descricao).replace(/^(ausencia de|falta de|sem|nao possuir|nao ter|indisponibilidade para)\s+/, '')
  const negacao = /\b(sem|nao possui|nao tenho|nao tem|nunca trabalhou|ausencia de|falta de|indisponivel|nao disponivel)\b/
  return frases(textoCompleto).find((frase) => {
    const normalizada = normalizar(frase)
    return negacao.test(normalizada) && similaridadeLexical(alvo, normalizada) >= 0.28
  }) || ''
}

export const criarPerfilSeguroDoCandidato = (candidato) => ({
  cargoAtual: String(candidato?.cargoAtual || ''),
  anosExperiencia: String(candidato?.anosExperiencia || ''),
  escolaridade: String(candidato?.escolaridade || ''),
  proficienciaIdiomas: String(candidato?.proficienciaIdiomas || candidato?.idiomas || ''),
  hardSkills: Array.isArray(candidato?.hardSkills) ? candidato.hardSkills.map(String) : [],
  softSkills: Array.isArray(candidato?.softSkills) ? candidato.softSkills.map(String) : [],
  expectativaSalarial: String(candidato?.expectativaSalarial || ''),
  modeloTrabalho: String(candidato?.modeloTrabalho || ''),
  avisoPrevio: String(candidato?.avisoPrevio || ''),
  narrativa: String(candidato?.narrativa || ''),
  pontosFortes: String(candidato?.pontosFortes || ''),
  destaquesProjetos: String(candidato?.destaquesProjetos || ''),
  observacoesProfissionais: String(candidato?.observacoesProfissionais || '')
})

export const avaliarCompatibilidade = ({ candidato, vaga, textoCurriculo = '', semantica = {}, extracao = {} }) => {
  const rubrica = normalizarRubricaDaVaga(vaga?.rubricaCompatibilidade)
  if (!rubrica.ativa) throw new Error('A vaga nao possui rubrica de compatibilidade ativa.')

  const perfil = criarPerfilSeguroDoCandidato(candidato)
  const curriculoSanitizado = sanitizarTextoCurriculo(textoCurriculo)
  const textoFormulario = [
    perfil.cargoAtual, perfil.anosExperiencia, perfil.escolaridade, perfil.proficienciaIdiomas,
    perfil.hardSkills.join(', '), perfil.softSkills.join(', '), perfil.modeloTrabalho,
    perfil.narrativa, perfil.pontosFortes, perfil.destaquesProjetos, perfil.observacoesProfissionais
  ].filter(Boolean).join('\n')
  const textoCompleto = `${textoFormulario}\n${curriculoSanitizado}`.trim()
  const trechos = dividirTextoEmTrechos(textoCompleto)
  const trechosCurriculo = dividirTextoEmTrechos(curriculoSanitizado)
  const trechosFormulario = dividirTextoEmTrechos(textoFormulario)
  const criterios = []
  const discrepancias = []
  const alertas = []

  const obrigatorios = textoParaLista(rubrica.requisitosObrigatorios)
  const desejaveis = textoParaLista(rubrica.requisitosDesejaveis)
  const avaliarSkillComFontes = (descricao, id) => {
    const curriculo = avaliarSkill({ id, descricao, textoCompleto: curriculoSanitizado, trechos: trechosCurriculo, semantica })
    const formulario = avaliarSkill({ id, descricao, textoCompleto: textoFormulario, trechos: trechosFormulario, semantica: {} })
    if (curriculo.resultado !== 'nao_comprovado') return curriculo
    if (formulario.resultado === 'nao_comprovado') return curriculo

    discrepancias.push({
      campo: `hardSkill:${descricao}`,
      formulario: 'informado',
      curriculo: 'nao comprovado'
    })
    return {
      resultado: 'atende_parcialmente',
      similaridade: Math.min(0.6, formulario.similaridade || 0.6),
      evidencia: `Informado apenas no formulario: ${descricao}.`,
      fonte: 'formulario_sem_comprovacao_curriculo'
    }
  }
  const avaliacoesObrigatorias = obrigatorios.map((descricao, indice) => ({ descricao, ...avaliarSkillComFontes(descricao, `obrigatorio_${indice}`) }))
  const avaliacoesDesejaveis = desejaveis.map((descricao, indice) => ({ descricao, ...avaliarSkillComFontes(descricao, `desejavel_${indice}`) }))
  const fatorObrigatorios = avaliacoesObrigatorias.length ? avaliacoesObrigatorias.reduce((total, item) => total + (FATORES[item.resultado] || 0), 0) / avaliacoesObrigatorias.length : 0
  const fatorDesejaveis = avaliacoesDesejaveis.length ? avaliacoesDesejaveis.reduce((total, item) => total + (FATORES[item.resultado] || 0), 0) / avaliacoesDesejaveis.length : 0
  const possuiAmbos = avaliacoesObrigatorias.length && avaliacoesDesejaveis.length
  const fatorSkills = possuiAmbos ? fatorObrigatorios * 0.8 + fatorDesejaveis * 0.2 : (avaliacoesObrigatorias.length ? fatorObrigatorios : fatorDesejaveis)
  const avaliacoesSkills = [...avaliacoesObrigatorias, ...avaliacoesDesejaveis]
  const coberturaSkills = avaliacoesSkills.length ? avaliacoesSkills.filter((item) => item.resultado !== 'nao_comprovado').length / avaliacoesSkills.length : 0
  criterios.push(criarCriterio({
    id: 'hardSkills', categoria: 'hardSkills', titulo: 'Requisitos e habilidades', peso: rubrica.pesos.hardSkills,
    resultado: resultadoPeloFator(fatorSkills), fator: fatorSkills, cobertura: coberturaSkills,
    aplicavel: avaliacoesSkills.length > 0, evidencias: avaliacoesSkills.map((item) => item.evidencia),
    detalhes: avaliacoesSkills.map(({ descricao, resultado, similaridade, fonte }) => ({ descricao, resultado, confianca: Math.round(Math.max(0, Math.min(1, similaridade)) * 100), fonte }))
  }))
  avaliacoesObrigatorias.filter((item) => item.resultado !== 'atende').forEach((item) => {
    alertas.push({ tipo: 'obrigatorio', descricao: item.descricao, resultado: item.resultado })
  })

  const anosFormulario = extrairAnosFormulario(perfil.anosExperiencia)
  const anosCurriculo = extrairAnosCurriculo(curriculoSanitizado)
  const anosConsiderados = anosCurriculo || anosFormulario
  const experienciaAplicavel = Number(rubrica.experienciaMinima || 0) > 0
  let resultadoExperiencia = 'nao_comprovado'
  if (experienciaAplicavel && anosConsiderados >= Number(rubrica.experienciaMinima)) resultadoExperiencia = 'atende'
  else if (experienciaAplicavel && anosConsiderados > 0) resultadoExperiencia = 'nao_atende'
  if (experienciaAplicavel && anosFormulario && anosCurriculo && Math.abs(anosFormulario - anosCurriculo) >= 1) {
    discrepancias.push({ campo: 'experiencia', formulario: `${anosFormulario} anos`, curriculo: `aproximadamente ${anosCurriculo} anos` })
    if (resultadoExperiencia === 'atende') resultadoExperiencia = 'atende_parcialmente'
  }
  criterios.push(criarCriterio({ id: 'experiencia', categoria: 'experiencia', titulo: 'Experiencia profissional', peso: rubrica.pesos.experiencia, resultado: resultadoExperiencia, aplicavel: experienciaAplicavel, evidencias: anosConsiderados ? [`${anosConsiderados} anos de experiencia identificados`] : [] }))

  const escolaridadeFormulario = detectarEscolaridade(perfil.escolaridade)
  const escolaridadeCurriculo = detectarEscolaridade(curriculoSanitizado, { curriculo: true })
  const escolaridade = escolaridadeCurriculo || escolaridadeFormulario
  const nivelMinimo = NIVEL_ESCOLARIDADE[rubrica.escolaridadeMinima] || 0
  const nivelEncontrado = NIVEL_ESCOLARIDADE[escolaridade] || 0
  const escolaridadeAplicavel = nivelMinimo > 0
  let resultadoEscolaridade = 'nao_comprovado'
  if (escolaridadeAplicavel && nivelEncontrado >= nivelMinimo) resultadoEscolaridade = 'atende'
  else if (escolaridadeAplicavel && nivelEncontrado) resultadoEscolaridade = 'nao_atende'
  if (escolaridadeAplicavel && escolaridadeFormulario && escolaridadeCurriculo && escolaridadeFormulario !== escolaridadeCurriculo) {
    discrepancias.push({ campo: 'escolaridade', formulario: escolaridadeFormulario, curriculo: escolaridadeCurriculo })
    if (resultadoEscolaridade === 'atende') resultadoEscolaridade = 'atende_parcialmente'
  }
  criterios.push(criarCriterio({ id: 'escolaridade', categoria: 'escolaridade', titulo: 'Escolaridade', peso: rubrica.pesos.escolaridade, resultado: resultadoEscolaridade, aplicavel: escolaridadeAplicavel, evidencias: escolaridade ? [escolaridade] : [] }))

  const idiomas = textoParaLista(rubrica.idiomasExigidos)
  const avaliacoesIdiomas = idiomas.map((idioma) => ({ descricao: idioma, ...avaliarIdioma(idioma, textoCompleto) }))
  const fatorIdiomas = avaliacoesIdiomas.length ? avaliacoesIdiomas.reduce((total, item) => total + (FATORES[item.resultado] || 0), 0) / avaliacoesIdiomas.length : 0
  const coberturaIdiomas = avaliacoesIdiomas.length ? avaliacoesIdiomas.filter((item) => item.resultado !== 'nao_comprovado').length / avaliacoesIdiomas.length : 0
  criterios.push(criarCriterio({
    id: 'idiomas', categoria: 'idiomas', titulo: 'Idiomas', peso: rubrica.pesos.idiomas,
    resultado: resultadoPeloFator(fatorIdiomas, avaliacoesIdiomas.some((item) => item.resultado === 'nao_atende')),
    fator: fatorIdiomas, cobertura: coberturaIdiomas, aplicavel: idiomas.length > 0,
    evidencias: avaliacoesIdiomas.map((item) => item.evidencia), detalhes: avaliacoesIdiomas
  }))

  const modeloEsperado = detectarModelo(rubrica.modeloTrabalho)
  const modeloFormulario = detectarModelo(perfil.modeloTrabalho)
  const modeloCurriculo = detectarModelo(curriculoSanitizado)
  const modeloEncontrado = modeloFormulario || modeloCurriculo
  let resultadoModelo = 'nao_comprovado'
  if (modeloEsperado && modeloEncontrado === modeloEsperado) resultadoModelo = 'atende'
  else if (modeloEsperado && modeloEncontrado) resultadoModelo = [modeloEsperado, modeloEncontrado].includes('hibrido') ? 'atende_parcialmente' : 'nao_atende'
  if (modeloEsperado && modeloFormulario && modeloCurriculo && modeloFormulario !== modeloCurriculo) {
    discrepancias.push({ campo: 'modeloTrabalho', formulario: modeloFormulario, curriculo: modeloCurriculo })
    if (resultadoModelo === 'atende') resultadoModelo = 'atende_parcialmente'
  }
  criterios.push(criarCriterio({ id: 'modeloTrabalho', categoria: 'modeloTrabalho', titulo: 'Modelo de trabalho', peso: rubrica.pesos.modeloTrabalho, resultado: resultadoModelo, aplicavel: Boolean(modeloEsperado), evidencias: modeloEncontrado ? [modeloEncontrado] : [] }))

  const descricaoResponsabilidades = [rubrica.perfilIdeal, vaga?.descricaoLonga].filter(Boolean).join('. ')
  const responsabilidadesAplicavel = Boolean(descricaoResponsabilidades.trim())
  const resultadoResponsabilidades = responsabilidadesAplicavel ? avaliarTexto({ id: 'responsabilidades', descricao: descricaoResponsabilidades, textoCompleto, trechos, semantica }) : { resultado: 'nao_comprovado', evidencia: '', similaridade: 0 }
  criterios.push(criarCriterio({
    id: 'responsabilidades', categoria: 'responsabilidades', titulo: 'Responsabilidades e perfil profissional',
    peso: rubrica.pesos.responsabilidades, resultado: resultadoResponsabilidades.resultado,
    aplicavel: responsabilidadesAplicavel, evidencias: [resultadoResponsabilidades.evidencia],
    detalhes: [{ fonte: resultadoResponsabilidades.fonte || 'sem_evidencia_suficiente', confianca: Math.round((resultadoResponsabilidades.similaridade || 0) * 100) }]
  }))

  textoParaLista(rubrica.criteriosEliminatorios).forEach((descricao) => {
    const evidencia = encontrarEvidenciaEliminatoria(descricao, textoCompleto)
    if (evidencia) alertas.push({ tipo: 'eliminatorio_evidenciado', descricao, resultado: 'requer_revisao', evidencia: sanitizarTextoCurriculo(evidencia) })
  })

  const criteriosAplicaveis = criterios.filter((criterio) => criterio.resultado !== 'nao_aplicavel' && criterio.peso > 0)
  const pesoTotal = criteriosAplicaveis.reduce((total, criterio) => total + criterio.peso, 0)
  const pontos = criteriosAplicaveis.reduce((total, criterio) => total + criterio.pontos, 0)
  const coberturaPonderada = criteriosAplicaveis.reduce((total, criterio) => total + criterio.peso * Number(criterio.cobertura || 0), 0)

  return {
    versao: ANALISE_VERSAO,
    nota: pesoTotal ? Math.round((pontos / pesoTotal) * 100) : 0,
    cobertura: pesoTotal ? Math.round((coberturaPonderada / pesoTotal) * 100) : 0,
    requerRevisao: alertas.length > 0 || discrepancias.length > 0,
    criterios,
    alertas,
    discrepancias,
    extracao: {
      metodo: extracao.metodo || 'formulario',
      paginas: Number(extracao.paginas || 0),
      caracteres: curriculoSanitizado.length,
      aviso: extracao.aviso || ''
    }
  }
}
