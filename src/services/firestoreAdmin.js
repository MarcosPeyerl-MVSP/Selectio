import {
  collection,
  getDocs,
  limit,
  query,
} from 'firebase/firestore'

import { db } from './firebase'

const MAX_ADMIN_DOCUMENTS = 500
const paymentPendingStatuses = new Set(['created', 'pending', 'in_process', 'authorized'])
const paymentClosedStatuses = new Set(['approved', 'rejected', 'cancelled', 'refunded', 'failed'])
const withdrawalPendingStatuses = new Set(['solicitado', 'pendente', 'em_analise'])

export async function buscarVisaoGeralAdmin() {
  const [
    empresas,
    indicadores,
    vagas,
    candidatos,
    pagamentos,
    saques,
  ] = await Promise.all([
    buscarColecao('empresas'),
    buscarColecao('indicadores'),
    buscarColecao('vagas'),
    buscarColecao('candidatos'),
    buscarColecao('pagamentos'),
    buscarColecao('saques'),
  ])

  const empresasAtivas = empresas.filter((empresa) => normalizarStatusPerfil(empresa) === 'ativo')
  const vagasAbertas = vagas.filter((vaga) => normalizarStatusVaga(vaga) === 'aberta')
  const contratacoes = candidatos.filter((candidato) => candidato.status === 'contratado')
  const pagamentosAprovados = pagamentos.filter((pagamento) => pagamento.status === 'approved')
  const pagamentosPorCandidato = criarMapaMaisRecente(pagamentos, 'candidatoId')
  const recompensasSemPagamento = contratacoes.filter((candidato) => (
    pagamentosPorCandidato.get(candidato.id)?.status !== 'approved'
  ))
  const saquesPendentes = saques.filter((saque) => withdrawalPendingStatuses.has(saque.status))

  return {
    metricas: {
      empresasAtivas: empresasAtivas.length,
      indicadoresTotais: indicadores.length,
      vagasAbertas: vagasAbertas.length,
      contratacoes: contratacoes.length,
      payoutGlobal: somarValores(pagamentosAprovados),
    },
    grafico: montarSaudeEcossistema({
      empresas,
      indicadores,
      vagas,
      candidatos,
    }),
    atividade: montarAtividadeRecente({
      empresas,
      indicadores,
      vagas,
      candidatos,
      pagamentos,
    }),
    pendencias: montarPendencias({
      saquesPendentes,
      recompensasSemPagamento,
      vagas,
    }),
  }
}

export async function buscarEmpresasAdmin() {
  const [empresas, users, vagas, candidatos] = await Promise.all([
    buscarColecao('empresas'),
    buscarColecao('users'),
    buscarColecao('vagas'),
    buscarColecao('candidatos'),
  ])
  const usersById = new Map(users.map((user) => [user.id, user]))
  const vagasByEmpresa = contarPorCampo(vagas, 'empresaId')
  const candidatosByEmpresa = contarPorCampo(candidatos, 'empresaId')
  const empresasEnriquecidas = empresas
    .map((empresa) => {
      const user = usersById.get(empresa.id) || {}

      return {
        ...user,
        ...empresa,
        id: empresa.id,
        nome: empresa.nomeEmpresa || empresa.nome || user.nome || 'Empresa',
        email: empresa.email || user.email || '',
        statusAdmin: normalizarStatusPerfil(empresa),
        totalVagas: vagasByEmpresa.get(empresa.id) || 0,
        totalCandidatos: candidatosByEmpresa.get(empresa.id) || 0,
        dataCadastro: empresa.criadoEm || user.criadoEm || empresa.atualizadoEm || user.atualizadoEm || null,
      }
    })
    .sort(ordenarMaisRecentes)

  return {
    empresas: empresasEnriquecidas,
    metricas: {
      total: empresasEnriquecidas.length,
      ativas: empresasEnriquecidas.filter((empresa) => empresa.statusAdmin === 'ativo').length,
      novasNoMes: empresasEnriquecidas.filter((empresa) => estaNoMesAtual(empresa.dataCadastro)).length,
      vagasPublicadas: vagas.length,
    },
  }
}

