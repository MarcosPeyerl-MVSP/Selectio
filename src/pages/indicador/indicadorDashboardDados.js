const statusAtivos = new Set(['indicado', 'entrevista'])

export function montarResumoDashboard(
  {
    candidatos,
    pagamentos,
    movimentacoes,
    agora: agoraInformado = new Date(),
    locale: localeInformado = 'pt-BR'
  },
  agora = agoraInformado,
  locale = localeInformado
) {
  const totalIndicacoes = candidatos.length
  const totalContratacoes = candidatos.filter((candidato) => candidato.status === 'contratado').length
  const totalEntrevistas = candidatos.filter((candidato) => candidato.status === 'entrevista').length
  const totalAvancaram = totalEntrevistas + totalContratacoes
  const totalAtivas = candidatos.filter((candidato) => statusAtivos.has(candidato.status)).length
  const pagamentosAprovados = pagamentos.filter((pagamento) => pagamento.status === 'approved')
  const creditosFinanceiros = movimentacoes.filter((movimentacao) => movimentacao.tipo === 'credito_recompensa')
  const totalPagamentosAprovados = somarValores(pagamentosAprovados)
  const totalCreditosFinanceiros = somarValores(creditosFinanceiros)
  const totalPremios = totalPagamentosAprovados || totalCreditosFinanceiros
  const pagamentosPorCandidato = mapearPagamentosPorCandidato(pagamentos)
  const candidatosComPremioPendente = candidatos.filter((candidato) => {
    if (candidato.status !== 'contratado') return false

    const pagamento = pagamentosPorCandidato.get(candidato.id)
    return !pagamento || pagamento.status !== 'approved'
  })
  const valorPendente = candidatosComPremioPendente.reduce((total, candidato) => {
    const pagamento = pagamentosPorCandidato.get(candidato.id)
    const valor = pagamento?.valor || candidato.recompensaValor || candidato.recompensaValorFixo || 0
    return total + Number(valor || 0)
  }, 0)
  const fonteGrafico = creditosFinanceiros.length ? creditosFinanceiros : pagamentosAprovados
  const fonteGanhos = creditosFinanceiros.length ? 'movimentacoes' : 'pagamentos'
  const ganhosMensais = montarGanhosMensais(fonteGrafico, fonteGanhos, agora, locale)
  const datasCredito = fonteGrafico
    .map((item) => obterDataGanho(item, fonteGanhos))
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

  return {
    totalIndicacoes,
    totalContratacoes,
    totalEntrevistas,
    totalAvancaram,
    totalAtivas,
    totalPremios,
    premiosPendentes: candidatosComPremioPendente.length,
    valorPendente,
    taxaContratacao: calcularPercentual(totalContratacoes, totalIndicacoes),
    taxaEntrevista: calcularPercentual(totalAvancaram, totalIndicacoes),
    taxaEntrevistaContratacao: calcularPercentual(totalContratacoes, totalAvancaram),
    recentes: candidatos.slice(0, 5),
    ganhosMensais,
    totalPeriodoGrafico: ganhosMensais.reduce((total, item) => total + item.valor, 0),
    fonteGanhos,
    ultimoCredito: datasCredito[0] || null,
  }
}

function montarGanhosMensais(itens, fonte, agora, locale) {
  const hoje = new Date(agora)
  const meses = Array.from({ length: 6 }, (_, index) => {
    const data = new Date(hoje.getFullYear(), hoje.getMonth() - (5 - index), 1)
    const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
    const mes = data.toLocaleDateString(locale, { month: 'short' }).replace('.', '')
    const mesCompleto = data.toLocaleDateString(locale, { month: 'long', year: 'numeric' })

    return {
      chave,
      mes: mes.charAt(0).toUpperCase() + mes.slice(1),
      mesCompleto: mesCompleto.charAt(0).toUpperCase() + mesCompleto.slice(1),
      valor: 0,
    }
  })
  const mesesPorChave = new Map(meses.map((mes) => [mes.chave, mes]))

  itens.forEach((item) => {
    const dataValor = obterDataGanho(item, fonte)
    if (!dataValor) return

    const data = new Date(dataValor)
    if (Number.isNaN(data.getTime())) return

    const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
    const mes = mesesPorChave.get(chave)
    if (mes) mes.valor += Number(item.valor || 0)
  })

  return meses
}

function obterDataGanho(item, fonte) {
  if (fonte === 'movimentacoes') {
    return item.criadoEm || item.atualizadoEm || null
  }

  return item.aprovadoEm || item.encerradoEm || item.transacaoEm || item.atualizadoEm || item.criadoEm || null
}

function mapearPagamentosPorCandidato(pagamentos) {
  const mapa = new Map()

  pagamentos.forEach((pagamento) => {
    if (!pagamento.candidatoId) return

    const atual = mapa.get(pagamento.candidatoId)
    if (!atual || deveUsarPagamento(pagamento, atual)) {
      mapa.set(pagamento.candidatoId, pagamento)
    }
  })

  return mapa
}

function deveUsarPagamento(novo, atual) {
  if (novo.status === 'approved' && atual.status !== 'approved') return true
  if (atual.status === 'approved' && novo.status !== 'approved') return false

  return obterDataMs(novo) >= obterDataMs(atual)
}

function obterDataMs(item) {
  const valor = item.aprovadoEm
    || item.encerradoEm
    || item.transacaoEm
    || item.atualizadoEm
    || item.criadoEm
    || 0

  return new Date(valor).getTime() || 0
}

function somarValores(itens) {
  return itens.reduce((total, item) => total + Number(item.valor || 0), 0)
}

function calcularPercentual(parte, total) {
  if (!total) return 0
  return Number(((parte * 100) / total).toFixed(1))
}
