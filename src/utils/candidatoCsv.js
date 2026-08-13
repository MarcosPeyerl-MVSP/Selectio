export const MAX_CANDIDATOS_CSV = 200

export const CANDIDATO_CSV_COLUMNS = [
  { key: 'nome', label: 'nome', required: true, aliases: ['nome completo', 'candidato'] },
  { key: 'email', label: 'email', required: true, aliases: ['e-mail'] },
  { key: 'telefone', label: 'telefone', aliases: ['celular', 'whatsapp'] },
  { key: 'dataNascimento', label: 'dataNascimento', aliases: ['data de nascimento', 'nascimento'] },
  { key: 'genero', label: 'genero', aliases: ['gênero'] },
  { key: 'cargoAtual', label: 'cargoAtual', aliases: ['cargo atual', 'cargo'] },
  { key: 'anosExperiencia', label: 'anosExperiencia', aliases: ['anos de experiencia', 'anos de experiência', 'experiencia', 'experiência'] },
  { key: 'escolaridade', label: 'escolaridade', aliases: ['nivel de escolaridade', 'nível de escolaridade'] },
  { key: 'proficienciaIdiomas', label: 'proficienciaIdiomas', aliases: ['idiomas', 'proficiência em idiomas'] },
  { key: 'linkedin', label: 'linkedin', aliases: ['linkedin url', 'linkedin profile url'] },
  { key: 'portfolio', label: 'portfolio', aliases: ['portfólio', 'portfolio url', 'portfólio url'] },
  { key: 'github', label: 'github', aliases: ['github behance', 'github/behance', 'behance'] },
  { key: 'hardSkills', label: 'hardSkills', aliases: ['hard skills', 'competencias tecnicas', 'competências técnicas'] },
  { key: 'softSkills', label: 'softSkills', aliases: ['soft skills', 'competencias interpessoais', 'competências interpessoais'] },
  { key: 'expectativaSalarial', label: 'expectativaSalarial', aliases: ['expectativa salarial'] },
  { key: 'modeloTrabalho', label: 'modeloTrabalho', aliases: ['modelo de trabalho'] },
  { key: 'avisoPrevio', label: 'avisoPrevio', aliases: ['aviso previo', 'aviso prévio'] },
  { key: 'observacoesProfissionais', label: 'observacoesProfissionais', aliases: ['observacoes', 'observações', 'observacoes profissionais', 'observações profissionais'] },
]

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const normalizeHeader = (value) => String(value || '')
  .replace(/^\uFEFF/, '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '')
  .toLowerCase()

const headerKeyMap = new Map(
  CANDIDATO_CSV_COLUMNS.flatMap((column) => (
    [column.label, column.key, ...(column.aliases || [])]
      .map((alias) => [normalizeHeader(alias), column.key])
  ))
)

const escapeCsvValue = (value, delimiter = ';') => {
  const text = String(value ?? '')
  if (!text.includes(delimiter) && !/["\r\n]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

export const validarEmailCandidato = (value) => EMAIL_PATTERN.test(String(value || '').trim())

export const validarTelefoneCandidato = (value) => {
  const digits = String(value || '').replace(/\D/g, '')
  return !digits || digits.length === 10 || digits.length === 11
}

export function detectarDelimitadorCsv(text) {
  const source = String(text || '').replace(/^\uFEFF/, '')
  let commas = 0
  let semicolons = 0
  let quoted = false

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]

    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }

    if (!quoted && (char === '\r' || char === '\n')) break
    if (!quoted && char === ',') commas += 1
    if (!quoted && char === ';') semicolons += 1
  }

  return semicolons > commas ? ';' : ','
}

const defaultCsvMessages = {
  unclosedQuotes: ({ line }) => `Aspas não fechadas a partir da linha ${line}.`,
  empty: () => 'O arquivo CSV está vazio.',
  duplicateColumns: ({ columns }) => `Existem colunas duplicadas: ${columns}.`,
  requiredColumn: ({ column }) => `A coluna obrigatória "${column}" não foi encontrada.`,
  rowLimit: ({ count, max }) => `O arquivo possui ${count} registros. O limite é de ${max}.`,
  nameRequired: () => 'Nome completo é obrigatório.',
  emailRequired: () => 'E-mail é obrigatório.',
  emailInvalid: () => 'E-mail inválido.',
  phoneInvalid: () => 'Telefone deve conter 10 ou 11 dígitos.',
  columnCount: ({ rowCount, headerCount }) => `A linha possui ${rowCount} coluna(s), mas o cabeçalho possui ${headerCount}.`,
  duplicateEmail: ({ line }) => `E-mail duplicado no arquivo (primeira ocorrência na linha ${line}).`
}

const getCsvMessage = (translate, key, params = {}) => (
  typeof translate === 'function'
    ? translate(key, params)
    : defaultCsvMessages[key](params)
)

function parseRows(text, delimiter, translate) {
  const source = String(text || '').replace(/^\uFEFF/, '')
  const rows = []
  const syntaxErrors = []
  let row = []
  let field = ''
  let quoted = false
  let currentLine = 1
  let rowStartLine = 1

  const finishRow = () => {
    row.push(field)
    rows.push({ values: row, line: rowStartLine })
    row = []
    field = ''
    rowStartLine = currentLine + 1
  }

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]

    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        field += char
        if (char === '\n') currentLine += 1
      }
      continue
    }

    if (char === '"' && field === '') {
      quoted = true
    } else if (char === delimiter) {
      row.push(field)
      field = ''
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && source[index + 1] === '\n') index += 1
      finishRow()
      currentLine += 1
    } else {
      field += char
    }
  }

  if (quoted) {
    syntaxErrors.push(getCsvMessage(translate, 'unclosedQuotes', { line: rowStartLine }))
  }

  if (field !== '' || row.length > 0) finishRow()

  return { rows, syntaxErrors }
}

