import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore'

import { db } from './firebase'

const candidatosPreSalvosCollection = collection(db, 'candidatosPreSalvos')
const MAX_WRITES_POR_BATCH = 400
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CURRICULO_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'rtf'])
const CURRICULO_MAX_BYTES = 10 * 1024 * 1024

const CAMPOS_TEXTO = [
  'nome',
  'email',
  'telefone',
  'dataNascimento',
  'genero',
  'cargoAtual',
  'anosExperiencia',
  'escolaridade',
  'proficienciaIdiomas',
  'linkedin',
  'portfolio',
  'github',
  'pontosFortes',
  'fitCultural',
  'destaquesProjetos',
  'narrativa',
  'observacoesProfissionais',
  'expectativaSalarial',
  'modeloTrabalho',
  'avisoPrevio',
  'curriculoNome'
]

const timestampToValue = (value) => {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate().toISOString()
  return value
}

const normalizeString = (value) => String(value ?? '').trim()

export const normalizarEmailCandidato = (value) => normalizeString(value).toLowerCase()

const normalizeList = (value) => {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[;|]/)
      : []

  return [...new Set(values.map(normalizeString).filter(Boolean))]
}

const normalizeCurriculo = (dados) => {
  const curriculoInformado = dados?.curriculo
  const curriculo = curriculoInformado
    && typeof curriculoInformado === 'object'
    && !Array.isArray(curriculoInformado)
    ? curriculoInformado
    : {}
  const hasFlatMetadata = [
    'curriculoNome',
    'curriculoTipo',
    'curriculoTamanho'
  ].some((campo) => Object.prototype.hasOwnProperty.call(dados || {}, campo))
  const nome = normalizeString(
    hasFlatMetadata ? dados?.curriculoNome : curriculo.nome ?? curriculo.name
  )
  const tipo = normalizeString(
    hasFlatMetadata ? dados?.curriculoTipo : curriculo.tipo ?? curriculo.type
  )
  const tamanhoInformado = Number(
    hasFlatMetadata
      ? dados?.curriculoTamanho ?? 0
      : curriculo.tamanho ?? curriculo.size ?? 0
  )
  const caminho = normalizeString(curriculo.caminho ?? curriculo.path)
  const url = normalizeString(curriculo.url)

  if (!nome && !tipo && !tamanhoInformado && !caminho && !url) return {}

  return {
    nome,
    tipo,
    tamanho: Number.isFinite(tamanhoInformado) && tamanhoInformado >= 0
      ? tamanhoInformado
      : 0,
    caminho,
    url
  }
}

const normalizeCandidateData = (dados = {}) => {
  const source = dados && typeof dados === 'object' ? dados : {}
  const normalized = CAMPOS_TEXTO.reduce((resultado, campo) => ({
    ...resultado,
    [campo]: normalizeString(source[campo])
  }), {})
  const curriculo = normalizeCurriculo(source)

  normalized.nome = normalizeString(source.nome || source.nomeCompleto)
  normalized.email = normalizarEmailCandidato(source.email)
  normalized.emailNormalizado = normalized.email
  normalized.proficienciaIdiomas = normalizeString(
    source.proficienciaIdiomas || source.idiomas
  )
  normalized.observacoesProfissionais = normalizeString(
    source.observacoesProfissionais || source.observacoes
  )
  normalized.curriculoNome = normalizeString(
    source.curriculoNome || curriculo.nome
  )
  normalized.hardSkills = normalizeList(source.hardSkills)
  normalized.softSkills = normalizeList(source.softSkills)
  normalized.curriculo = curriculo

  return normalized
}

const validateCurriculo = (dados) => {
  const { curriculo, curriculoNome } = dados
  const nome = curriculo.nome || curriculoNome

  if (!nome) return

  const extensao = nome.includes('.') ? nome.split('.').pop().toLowerCase() : ''

  if (!CURRICULO_EXTENSIONS.has(extensao)) {
    throw new Error('O currículo deve estar em formato PDF, DOC, DOCX ou RTF.')
  }

  if (curriculo.tamanho > CURRICULO_MAX_BYTES) {
    throw new Error('O currículo deve ter no máximo 10 MB.')
  }
}

const validateCandidateData = (dados) => {
  if (!dados.nome) {
    throw new Error('Nome completo é obrigatório.')
  }

  if (!dados.email) {
    throw new Error('E-mail é obrigatório.')
  }

  if (!EMAIL_PATTERN.test(dados.email)) {
    throw new Error('Informe um e-mail válido.')
  }

  const telefone = dados.telefone.replace(/\D/g, '')
  if (telefone && !/^\d{10,11}$/.test(telefone)) {
    throw new Error('Informe um telefone válido com DDD.')
  }

  validateCurriculo(dados)
  return dados
}

const prepareCandidateData = (dados) => validateCandidateData(normalizeCandidateData(dados))

