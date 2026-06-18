import assert from 'node:assert/strict'
import test from 'node:test'

import { montarResumoDashboard } from '../src/pages/indicador/indicadorDashboardDados.js'

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