const isBlankRow = (row) => row.values.every((value) => !String(value || '').trim())

const normalizeSkills = (value) => [...new Set(
  String(value || '')
    .split('|')
    .map((skill) => skill.trim())
    .filter(Boolean)
)]

const normalizeCandidate = (data) => ({
  ...data,
  nome: String(data.nome || '').trim(),
  email: String(data.email || '').trim().toLowerCase(),
  telefone: String(data.telefone || '').trim(),
  hardSkills: normalizeSkills(data.hardSkills),
  softSkills: normalizeSkills(data.softSkills),
})

const validateCandidate = (candidate, translate) => {
  const errors = []

  if (!candidate.nome) errors.push(getCsvMessage(translate, 'nameRequired'))
  if (!candidate.email) {
    errors.push(getCsvMessage(translate, 'emailRequired'))
  } else if (!validarEmailCandidato(candidate.email)) {
    errors.push(getCsvMessage(translate, 'emailInvalid'))
  }

  if (!validarTelefoneCandidato(candidate.telefone)) {
    errors.push(getCsvMessage(translate, 'phoneInvalid'))
  }

  return errors
}

export function processarCandidatosCsv(text, options = {}) {
  const maxRows = options.maxRows || MAX_CANDIDATOS_CSV
  const { translate } = options
  const source = String(text || '')
  const delimiter = detectarDelimitadorCsv(source)
  const { rows, syntaxErrors } = parseRows(source, delimiter, translate)
  const nonBlankRows = rows.filter((row) => !isBlankRow(row))
  const generalErrors = [...syntaxErrors]

  if (!nonBlankRows.length) {
    return {
      delimitador: delimiter,
      cabecalhos: [],
      linhas: [],
      validos: [],
      invalidos: [],
      totalRegistros: 0,
      errosGerais: [getCsvMessage(translate, 'empty')],
    }
  }

  const headerRow = nonBlankRows[0]
  const rawHeaders = headerRow.values.map((value) => String(value || '').trim())
  const mappedHeaders = rawHeaders.map((header) => headerKeyMap.get(normalizeHeader(header)) || null)
  const duplicateHeaders = mappedHeaders.filter((key, index) => key && mappedHeaders.indexOf(key) !== index)

  if (duplicateHeaders.length) {
    generalErrors.push(getCsvMessage(translate, 'duplicateColumns', {
      columns: [...new Set(duplicateHeaders)].join(', ')
    }))
  }

  CANDIDATO_CSV_COLUMNS.filter((column) => column.required).forEach((column) => {
    if (!mappedHeaders.includes(column.key)) {
      generalErrors.push(getCsvMessage(translate, 'requiredColumn', { column: column.label }))
    }
  })

  const dataRows = nonBlankRows.slice(1)
  if (dataRows.length > maxRows) {
    generalErrors.push(getCsvMessage(translate, 'rowLimit', { count: dataRows.length, max: maxRows }))
  }

  const seenEmails = new Map()
  const processedRows = dataRows.slice(0, maxRows).map((csvRow) => {
    const rawData = {}
    mappedHeaders.forEach((key, index) => {
      if (key && !(key in rawData)) rawData[key] = csvRow.values[index] || ''
    })

    const candidate = normalizeCandidate(rawData)
    const errors = validateCandidate(candidate, translate)

    if (csvRow.values.length !== rawHeaders.length) {
      errors.push(getCsvMessage(translate, 'columnCount', {
        rowCount: csvRow.values.length,
        headerCount: rawHeaders.length
      }))
    }

    if (candidate.email) {
      const previousLine = seenEmails.get(candidate.email)
      if (previousLine) {
        errors.push(getCsvMessage(translate, 'duplicateEmail', { line: previousLine }))
      } else {
        seenEmails.set(candidate.email, csvRow.line)
      }
    }

    return {
      linha: csvRow.line,
      dados: candidate,
      valido: errors.length === 0,
      erros: errors,
    }
  })

  return {
    delimitador: delimiter,
    cabecalhos: rawHeaders,
    linhas: processedRows,
    validos: processedRows.filter((row) => row.valido),
    invalidos: processedRows.filter((row) => !row.valido),
    totalRegistros: dataRows.length,
    errosGerais: generalErrors,
  }
}

export function gerarModeloCandidatosCsv(delimiter = ';') {
  const headers = CANDIDATO_CSV_COLUMNS.map((column) => column.label)
  const example = {
    nome: 'João da Silva',
    email: 'joao.silva@exemplo.com',
    telefone: '(11) 98765-4321',
    dataNascimento: '1990-05-20',
    genero: 'Masculino',
    cargoAtual: 'Desenvolvedor Front-end',
    anosExperiencia: '5',
    escolaridade: 'Superior',
    proficienciaIdiomas: 'Inglês (Avançado)',
    linkedin: 'https://linkedin.com/in/joaosilva',
    portfolio: 'https://joaosilva.dev',
    github: 'https://github.com/joaosilva',
    hardSkills: 'React|JavaScript|CSS',
    softSkills: 'Comunicação|Trabalho em equipe',
    expectativaSalarial: 'R$ 8.000',
    modeloTrabalho: 'Remoto',
    avisoPrevio: '30 dias',
    observacoesProfissionais: 'Disponível para entrevistas no período da tarde.',
  }

  return [
    headers.map((value) => escapeCsvValue(value, delimiter)).join(delimiter),
    headers.map((key) => escapeCsvValue(example[key], delimiter)).join(delimiter),
  ].join('\r\n')
}