const getCurriculoFlatFields = (dados) => {
  const curriculo = dados?.curriculo && typeof dados.curriculo === 'object'
    ? dados.curriculo
    : {}

  return {
    curriculoNome: normalizeString(dados?.curriculoNome || curriculo.nome),
    curriculoTipo: normalizeString(curriculo.tipo),
    curriculoTamanho: Number(curriculo.tamanho || 0)
  }
}

const mapCandidatoPreSalvoDoc = (snapshot) => {
  if (!snapshot.exists()) return null

  const data = snapshot.data()
  const createdAt = timestampToValue(data.createdAt)
  const updatedAt = timestampToValue(data.updatedAt)

  const curriculo = data.curriculo && typeof data.curriculo === 'object'
    ? data.curriculo
    : {}

  return {
    ...data,
    id: snapshot.id,
    hardSkills: normalizeList(data.hardSkills),
    softSkills: normalizeList(data.softSkills),
    curriculo,
    ...getCurriculoFlatFields({ ...data, curriculo }),
    createdAt,
    updatedAt,
    criadoEm: createdAt,
    atualizadoEm: updatedAt
  }
}

const sortByUpdatedDesc = (a, b) => {
  const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime()
  const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime()
  return dateB - dateA
}

const assertIndicadorId = (indicadorId) => {
  if (!normalizeString(indicadorId)) {
    throw new Error('UID do indicador é obrigatório.')
  }
}

const buildCreatePayload = ({ id, indicadorId, dados, origem }) => ({
  id,
  indicadorId,
  indicadorUid: indicadorId,
  ...dados,
  origem,
  status: 'pre_salvo',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
})

const buildMappedCreatedCandidate = ({ id, indicadorId, dados, origem }) => {
  const now = new Date().toISOString()

  return {
    id,
    indicadorId,
    indicadorUid: indicadorId,
    ...dados,
    ...getCurriculoFlatFields(dados),
    origem,
    status: 'pre_salvo',
    createdAt: now,
    updatedAt: now,
    criadoEm: now,
    atualizadoEm: now
  }
}

const emailAlreadyExists = async ({ emailNormalizado, indicadorId, ignorarCandidatoId = '' }) => {
  const snapshot = await getDocs(query(
    candidatosPreSalvosCollection,
    where('indicadorId', '==', indicadorId),
    where('emailNormalizado', '==', emailNormalizado)
  ))

  return snapshot.docs.some((documento) => documento.id !== ignorarCandidatoId)
}

const duplicateEmailError = () => new Error('Já existe um candidato pré-salvo com este e-mail.')

export const listarCandidatosPreSalvos = async (indicadorId) => {
  assertIndicadorId(indicadorId)

  const snapshot = await getDocs(query(
    candidatosPreSalvosCollection,
    where('indicadorId', '==', indicadorId)
  ))

  return snapshot.docs
    .map(mapCandidatoPreSalvoDoc)
    .filter(Boolean)
    .sort(sortByUpdatedDesc)
}

export const buscarCandidatoPreSalvoPorId = async ({ candidatoId, indicadorId }) => {
  assertIndicadorId(indicadorId)

  if (!candidatoId) return null

  try {
    const snapshot = await getDoc(doc(candidatosPreSalvosCollection, candidatoId))
    const candidato = mapCandidatoPreSalvoDoc(snapshot)

    if (!candidato || candidato.indicadorId !== indicadorId) return null
    return candidato
  } catch (error) {
    // As regras negam por padrao tanto documentos alheios quanto inexistentes,
    // pois em ambos os casos nao ha um proprietario que possa ser comprovado.
    if (error?.code === 'permission-denied') return null
    throw error
  }
}

export const criarCandidatoPreSalvo = async ({ dados, indicadorId }) => {
  assertIndicadorId(indicadorId)

  const candidatoDados = prepareCandidateData(dados)
  if (await emailAlreadyExists({
    emailNormalizado: candidatoDados.emailNormalizado,
    indicadorId
  })) {
    throw duplicateEmailError()
  }

  const candidatoRef = doc(candidatosPreSalvosCollection)
  const payload = buildCreatePayload({
    id: candidatoRef.id,
    indicadorId,
    dados: candidatoDados,
    origem: 'manual'
  })
  const batch = writeBatch(db)

  batch.set(candidatoRef, payload)
  await batch.commit()

  return buildMappedCreatedCandidate({
    id: candidatoRef.id,
    indicadorId,
    dados: candidatoDados,
    origem: 'manual'
  })
}