export async function buscarIndicadoresAdmin() {
  const [
    indicadores,
    users,
    candidatos,
    saldos,
    pagamentos,
  ] = await Promise.all([
    buscarColecao('indicadores'),
    buscarColecao('users'),
    buscarColecao('candidatos'),
    buscarColecao('indicadorSaldos'),
    buscarColecao('pagamentos'),
  ])
  const usersById = new Map(users.map((user) => [user.id, user]))
  const saldosById = new Map(saldos.map((saldo) => [saldo.indicadorId || saldo.id, saldo]))
  const candidatosByIndicador = agruparPorCampo(candidatos, 'indicadorId')
  const pagamentosByIndicador = agruparPorCampo(
    pagamentos.filter((pagamento) => pagamento.status === 'approved'),
    'indicadorId',
  )
  const indicadoresEnriquecidos = indicadores
    .map((indicador) => {
      const user = usersById.get(indicador.id) || {}
      const candidatosIndicador = candidatosByIndicador.get(indicador.id) || []
      const pagamentosIndicador = pagamentosByIndicador.get(indicador.id) || []
      const saldo = saldosById.get(indicador.id) || {}

      return {
        ...user,
        ...indicador,
        id: indicador.id,
        nome: indicador.nome || user.nome || 'Indicador',
        email: indicador.email || user.email || '',
        statusAdmin: normalizarStatusPerfil(indicador),
        totalIndicacoes: candidatosIndicador.length,
        totalContratacoes: candidatosIndicador.filter((candidato) => candidato.status === 'contratado').length,
        ganhos: somarValores(pagamentosIndicador),
        saldoDisponivel: Number(saldo.saldoDisponivel || 0),
        saldoPendente: Number(saldo.saldoPendente || 0),
        dataCadastro: indicador.criadoEm || user.criadoEm || indicador.atualizadoEm || user.atualizadoEm || null,
        ultimasIndicacoes: candidatosIndicador.sort(ordenarMaisRecentes).slice(0, 4),
      }
    })
    .sort(ordenarMaisRecentes)

  return {
    indicadores: indicadoresEnriquecidos,
    metricas: {
      total: indicadoresEnriquecidos.length,
      ativos: indicadoresEnriquecidos.filter((indicador) => indicador.statusAdmin === 'ativo').length,
      indicacoes: candidatos.length,
      contratacoes: candidatos.filter((candidato) => candidato.status === 'contratado').length,
      premiacoes: somarValores(pagamentos.filter((pagamento) => pagamento.status === 'approved')),
    },
  }
}

export async function buscarVagasAdmin() {
  const [vagas, candidatos] = await Promise.all([
    buscarColecao('vagas'),
    buscarColecao('candidatos'),
  ])
  const candidatosByVaga = contarPorCampo(candidatos, 'vagaId')
  const vagasEnriquecidas = vagas
    .map((vaga) => ({
      ...vaga,
      statusAdmin: normalizarStatusVaga(vaga),
      totalCandidatos: candidatosByVaga.get(vaga.id) || 0,
      dataPublicacao: vaga.criadoEm || vaga.atualizadoEm || null,
    }))
    .sort(ordenarMaisRecentes)
  const contratados = candidatos.filter((candidato) => candidato.status === 'contratado').length

  return {
    vagas: vagasEnriquecidas,
    metricas: {
      total: vagasEnriquecidas.length,
      abertas: vagasEnriquecidas.filter((vaga) => vaga.statusAdmin === 'aberta').length,
      revisao: vagasEnriquecidas.filter((vaga) => vaga.statusAdmin === 'pausada').length,
      candidatos: candidatos.length,
      conversao: candidatos.length ? Number(((contratados * 100) / candidatos.length).toFixed(1)) : 0,
    },
  }
}

