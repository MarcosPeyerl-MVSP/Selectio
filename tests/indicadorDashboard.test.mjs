import assert from 'node:assert/strict'
import test from 'node:test'

import { montarResumoDashboard, montarDesempenhoIndicacoes } from '../src/pages/indicador/indicadorDashboardDados.js'
import { recomendarVagas, vagaDisponivelParaRecomendacao, CONFIG_RECOMENDACOES } from '../src/services/recomendacoes/recomendacoesVagas.js'

const agora = new Date('2026-06-18T12:00:00.000Z')

test('dashboard sem dados retorna métricas zeradas e seis meses no gráfico', () => {
  const resumo = montarResumoDashboard({
    candidatos: [],
    pagamentos: [],
    movimentacoes: [],
    agora,
  })

  assert.equal(resumo.totalIndicacoes, 0)
  assert.equal(resumo.totalContratacoes, 0)
  assert.equal(resumo.totalPremios, 0)
  assert.equal(resumo.premiosPendentes, 0)
  assert.equal(resumo.ganhosMensais.length, 6)
})

test('dashboard calcula funil, ativos e recompensa pendente pelos candidatos', () => {
  const resumo = montarResumoDashboard({
    candidatos: [
      candidato('1', 'indicado'),
      candidato('2', 'entrevista'),
      candidato('3', 'contratado', { recompensaValor: 2500 }),
      candidato('4', 'recusado'),
    ],
    pagamentos: [],
    movimentacoes: [],
    agora,
  })

  assert.equal(resumo.totalIndicacoes, 4)
  assert.equal(resumo.totalAtivas, 2)
  assert.equal(resumo.totalEntrevistas, 1)
  assert.equal(resumo.totalContratacoes, 1)
  assert.equal(resumo.totalAvancaram, 2)
  assert.equal(resumo.taxaEntrevista, 50)
  assert.equal(resumo.taxaEntrevistaContratacao, 50)
  assert.equal(resumo.premiosPendentes, 1)
  assert.equal(resumo.valorPendente, 2500)
})

test('pagamento aprovado alimenta total de prêmios e gráfico mensal', () => {
  const resumo = montarResumoDashboard({
    candidatos: [candidato('1', 'contratado')],
    pagamentos: [{
      id: 'pagamento-1',
      candidatoId: '1',
      status: 'approved',
      valor: 3200,
      aprovadoEm: '2026-06-10T12:00:00.000Z',
    }],
    movimentacoes: [],
    agora,
  })

  assert.equal(resumo.totalPremios, 3200)
  assert.equal(resumo.premiosPendentes, 0)
  assert.equal(resumo.totalPeriodoGrafico, 3200)
  assert.equal(resumo.fonteGanhos, 'pagamentos')
})

test('créditos financeiros são a fonte preferencial do gráfico quando existem', () => {
  const resumo = montarResumoDashboard({
    candidatos: [],
    pagamentos: [{
      id: 'pagamento-1',
      status: 'approved',
      valor: 8000,
      aprovadoEm: '2026-06-10T12:00:00.000Z',
    }],
    movimentacoes: [{
      id: 'movimento-1',
      tipo: 'credito_recompensa',
      valor: 1800,
      criadoEm: '2026-05-20T12:00:00.000Z',
    }],
    agora,
  })

  assert.equal(resumo.fonteGanhos, 'movimentacoes')
  assert.equal(resumo.totalPeriodoGrafico, 1800)
  assert.equal(resumo.ultimoCredito, '2026-05-20T12:00:00.000Z')
})

function candidato(id, status, overrides = {}) {
  return {
    id,
    nome: `Candidato ${id}`,
    status,
    aplicadoEm: `2026-06-${String(Number(id) + 1).padStart(2, '0')}T12:00:00.000Z`,
    ...overrides,
  }
}