export const atualizarCandidatoPreSalvo = async ({ candidatoId, dados, indicadorId }) => {
  assertIndicadorId(indicadorId)

  if (!candidatoId) {
    throw new Error('ID do candidato pré-salvo é obrigatório.')
  }

  const atual = await buscarCandidatoPreSalvoPorId({ candidatoId, indicadorId })
  if (!atual) {
    throw new Error('Candidato pré-salvo não encontrado.')
  }

  const atualParaMerge = { ...atual }
  const hasCurriculoObject = Object.prototype.hasOwnProperty.call(dados || {}, 'curriculo')
  const hasFlatCurriculo = [
    'curriculoNome',
    'curriculoTipo',
    'curriculoTamanho'
  ].some((campo) => Object.prototype.hasOwnProperty.call(dados || {}, campo))

  if (hasCurriculoObject && !hasFlatCurriculo) {
    delete atualParaMerge.curriculoNome
    delete atualParaMerge.curriculoTipo
    delete atualParaMerge.curriculoTamanho
  }

  const candidatoDados = prepareCandidateData({ ...atualParaMerge, ...dados })
  if (await emailAlreadyExists({
    emailNormalizado: candidatoDados.emailNormalizado,
    indicadorId,
    ignorarCandidatoId: candidatoId
  })) {
    throw duplicateEmailError()
  }

  await updateDoc(doc(db, 'candidatosPreSalvos', candidatoId), {
    ...candidatoDados,
    updatedAt: serverTimestamp()
  })

  const updatedAt = new Date().toISOString()
  return {
    ...atual,
    ...candidatoDados,
    ...getCurriculoFlatFields(candidatoDados),
    updatedAt,
    atualizadoEm: updatedAt
  }
}

export const excluirCandidatoPreSalvo = async ({ candidatoId, indicadorId }) => {
  assertIndicadorId(indicadorId)

  if (!candidatoId) {
    throw new Error('ID do candidato pré-salvo é obrigatório.')
  }

  const candidato = await buscarCandidatoPreSalvoPorId({ candidatoId, indicadorId })
  if (!candidato) {
    throw new Error('Candidato pré-salvo não encontrado.')
  }

  await deleteDoc(doc(db, 'candidatosPreSalvos', candidatoId))
  return candidato
}

const getCsvLine = (candidato, index) => {
  const linha = Number(candidato?.linha ?? candidato?._linha ?? index + 2)
  return Number.isInteger(linha) && linha > 0 ? linha : index + 2
}

export const importarCandidatosPreSalvos = async ({ candidatos, indicadorId }) => {
  assertIndicadorId(indicadorId)

  if (!Array.isArray(candidatos)) {
    throw new Error('A lista de candidatos para importação é inválida.')
  }

  const existentes = await listarCandidatosPreSalvos(indicadorId)
  const emailsConhecidos = new Set(existentes.map((candidato) => candidato.emailNormalizado))
  const preparados = []
  const rejeitados = []

  candidatos.forEach((candidato, index) => {
    const linha = getCsvLine(candidato, index)
    const candidatoDadosEntrada = candidato?.dados
      && typeof candidato.dados === 'object'
      && !Array.isArray(candidato.dados)
      ? candidato.dados
      : candidato

    try {
      const candidatoDados = prepareCandidateData(candidatoDadosEntrada)

      if (emailsConhecidos.has(candidatoDados.emailNormalizado)) {
        rejeitados.push({
          linha,
          candidato: candidatoDadosEntrada,
          motivoKey: 'candidateRegistration.csv.duplicateExisting'
        })
        return
      }

      emailsConhecidos.add(candidatoDados.emailNormalizado)
      const candidatoRef = doc(candidatosPreSalvosCollection)
      preparados.push({
        candidato: candidatoDadosEntrada,
        candidatoDados,
        candidatoRef,
        linha
      })
    } catch {
      rejeitados.push({
        linha,
        candidato: candidatoDadosEntrada,
        motivoKey: 'candidateRegistration.csv.recordRejected'
      })
    }
  })

  const importados = []

  for (let inicio = 0; inicio < preparados.length; inicio += MAX_WRITES_POR_BATCH) {
    const grupo = preparados.slice(inicio, inicio + MAX_WRITES_POR_BATCH)
    const batch = writeBatch(db)

    grupo.forEach(({ candidatoDados, candidatoRef }) => {
      batch.set(candidatoRef, buildCreatePayload({
        id: candidatoRef.id,
        indicadorId,
        dados: candidatoDados,
        origem: 'csv'
      }))
    })

    try {
      await batch.commit()
      grupo.forEach(({ candidatoDados, candidatoRef }) => {
        importados.push(buildMappedCreatedCandidate({
          id: candidatoRef.id,
          indicadorId,
          dados: candidatoDados,
          origem: 'csv'
        }))
      })
    } catch {
      grupo.forEach(({ candidato, linha }) => {
        rejeitados.push({
          linha,
          candidato,
          motivoKey: 'candidateRegistration.csv.recordRejected'
        })
      })
    }
  }

  return { importados, rejeitados }
}
