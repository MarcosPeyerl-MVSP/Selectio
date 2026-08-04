import test from 'node:test'
import assert from 'node:assert/strict'

import {
  MAX_CANDIDATOS_CSV,
  detectarDelimitadorCsv,
  gerarModeloCandidatosCsv,
  processarCandidatosCsv,
  validarEmailCandidato,
  validarTelefoneCandidato,
} from '../src/utils/candidatoCsv.js'

test('detecta vírgula ou ponto-e-vírgula sem contar delimitadores entre aspas', () => {
  assert.equal(detectarDelimitadorCsv('nome,email\nAna,ana@exemplo.com'), ',')
  assert.equal(detectarDelimitadorCsv('nome;email;observacoes\nAna;ana@exemplo.com;"Texto, com vírgula"'), ';')
})

test('processa campos entre aspas, aspas escapadas e quebra de linha', () => {
  const csv = [
    'nome,email,telefone,observacoes',
    '"Silva, Ana",ana@exemplo.com,(11) 98765-4321,"Disse ""sim""\ne pode iniciar"',
  ].join('\n')

  const result = processarCandidatosCsv(csv)

  assert.deepEqual(result.errosGerais, [])
  assert.equal(result.validos.length, 1)
  assert.equal(result.validos[0].dados.nome, 'Silva, Ana')
  assert.equal(result.validos[0].dados.observacoesProfissionais, 'Disse "sim"\ne pode iniciar')
})

test('aceita aliases de cabeçalho e converte skills separadas por barra vertical', () => {
  const csv = [
    'Nome completo;E-mail;Hard skills;Soft skills',
    'Bruno Souza;bruno@exemplo.com;React|React|Node;Comunicação|Liderança',
  ].join('\n')

  const result = processarCandidatosCsv(csv)

  assert.equal(result.validos.length, 1)
  assert.deepEqual(result.validos[0].dados.hardSkills, ['React', 'Node'])
  assert.deepEqual(result.validos[0].dados.softSkills, ['Comunicação', 'Liderança'])
})

test('informa colunas obrigatórias ausentes', () => {
  const result = processarCandidatosCsv('telefone;cargoAtual\n11987654321;Designer')

  assert.equal(result.errosGerais.length, 2)
  assert.match(result.errosGerais[0], /nome/i)
  assert.match(result.errosGerais[1], /email/i)
})

test('marca dados inválidos e somente ocorrências posteriores de e-mail duplicado', () => {
  const csv = [
    'nome;email;telefone',
    'Ana;ana@exemplo.com;11987654321',
    'Ana duplicada;ANA@EXEMPLO.COM;11987654321',
    ';email-invalido;123',
  ].join('\n')

  const result = processarCandidatosCsv(csv)

  assert.equal(result.validos.length, 1)
  assert.equal(result.invalidos.length, 2)
  assert.match(result.linhas[1].erros.join(' '), /duplicado/i)
  assert.match(result.linhas[2].erros.join(' '), /nome completo/i)
  assert.match(result.linhas[2].erros.join(' '), /e-mail inválido/i)
  assert.match(result.linhas[2].erros.join(' '), /10 ou 11/i)
})

test('bloqueia arquivos acima do limite de registros', () => {
  const rows = Array.from(
    { length: MAX_CANDIDATOS_CSV + 1 },
    (_, index) => `Pessoa ${index};pessoa${index}@exemplo.com`
  )
  const result = processarCandidatosCsv(['nome;email', ...rows].join('\n'))

  assert.equal(result.totalRegistros, MAX_CANDIDATOS_CSV + 1)
  assert.equal(result.linhas.length, MAX_CANDIDATOS_CSV)
  assert.match(result.errosGerais.join(' '), /limite/i)
})

test('modelo gerado pode ser processado e contém um candidato válido', () => {
  const model = gerarModeloCandidatosCsv()
  const result = processarCandidatosCsv(`\uFEFF${model}`)

  assert.deepEqual(result.errosGerais, [])
  assert.equal(result.validos.length, 1)
  assert.equal(result.validos[0].dados.nome, 'João da Silva')
})

test('validadores aceitam e rejeitam formatos esperados', () => {
  assert.equal(validarEmailCandidato('nome@dominio.com'), true)
  assert.equal(validarEmailCandidato('nome@dominio'), false)
  assert.equal(validarTelefoneCandidato(''), true)
  assert.equal(validarTelefoneCandidato('(11) 98765-4321'), true)
  assert.equal(validarTelefoneCandidato('1234'), false)
})