test('distribuição conta cada status atual, sem funil cumulativo e sem NaN', () => {
  assert.ok(montarDesempenhoIndicacoes().every((item) => item.quantidade === 0 && item.percentual === 0))
  const lista = ['indicado', 'entrevista', 'contratado', 'contratado', 'recusado', 'cancelado'].map((status, i) => candidato(String(i), status))
  const grafico = montarDesempenhoIndicacoes(lista)
  assert.equal(grafico.find((item) => item.status === 'contratado').quantidade, 2)
  assert.equal(grafico.find((item) => item.status === 'contratado').percentual, 33.3)
  assert.equal(grafico.find((item) => item.status === 'entrevista').quantidade, 1)
  assert.equal(grafico.reduce((total, item) => total + item.quantidade, 0), 6)
  const resumo = montarResumoDashboard({ candidatos: lista, pagamentos: [], movimentacoes: [] })
  assert.equal(resumo.taxaContratacao, 33.3)
  assert.equal(resumo.taxaEntrevista, 50)
  assert.equal(resumo.taxaEntrevistaContratacao, 66.7)
  assert.equal(montarDesempenhoIndicacoes([{ status: 'legado' }]).at(-1).quantidade, 1)
})

const vaga = (id, dados = {}) => ({ id, empresaId: 'empresa', status: 'aberta', titulo: 'Desenvolvedor React', area: 'Tecnologia', requisitos: ['React', 'JavaScript'], criadoEm: '2026-06-01', ...dados })
const indicacao = (dados = {}) => ({ indicadorId: 'dono', vagaId: 'antiga', vagaTitulo: 'Desenvolvedor React', criadoEm: '2026-06-12', ...dados })
const perfil = (dados = {}) => ({ id: 'talento', indicadorId: 'dono', cargoAtual: 'Desenvolvedor Frontend', hardSkills: ['React', 'JavaScript'], ...dados })
const recomendar = (dados = {}) => recomendarVagas({ indicadorId: 'dono', agora, vagas: [vaga('tech'), vaga('comercial', { titulo: 'Vendedor', area: 'Comercial', requisitos: ['Vendas'] })], ...dados })

test('histórico de tecnologia prioriza tecnologia e vaga sem relação tem score menor', () => {
  const resultado = recomendar({ indicacoes: [indicacao()] })
  assert.equal(resultado.vagas[0].vaga.id, 'tech')
  assert.ok(resultado.vagas[0].score > 0)
  assert.equal(resultado.vagas.some((item) => item.vaga.id === 'comercial'), false)
  assert.ok(resultado.vagas[0].motivos.some((item) => item.tipo === 'recente'))
})

test('candidato pré-salvo relacionado aumenta score e personaliza sem histórico', () => {
  const base = recomendar({ indicacoes: [indicacao()] }).vagas[0].score
  const combinado = recomendar({ indicacoes: [indicacao()], preSalvos: [perfil()] })
  assert.ok(combinado.vagas[0].score > base)
  const resultado = recomendar({ preSalvos: [perfil()] })
  assert.equal(resultado.personalizada, true)
  assert.equal(resultado.vagas[0].vaga.id, 'tech')
  assert.deepEqual(resultado.vagas[0].motivos[0], { tipo: 'candidatos', count: 1 })
})

test('candidato já cadastrado pode sugerir outra vaga, mas não sua indicação existente', () => {
  const resultado = recomendar({ candidatos: [perfil({ vagaId: 'tech' })], vagas: [vaga('tech'), vaga('outra')] })
  assert.deepEqual(resultado.vagas.map((item) => item.vaga.id), ['outra'])
  const repetida = recomendar({ preSalvos: [perfil()], indicacoes: [indicacao({ vagaId: 'tech', candidatoPreSalvoId: 'talento' })] })
  assert.ok(repetida.vagas.every((item) => !item.motivos.some((motivo) => motivo.tipo === 'candidatos')))
})

test('não recomenda fechadas, pausadas, expiradas, inválidas nem solicitações empresariais', () => {
  for (const dados of [{ status: 'encerrada' }, { status: 'pausada' }, { status: 'expirada' },
    { expiraEm: '2026-06-01' }, { dataLimite: 'inválido' }, { empresaId: '' },
    { modoEmpresa: 'empresarial', statusAprovacao: 'solicitada' }]) {
    assert.equal(vagaDisponivelParaRecomendacao(vaga('x', dados), agora), false)
  }
  assert.equal(vagaDisponivelParaRecomendacao(vaga('x', { dataLimite: '2026-06-18' }), agora), true)
  assert.equal(vagaDisponivelParaRecomendacao(vaga('x', { modoEmpresa: 'empresarial', statusAprovacao: 'publicada' }), agora), true)
  assert.equal(recomendar({ vagas: [vaga('x', { status: 'encerrada' })] }).vagas.length, 0)
})

