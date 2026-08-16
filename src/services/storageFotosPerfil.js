import {
  deleteObject,
  getBlob,
  getBytes,
  ref,
  uploadBytes
} from 'firebase/storage'

import { storage } from './firebase'

export const FOTO_PERFIL_MAX_BYTES = 5 * 1024 * 1024
export const FOTO_PERFIL_TIPOS = new Set(['image/jpeg', 'image/png', 'image/webp'])

const EXTENSAO_POR_TIPO = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
}

const novoArquivoId = () => (
  globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
)

export const validarFotoPerfil = (arquivo) => {
  if (!arquivo) throw new Error('Selecione uma imagem.')
  const tipo = String(arquivo.type || '').toLowerCase()

  if (!FOTO_PERFIL_TIPOS.has(tipo)) {
    throw new Error('A foto deve estar em formato JPG, PNG ou WEBP.')
  }
  if (!arquivo.size || arquivo.size > FOTO_PERFIL_MAX_BYTES) {
    throw new Error('A foto deve ter no maximo 5 MB.')
  }

  return { tipo, extensao: EXTENSAO_POR_TIPO[tipo] }
}

const enviar = async ({ arquivo, caminho, metadata }) => {
  const { tipo } = validarFotoPerfil(arquivo)
  await uploadBytes(ref(storage, caminho), arquivo, {
    contentType: tipo,
    cacheControl: 'private,max-age=3600',
    customMetadata: metadata
  })

  return {
    caminho,
    nome: arquivo.name,
    tamanho: arquivo.size,
    tipo,
    status: 'disponivel'
  }
}

export const enviarFotoPerfilUsuario = async ({ arquivo, uid, tipoPerfil }) => {
  const { extensao } = validarFotoPerfil(arquivo)
  return enviar({
    arquivo,
    caminho: `fotos-perfil/usuarios/${uid}/${novoArquivoId()}.${extensao}`,
    metadata: { uid, tipoRegistro: 'usuario', tipoPerfil }
  })
}

export const enviarFotoCandidato = async ({
  arquivo,
  indicadorId,
  candidatoId,
  tipoRegistro,
  empresaId = ''
}) => {
  const { extensao } = validarFotoPerfil(arquivo)
  return enviar({
    arquivo,
    caminho: `fotos-perfil/candidatos/${indicadorId}/${tipoRegistro}/${candidatoId}/${novoArquivoId()}.${extensao}`,
    metadata: {
      indicadorId,
      candidatoId,
      tipoRegistro,
      ...(tipoRegistro === 'indicados' ? { empresaId } : {})
    }
  })
}

export const copiarFotoParaCandidatoIndicado = async ({ foto, indicadorId, candidatoId, empresaId }) => {
  if (!foto?.caminho) return null
  const tipo = String(foto.tipo || '').toLowerCase()
  const extensao = EXTENSAO_POR_TIPO[tipo]
  if (!extensao) return null

  const bytes = await getBytes(ref(storage, foto.caminho), FOTO_PERFIL_MAX_BYTES)
  const arquivo = new File([bytes], foto.nome || `foto.${extensao}`, { type: tipo })
  return enviarFotoCandidato({
    arquivo,
    indicadorId,
    candidatoId,
    tipoRegistro: 'indicados',
    empresaId
  })
}

export const removerFotoPerfil = async (caminho) => {
  if (!caminho) return
  try {
    await deleteObject(ref(storage, caminho))
  } catch (error) {
    if (error?.code !== 'storage/object-not-found') throw error
  }
}

export const baixarBlobFotoPerfil = (foto) => {
  if (!foto?.caminho || foto.status !== 'disponivel') return Promise.resolve(null)
  return getBlob(ref(storage, foto.caminho), FOTO_PERFIL_MAX_BYTES)
}
