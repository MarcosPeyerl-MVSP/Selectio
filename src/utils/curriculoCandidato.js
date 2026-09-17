const TIPOS_POR_EXTENSAO = Object.freeze({
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
})

const normalizarTexto = (valor) => String(valor ?? '').trim()

const primeiroTexto = (...valores) => {
  const valor = valores.map(normalizarTexto).find(Boolean)
  return valor || ''
}

const extensaoDoNome = (nome) => {
  const partes = normalizarTexto(nome).toLowerCase().split('.')
  return partes.length > 1 ? partes.pop() : ''
}

const primeiroTamanhoValido = (...valores) => {
  const tamanho = valores
    .map(Number)
    .find((valor) => Number.isFinite(valor) && valor > 0)

  return tamanho || 0
}

export const normalizarMetadadosCurriculo = (dados = {}) => {
  const informado = dados?.curriculo
  const curriculo = informado && typeof informado === 'object' && !Array.isArray(informado)
    ? informado
    : {}
  const caminho = primeiroTexto(curriculo.caminho, curriculo.path)
  const nomeInformado = primeiroTexto(
    curriculo.nome,
    curriculo.nomeArquivo,
    curriculo.name,
    dados?.curriculoNome
  )
  const extensao = extensaoDoNome(nomeInformado) || extensaoDoNome(caminho)
  const nome = nomeInformado || (caminho && extensao ? `curriculo.${extensao}` : '')
  const tipo = primeiroTexto(
    curriculo.tipo,
    curriculo.contentType,
    curriculo.type,
    dados?.curriculoTipo,
    TIPOS_POR_EXTENSAO[extensao]
  )
  const tamanho = primeiroTamanhoValido(
    curriculo.tamanho,
    curriculo.size,
    dados?.curriculoTamanho
  )
  const statusInformado = primeiroTexto(curriculo.status)

  if (!nome && !tipo && !tamanho && !caminho) return {}

  return {
    nome,
    tipo,
    tamanho,
    caminho,
    status: caminho ? 'disponivel' : statusInformado || 'pendente_reenvio'
  }
}

export const metadadosPlanosCurriculo = (dados = {}) => {
  const curriculo = normalizarMetadadosCurriculo(dados)

  return {
    curriculoNome: curriculo.nome || '',
    curriculoTipo: curriculo.tipo || '',
    curriculoTamanho: Number(curriculo.tamanho || 0)
  }
}
