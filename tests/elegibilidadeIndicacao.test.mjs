import assert from 'node:assert/strict'
import { test } from 'node:test'
import { avaliarElegibilidadeIndicacao, notaPermiteIndicacao } from '../functions/shared/elegibilidadeIndicacao.mjs'

const vaga = (pesos = { hardSkills: 100, experiencia: 0, escolaridade: 0, idiomas: 0, modeloTrabalho: 0, responsabilidades: 0 }) => ({
  rubricaCompatibilidade: { ativa: true, requisitosObrigatorios: ['React'], requisitosDesejaveis: [],
    criteriosEliminatorios: ['sem disponibilidade para viagens'], idiomasExigidos: [], experienciaMinima: 5, pesos }
})

test('limite estrito, decimais e valores invalidos', () => {
  for (const nota of [0, 44.999, 45, -1, 100.01, NaN, Infinity, -Infinity, null, undefined, '46']) {
    assert.equal(notaPermiteIndicacao(nota), false, String(nota))
  }
  for (const nota of [45.00001, 45.1, 46, 100]) assert.equal(notaPermiteIndicacao(nota), true)
})

test('arredondamento do ranking nao altera a elegibilidade de 45,1%', () => {
  const pesos = { hardSkills: 90.2, experiencia: 9.8, escolaridade: 0, idiomas: 0, modeloTrabalho: 0, responsabilidades: 0 }
  const resultado = avaliarElegibilidadeIndicacao({ candidato: { hardSkills: ['React'], anosExperiencia: '1 ano' }, vaga: vaga(pesos) })
  assert.equal(resultado.nota, 45)
  assert.equal(resultado.notaPrecisa, 45.1)
  assert.equal(resultado.podeIndicar, true)
})

test('nota precisa nao soma pontos previamente arredondados por criterio', () => {
  const resultado = avaliarElegibilidadeIndicacao({ candidato: { hardSkills: ['React'] }, vaga: {
    rubricaCompatibilidade: { ...vaga().rubricaCompatibilidade, requisitosObrigatorios: ['React', 'Node', 'Python'],
      pesos: { hardSkills: 100, experiencia: 0, escolaridade: 0, idiomas: 0, modeloTrabalho: 0, responsabilidades: 0 } }
  } })
  assert.ok(Math.abs(resultado.notaPrecisa - 100 / 6) < 1e-10)
})

test('alertas e requisitos nao comprovados nao vetam candidato acima do limite', () => {
  const resultado = avaliarElegibilidadeIndicacao({ candidato: { hardSkills: ['React'], narrativa: 'Sem disponibilidade para viagens.' }, vaga: vaga() })
  assert.equal(resultado.podeIndicar, true)
  assert.equal(resultado.requerRevisao, true)
  assert.ok(resultado.alertas.length)
})

test('vaga legada usa requisitos existentes e dados insuficientes nao liberam envio', () => {
  assert.equal(avaliarElegibilidadeIndicacao({ candidato: { hardSkills: ['React'] }, vaga: { requisitos: ['React'] } }).podeIndicar, true)
  assert.equal(avaliarElegibilidadeIndicacao({ candidato: {}, vaga: { titulo: 'Vaga' } }).motivo, 'vaga_sem_criterios')
  assert.equal(avaliarElegibilidadeIndicacao({ candidato: {}, vaga: vaga() }).motivo, 'candidato_sem_dados')
})

test('dados pessoais nao alteram a nota de elegibilidade', () => {
  const candidato = { hardSkills: ['React'] }
  const base = avaliarElegibilidadeIndicacao({ candidato, vaga: vaga() })
  const pessoal = avaliarElegibilidadeIndicacao({ candidato: { ...candidato, nome: 'Outro nome', dataNascimento: '1990-01-01', genero: 'Outro', fotoPerfil: { caminho: 'foto' } }, vaga: vaga() })
  assert.deepEqual(pessoal, base)
})
