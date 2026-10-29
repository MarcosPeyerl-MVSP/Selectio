const chaveTexto = (texto) => texto.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase()

const unicosPorChave = (itens, chave) => {
  const vistos = new Set()
  return itens.filter((item) => {
    const valor = chave(item)
    if (vistos.has(valor)) return false
    vistos.add(valor)
    return true
  })
}

export const deduplicarEvidencias = (evidencias = []) => unicosPorChave(
  evidencias.filter((texto) => typeof texto === 'string' && texto.trim()),
  chaveTexto
)

// Apenas apresentação: os detalhes originais continuam disponíveis para cálculo e auditoria.
export const prepararCriterioParaExibicao = (criterio) => ({
  ...criterio,
  detalhes: unicosPorChave(
    (criterio.detalhes || []).filter((item) => item.descricao?.trim()),
    (item) => JSON.stringify([chaveTexto(item.descricao), item.resultado, item.fonte])
  ),
  evidencias: deduplicarEvidencias(criterio.evidencias)
})