test('sem histórico e candidatos usa fallback neutro recente e limita a shortlist', () => {
  const vagas = Array.from({ length: 8 }, (_, i) => vaga(String(i), { criadoEm: `2026-06-${String(i + 1).padStart(2, '0')}` }))
  const resultado = recomendar({ vagas })
  assert.equal(resultado.personalizada, false)
  assert.equal(resultado.vagas.length, CONFIG_RECOMENDACOES.limite)
  assert.equal(resultado.vagas[0].vaga.id, '7')
  assert.deepEqual(resultado.vagas[0].motivos, [{ tipo: 'neutra' }])
  assert.equal(recomendar({ vagas, limite: 2 }).vagas.length, 2)
  assert.deepEqual(recomendar({ vagas: [] }).vagas, [])
})

test('ordena por relevância, não por idade da vaga; desempates são determinísticos', () => {
  const vagas = [vaga('mais-nova', { titulo: 'Desenvolvedor Python', requisitos: ['Python'], criadoEm: '2026-06-17' }), vaga('react')]
  const resultado = recomendar({ vagas, preSalvos: [perfil()] })
  assert.equal(resultado.vagas[0].vaga.id, 'react')
  assert.ok(resultado.vagas[0].score > resultado.vagas[1].score)
  assert.deepEqual(recomendar({ vagas: [vaga('b'), vaga('a')] }).vagas.map((item) => item.vaga.id), ['a', 'b'])
})

test('perfis e histórico de outro indicador e dados pessoais não influenciam recomendações', () => {
  assert.deepEqual(recomendar({ candidatos: [perfil({ indicadorId: 'outro' })],
    preSalvos: [perfil({ indicadorId: 'outro' })], indicacoes: [indicacao({ indicadorId: 'outro' })] }), recomendar())
  const resultado = recomendar({ preSalvos: [perfil()] })
  assert.deepEqual(recomendar({ preSalvos: [perfil({ nome: 'Vendas Comercial', genero: 'React', dataNascimento: '2000-01-01', email: 'Python', expectativaSalarial: '12345' })] }), resultado)
  assert.equal(recomendar({ indicadorId: '', preSalvos: [perfil()] }).personalizada, false)
})

test('perfis duplicados e vagas repetidas não duplicam contagens ou cards', () => {
  const resultado = recomendar({ preSalvos: [perfil()], candidatos: [perfil({ id: 'indicado', candidatoPreSalvoId: 'talento' })], vagas: [vaga('tech'), vaga('tech')] })
  assert.equal(resultado.vagas.length, 1)
  assert.equal(resultado.vagas[0].motivos[0].count, 1)
})

test('histórico recente tem prioridade sobre frequência antiga e usa área da vaga conhecida', () => {
  const vagas = [vaga('tech'), vaga('sales', { titulo: 'Vendedor', area: 'Comercial', requisitos: ['Vendas'] })]
  const antiga = Array.from({ length: 40 }, () => indicacao({ vagaId: 'sales', vagaTitulo: 'Vendedor', criadoEm: '2025-01-01' }))
  const recente = Array.from({ length: 20 }, () => indicacao({ vagaId: 'tech' }))
  const resultado = recomendar({ vagas, indicacoes: [...antiga, ...recente] })
  assert.equal(resultado.vagas[0].vaga.id, 'tech')
  assert.ok(resultado.vagas.some((item) => item.vaga.id === 'sales'))
})

test('sem afinidade há estado vazio; escolaridade ou modelo sozinhos não personalizam', () => {
  const resultado = recomendar({ vagas: [vaga('sales', { titulo: 'Vendedor', area: 'Comercial', requisitos: ['Vendas'] })], preSalvos: [perfil()] })
  assert.equal(resultado.personalizada, true)
  assert.deepEqual(resultado.vagas, [])
  assert.equal(recomendar({ preSalvos: [perfil({ cargoAtual: '', hardSkills: [], escolaridade: 'Superior', modeloTrabalho: 'Remoto' })] }).personalizada, false)
})
