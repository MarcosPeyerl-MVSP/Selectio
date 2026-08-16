import {
  deleteObject,
  getBlob,
  getBytes,
  ref,
  uploadBytes
} from 'firebase/storage'

import { storage } from './firebase'

export const CURRICULO_MAX_BYTES = 10 * 1024 * 1024
export const CURRICULO_EXTENSOES = new Set(['pdf', 'doc', 'docx'])
export const CURRICULO_TIPOS = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
])

const TIPO_POR_EXTENSAO = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
}

const normalizeString = (value) => String(value ?? '').trim()

const limitarTempo = (promise, timeoutMs, mensagem) => new Promise((resolve, reject) => {
  const timeoutId = window.setTimeout(() => reject(new Error(mensagem)), timeoutMs)
  promise.then(
    (resultado) => {
      window.clearTimeout(timeoutId)
      resolve(resultado)
    },
    (error) => {
      window.clearTimeout(timeoutId)
      reject(error)
    }
  )
})

const extensaoDoArquivo = (nome) => {
  const partes = normalizeString(nome).toLowerCase().split('.')
  return partes.length > 1 ? partes.pop() : ''
}

export const validarArquivoCurriculo = (arquivo) => {
  if (!arquivo) throw new Error('Selecione um curriculo para enviar.')

  const extensao = extensaoDoArquivo(arquivo.name)
  const tipoInformado = normalizeString(arquivo.type).toLowerCase()
  const tipo = !tipoInformado || tipoInformado === 'application/octet-stream'
    ? TIPO_POR_EXTENSAO[extensao] || ''
    : tipoInformado

  if (!CURRICULO_EXTENSOES.has(extensao) || !CURRICULO_TIPOS.has(tipo)) {
    throw new Error('O curriculo deve estar em formato PDF, DOC ou DOCX.')
  }

  if (!arquivo.size || arquivo.size > CURRICULO_MAX_BYTES) {
    throw new Error('O curriculo deve ter no maximo 10 MB.')
  }

  return { extensao, tipo }
}

const novoArquivoId = () => (
  globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
)

const caminhoCurriculo = ({ indicadorId, registroId, tipoRegistro, extensao }) => {
  if (!indicadorId || !registroId || !['pre-salvos', 'candidatos'].includes(tipoRegistro)) {
    throw new Error('Nao foi possivel identificar o proprietario do curriculo.')
  }

  return `curriculos/${indicadorId}/${tipoRegistro}/${registroId}/${novoArquivoId()}.${extensao}`
}

export const enviarCurriculo = async ({ arquivo, indicadorId, registroId, tipoRegistro, empresaId = '' }) => {
  const { extensao, tipo } = validarArquivoCurriculo(arquivo)
  const caminho = caminhoCurriculo({ indicadorId, registroId, tipoRegistro, extensao })

  await uploadBytes(ref(storage, caminho), arquivo, {
    contentType: tipo,
    customMetadata: {
      indicadorId,
      registroId,
      tipoRegistro,
      nomeOriginal: arquivo.name,
      ...(tipoRegistro === 'candidatos' ? { empresaId } : {})
    }
  })

  return {
    caminho,
    nome: arquivo.name,
    tamanho: arquivo.size,
    tipo,
    status: 'disponivel'
  }
}

export const copiarCurriculoParaCandidato = async ({ curriculo, indicadorId, candidatoId, empresaId }) => {
  if (!curriculo?.caminho) return null

  const extensao = extensaoDoArquivo(curriculo.nome || curriculo.caminho)
  const tipo = TIPO_POR_EXTENSAO[extensao]
  if (!CURRICULO_EXTENSOES.has(extensao) || !tipo) return null

  const bytes = await limitarTempo(
    getBytes(ref(storage, curriculo.caminho), CURRICULO_MAX_BYTES),
    45_000,
    'O download do curriculo demorou demais. Tente novamente.'
  )
  const caminho = caminhoCurriculo({
    indicadorId,
    registroId: candidatoId,
    tipoRegistro: 'candidatos',
    extensao
  })

  await uploadBytes(ref(storage, caminho), bytes, {
    contentType: tipo,
    customMetadata: {
      indicadorId,
      registroId: candidatoId,
      tipoRegistro: 'candidatos',
      empresaId,
      nomeOriginal: curriculo.nome || `curriculo.${extensao}`
    }
  })

  return {
    caminho,
    nome: curriculo.nome || `curriculo.${extensao}`,
    tamanho: bytes.byteLength,
    tipo,
    status: 'disponivel'
  }
}

export const removerArquivoCurriculo = async (caminho) => {
  if (!caminho) return

  try {
    await deleteObject(ref(storage, caminho))
  } catch (error) {
    if (error?.code !== 'storage/object-not-found') throw error
  }
}

export const baixarCurriculoProtegido = async (curriculo) => {
  if (!curriculo?.caminho || curriculo.status !== 'disponivel') {
    throw new Error('Este curriculo antigo ainda precisa ser reenviado.')
  }

  const blob = await getBlob(ref(storage, curriculo.caminho), CURRICULO_MAX_BYTES)
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = curriculo.nome || 'curriculo'
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000)
}