export async function buscarCandidatosAdmin() {
  const [candidatos, indicadores, vagas] = await Promise.all([
    buscarColecao('candidatos'),
    buscarColecao('indicadores'),
    buscarColecao('vagas'),
  ])
  const indicadoresById = new Map(indicadores.map((indicador) => [indicador.id, indicador]))
  const vagasById = new Map(vagas.map((vaga) => [vaga.id, vaga]))
  const candidatosEnriquecidos = candidatos
    .map((candidato) => {
      const indicador = indicadoresById.get(candidato.indicadorId) || {}
      const vaga = vagasById.get(candidato.vagaId) || {}

      return {
        ...candidato,
        nome: candidato.nome || candidato.candidatoNome || 'Candidato',
        vagaTitulo: candidato.vagaTitulo || vaga.titulo || 'Vaga não informada',
        vagaEmpresa: candidato.vagaEmpresa || vaga.empresa || vaga.empresaNome || '',
        indicadorNome: candidato.indicadorNome || indicador.nome || 'Indicador não informado',
        dataIndicacao: candidato.aplicadoEm || candidato.criadoEm || null,
      }
    })
    .sort(ordenarMaisRecentes)
  const contratados = candidatosEnriquecidos.filter((candidato) => candidato.status === 'contratado')
  const agora = new Date()
  const seteDiasAtras = new Date(agora.getTime() - 7 * 86_400_000)

  return {
    candidatos: candidatosEnriquecidos,
    geradoEm: new Date().toISOString(),
    vagas: [...new Set(candidatosEnriquecidos.map((candidato) => candidato.vagaTitulo).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR')),
    metricas: {
      conversao: candidatosEnriquecidos.length
        ? Number(((contratados.length * 100) / candidatosEnriquecidos.length).toFixed(1))
        : 0,
      entrevistas: candidatosEnriquecidos.filter((candidato) => candidato.status === 'entrevista').length,
      contratados: contratados.length,
      novos: candidatosEnriquecidos.filter((candidato) => {
        const data = toDate(candidato.dataIndicacao)
        return data && data >= seteDiasAtras
      }).length,
    },
  }
}

export async function buscarFinanceiroAdmin() {
  const [
    saques,
    pagamentos,
    indicadores,
    saldos,
    movimentacoes,
  ] = await Promise.all([
    buscarColecao('saques'),
    buscarColecao('pagamentos'),
    buscarColecao('indicadores'),
    buscarColecao('indicadorSaldos'),
    buscarColecao('movimentacoesFinanceiras'),
  ])
  const indicadoresById = new Map(indicadores.map((indicador) => [indicador.id, indicador]))
  const saquesEnriquecidos = saques
    .map((saque) => {
      const indicador = indicadoresById.get(saque.indicadorId) || {}

      return {
        ...saque,
        indicadorNome: saque.indicadorNome || indicador.nome || 'Indicador',
        indicadorEmail: indicador.email || '',
        dataSolicitacao: saque.solicitadoEm || saque.criadoEm || saque.atualizadoEm || null,
      }
    })
    .sort(ordenarMaisRecentes)
  const pagamentosAprovados = pagamentos.filter((pagamento) => pagamento.status === 'approved')
  const pagamentosEncerrados = pagamentos.filter((pagamento) => paymentClosedStatuses.has(pagamento.status))
  const pagamentosMes = pagamentosAprovados.filter((pagamento) => (
    estaNoMesAtual(pagamento.aprovadoEm || pagamento.encerradoEm || pagamento.atualizadoEm)
  ))

  return {
    saques: saquesEnriquecidos,
    pagamentos: pagamentos.sort(ordenarMaisRecentes).slice(0, 12),
    saldos,
    movimentacoes,
    metricas: {
      totalEmAberto: somarValores(
        saquesEnriquecidos.filter((saque) => withdrawalPendingStatuses.has(saque.status)),
      ),
      totalPagoMes: somarValores(pagamentosMes),
      pagamentosPendentes: pagamentos.filter((pagamento) => paymentPendingStatuses.has(pagamento.status)).length,
      eficiencia: pagamentosEncerrados.length
        ? Number(((pagamentosAprovados.length * 100) / pagamentosEncerrados.length).toFixed(1))
        : 0,
    },
  }
}

async function buscarColecao(nome) {
  const snapshot = await getDocs(query(
    collection(db, nome),
    limit(MAX_ADMIN_DOCUMENTS),
  ))

  return snapshot.docs.map((documento) => mapDocumento(documento))
}

function mapDocumento(documento) {
  const dados = documento.data()

  return Object.entries(dados).reduce((resultado, [chave, valor]) => ({
    ...resultado,
    [chave]: converterTimestamp(valor),
  }), { id: documento.id })
}

function converterTimestamp(valor) {
  if (valor && typeof valor.toDate === 'function') {
    return valor.toDate().toISOString()
  }

  if (Array.isArray(valor)) {
    return valor.map(converterTimestamp)
  }

  if (valor && typeof valor === 'object') {
    return Object.entries(valor).reduce((resultado, [chave, item]) => ({
      ...resultado,
      [chave]: converterTimestamp(item),
    }), {})
  }

  return valor
}

function montarSaudeEcossistema({ empresas, indicadores, vagas, candidatos }) {
  const hoje = new Date()
  const meses = Array.from({ length: 7 }, (_, index) => {
    const data = new Date(hoje.getFullYear(), hoje.getMonth() - (6 - index), 1)
    const chave = chaveMes(data)
    const label = data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase()

    return {
      chave,
      mes: label,
      empresas: 0,
      indicadores: 0,
      vagas: 0,
      candidatos: 0,
    }
  })
  const mesesByKey = new Map(meses.map((mes) => [mes.chave, mes]))

  adicionarContagemMensal(mesesByKey, empresas, 'empresas')
  adicionarContagemMensal(mesesByKey, indicadores, 'indicadores')
  adicionarContagemMensal(mesesByKey, vagas, 'vagas')
  adicionarContagemMensal(mesesByKey, candidatos, 'candidatos')

  return meses
}

function adicionarContagemMensal(mesesByKey, documentos, campo) {
  documentos.forEach((documento) => {
    const data = toDate(
      documento.criadoEm
      || documento.aplicadoEm
      || documento.solicitadoEm
      || documento.atualizadoEm,
    )
    if (!data) return

    const mes = mesesByKey.get(chaveMes(data))
    if (mes) mes[campo] += 1
  })
}

function montarAtividadeRecente({ empresas, indicadores, vagas, candidatos, pagamentos }) {
  return [
    ...empresas.map((empresa) => ({
      id: `empresa-${empresa.id}`,
      tipo: 'empresa',
      titulo: `${empresa.nomeEmpresa || empresa.nome || 'Nova empresa'} entrou na plataforma`,
      descricao: empresa.email || 'Cadastro de empresa',
      data: empresa.criadoEm || empresa.atualizadoEm,
    })),
    ...indicadores.map((indicador) => ({
      id: `indicador-${indicador.id}`,
      tipo: 'indicador',
      titulo: `${indicador.nome || 'Novo indicador'} entrou para a rede`,
      descricao: indicador.email || 'Cadastro de indicador',
      data: indicador.criadoEm || indicador.atualizadoEm,
    })),
    ...vagas.map((vaga) => ({
      id: `vaga-${vaga.id}`,
      tipo: 'vaga',
      titulo: `${vaga.empresa || vaga.empresaNome || 'Empresa'} publicou ${vaga.titulo || 'uma vaga'}`,
      descricao: normalizarStatusVaga(vaga),
      data: vaga.criadoEm || vaga.atualizadoEm,
    })),
    ...candidatos.map((candidato) => ({
      id: `candidato-${candidato.id}`,
      tipo: 'candidato',
      titulo: `${candidato.indicadorNome || 'Um indicador'} indicou ${candidato.nome || 'um candidato'}`,
      descricao: candidato.vagaTitulo || 'Indicação de candidato',
      data: candidato.aplicadoEm || candidato.criadoEm || candidato.atualizadoEm,
    })),
    ...pagamentos
      .filter((pagamento) => pagamento.status === 'approved')
      .map((pagamento) => ({
        id: `pagamento-${pagamento.id}`,
        tipo: 'pagamento',
        titulo: `Recompensa aprovada para ${pagamento.candidatoNome || 'candidato'}`,
        descricao: formatCurrency(pagamento.valor),
        data: pagamento.aprovadoEm || pagamento.encerradoEm || pagamento.atualizadoEm,
      })),
  ]
    .filter((atividade) => atividade.data)
    .sort((a, b) => dataMs(b.data) - dataMs(a.data))
    .slice(0, 8)
}

function montarPendencias({ saquesPendentes, recompensasSemPagamento, vagas }) {
  const vagasPausadas = vagas.filter((vaga) => normalizarStatusVaga(vaga) === 'pausada')

  return [
    ...saquesPendentes.map((saque) => ({
      id: `saque-${saque.id}`,
      tipo: 'financeiro',
      titulo: 'Solicitação de saque',
      descricao: `${saque.indicadorNome || 'Indicador'} aguarda análise de ${formatCurrency(saque.valor)}.`,
      link: '/admin/financeiro',
    })),
    ...recompensasSemPagamento.map((candidato) => ({
      id: `recompensa-${candidato.id}`,
      tipo: 'recompensa',
      titulo: 'Recompensa aguardando empresa',
      descricao: `${candidato.nome || 'Candidato'} foi contratado sem pagamento aprovado.`,
      link: '/admin/candidatos',
    })),
    ...vagasPausadas.map((vaga) => ({
      id: `vaga-${vaga.id}`,
      tipo: 'vaga',
      titulo: 'Vaga pausada',
      descricao: `${vaga.titulo || 'Vaga'} está fora da vitrine de oportunidades.`,
      link: '/admin/vagas',
    })),
  ].slice(0, 6)
}

function normalizarStatusPerfil(perfil) {
  const status = String(perfil.status || '').toLowerCase()

  if (perfil.ativo === false || perfil.bloqueado === true || ['inativo', 'bloqueado', 'suspenso'].includes(status)) {
    return status || 'inativo'
  }

  return status || 'ativo'
}

function normalizarStatusVaga(vaga) {
  const status = vaga.status || 'aberta'
  const dataLimite = vaga.expiraEm || vaga.dataLimite

  if (status === 'aberta' && dataLimite) {
    const expiraEm = toDate(
      typeof dataLimite === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dataLimite)
        ? `${dataLimite}T23:59:59`
        : dataLimite,
    )
    if (expiraEm && expiraEm.getTime() < Date.now()) return 'expirada'
  }

  return status
}

function criarMapaMaisRecente(documentos, campo) {
  const mapa = new Map()

  documentos.forEach((documento) => {
    const chave = documento[campo]
    if (!chave) return

    const atual = mapa.get(chave)
    if (!atual || ordenarMaisRecentes(documento, atual) < 0) {
      mapa.set(chave, documento)
    }
  })

  return mapa
}

function contarPorCampo(documentos, campo) {
  return documentos.reduce((mapa, documento) => {
    const chave = documento[campo]
    if (chave) mapa.set(chave, (mapa.get(chave) || 0) + 1)
    return mapa
  }, new Map())
}

function agruparPorCampo(documentos, campo) {
  return documentos.reduce((mapa, documento) => {
    const chave = documento[campo]
    if (!chave) return mapa

    mapa.set(chave, [...(mapa.get(chave) || []), documento])
    return mapa
  }, new Map())
}

function somarValores(documentos) {
  return documentos.reduce((total, documento) => total + Number(documento.valor || 0), 0)
}

function estaNoMesAtual(valor) {
  const data = toDate(valor)
  const hoje = new Date()

  return Boolean(data)
    && data.getFullYear() === hoje.getFullYear()
    && data.getMonth() === hoje.getMonth()
}

function ordenarMaisRecentes(a, b) {
  const dataA = a.dataCadastro || a.dataPublicacao || a.dataIndicacao || a.dataSolicitacao
    || a.aprovadoEm || a.solicitadoEm || a.aplicadoEm || a.criadoEm || a.atualizadoEm
  const dataB = b.dataCadastro || b.dataPublicacao || b.dataIndicacao || b.dataSolicitacao
    || b.aprovadoEm || b.solicitadoEm || b.aplicadoEm || b.criadoEm || b.atualizadoEm

  return dataMs(dataB) - dataMs(dataA)
}

function chaveMes(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
}

function toDate(valor) {
  if (!valor) return null
  const data = valor instanceof Date ? valor : new Date(valor)
  return Number.isNaN(data.getTime()) ? null : data
}

function dataMs(valor) {
  return toDate(valor)?.getTime() || 0
}

function formatCurrency(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}
