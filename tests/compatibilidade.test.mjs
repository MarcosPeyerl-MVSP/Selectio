import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  avaliarCompatibilidade,
  criarPerfilSeguroDoCandidato,
  sanitizarTextoCurriculo,
  similaridadeLexical
} from '../src/services/compatibilidade/motorCompatibilidade.js'
import {
  criarRubricaCompatibilidadePadrao,
  prepararRubricaParaSalvar,
  validarRubricaCompatibilidade
} from '../src/utils/rubricaCompatibilidade.js'

const criarVaga = (overrides = {}) => ({
  id: 'vaga-1',
  titulo: 'Desenvolvedor Front-end',
  descricaoLonga: 'Construir interfaces acessiveis e colaborar com produto.',
  rubricaCompatibilidade: {
    ativa: true,
    versao: 1,
    perfilIdeal: 'Profissional que desenvolva interfaces acessiveis.',
    requisitosObrigatorios: ['React', 'Node'],
    requisitosDesejaveis: [],
    criteriosEliminatorios: [],
    experienciaMinima: 4,
    escolaridadeMinima: 'superior_completo',
    idiomasExigidos: ['Ingles avancado'],
    modeloTrabalho: 'remoto',
    pesos: {
      hardSkills: 35,
      experiencia: 20,
      escolaridade: 10,
      idiomas: 10,
      modeloTrabalho: 10,
      responsabilidades: 15
    }
  },
  ...overrides
})

test('rubrica ativa exige criterios e pesos totalizando cem', () => {
  const rubrica = criarRubricaCompatibilidadePadrao()
  assert.equal(validarRubricaCompatibilidade(rubrica).motivo, 'sem_criterios')

  rubrica.perfilIdeal = 'Desenvolvedor React'
  assert.equal(validarRubricaCompatibilidade(rubrica).valida, true)
  rubrica.pesos.hardSkills = 34
  assert.equal(validarRubricaCompatibilidade(rubrica).motivo, 'pesos')

  const salva = prepararRubricaParaSalvar({ ...rubrica, pesos: { ...rubrica.pesos, hardSkills: 35 } })
  assert.equal(salva.versao, 1)
  assert.equal(Object.values(salva.pesos).reduce((total, peso) => total + peso, 0), 100)
})

test('nota combina pesos, estados, cobertura, evidencias e alertas', () => {
  const resultado = avaliarCompatibilidade({
    candidato: {
      nome: 'Pessoa',
      anosExperiencia: '5 anos',
      escolaridade: 'Superior completo',
      proficienciaIdiomas: 'Ingles avancado',
      modeloTrabalho: 'Remoto',
      hardSkills: ['React']
    },
    vaga: criarVaga(),
    textoCurriculo: 'Desenvolvimento React durante 5 anos. Superior completo. Ingles avancado. Trabalho remoto. Criacao de interfaces acessiveis.',
    semantica: {
      responsabilidades: { similaridade: 0.88, evidencia: 'Criacao de interfaces acessiveis.' }
    },
    extracao: { metodo: 'pdf_texto', paginas: 2 }
  })

  assert.equal(resultado.nota, 83)
  assert.equal(resultado.cobertura, 83)
  assert.equal(resultado.criterios.find((item) => item.id === 'hardSkills').resultado, 'atende_parcialmente')
  assert.equal(resultado.alertas.some((item) => item.descricao === 'Node'), true)
  assert.equal(resultado.extracao.metodo, 'pdf_texto')
})

test('divergencia do formulario e curriculo fica explicita e nao e cobrada duas vezes', () => {
  const resultado = avaliarCompatibilidade({
    candidato: { anosExperiencia: '7 anos' },
    vaga: criarVaga({
      rubricaCompatibilidade: {
        ...criarVaga().rubricaCompatibilidade,
        requisitosObrigatorios: [],
        experienciaMinima: 5
      }
    }),
    textoCurriculo: 'Experiencia profissional comprovada por 4 anos.'
  })

  assert.equal(resultado.criterios.find((item) => item.id === 'experiencia').resultado, 'nao_atende')
  assert.deepEqual(resultado.discrepancias[0], {
    campo: 'experiencia',
    formulario: '7 anos',
    curriculo: 'aproximadamente 4 anos'
  })
  assert.equal(resultado.requerRevisao, true)
})

test('perfil enviado ao analisador exclui dados pessoais irrelevantes', () => {
  const perfil = criarPerfilSeguroDoCandidato({
    nome: 'Pessoa',
    genero: 'Feminino',
    dataNascimento: '1990-01-01',
    fotoPerfil: { caminho: 'privado' },
    email: 'pessoa@example.com',
    hardSkills: ['React']
  })

  assert.deepEqual(perfil.hardSkills, ['React'])
  assert.equal('nome' in perfil, false)
  assert.equal('genero' in perfil, false)
  assert.equal('dataNascimento' in perfil, false)
  assert.equal('fotoPerfil' in perfil, false)
  assert.equal('email' in perfil, false)
})

test('similaridade lexical reconhece sobreposicao sem transformar em porcentagem final', () => {
  const similaridade = similaridadeLexical('interfaces acessiveis React', 'Desenvolvimento de interfaces acessiveis usando React')
  assert.ok(similaridade > 0.5)
  assert.ok(similaridade <= 1)
})

test('idade e datas de educacao nao viram anos de experiencia', () => {
  const resultado = avaliarCompatibilidade({
    candidato: { anosExperiencia: '' },
    vaga: criarVaga({
      rubricaCompatibilidade: {
        ...criarVaga().rubricaCompatibilidade,
        requisitosObrigatorios: [],
        requisitosDesejaveis: [],
        experienciaMinima: 1,
        escolaridadeMinima: '',
        idiomasExigidos: [],
        modeloTrabalho: ''
      }
    }),
    textoCurriculo: [
      'Pessoa Ficticia',
      'Idade: 17 anos',
      'Educacao',
      'Ensino medio tecnico | 2021 - 2023.',
      'Objetivo',
      'Estagio em desenvolvimento de sistemas.'
    ].join('\n')
  })

  const experiencia = resultado.criterios.find((item) => item.id === 'experiencia')
  assert.equal(experiencia.resultado, 'nao_comprovado')
  assert.deepEqual(experiencia.evidencias, [])
})

test('skills usam palavras completas e diferenciam React de React Native', () => {
  const resultado = avaliarCompatibilidade({
    candidato: {},
    vaga: criarVaga({
      rubricaCompatibilidade: {
        ...criarVaga().rubricaCompatibilidade,
        requisitosObrigatorios: ['React', 'JavaScript', 'Git'],
        requisitosDesejaveis: [],
        experienciaMinima: 0,
        escolaridadeMinima: '',
        idiomasExigidos: [],
        modeloTrabalho: ''
      }
    }),
    textoCurriculo: 'Conhecimentos em JavaScript e React Native. Learn agility e proatividade.'
  })

  const detalhes = resultado.criterios.find((item) => item.id === 'hardSkills').detalhes
  assert.equal(detalhes.find((item) => item.descricao === 'JavaScript').resultado, 'atende')
  assert.equal(detalhes.find((item) => item.descricao === 'React').resultado, 'atende_parcialmente')
  assert.equal(detalhes.find((item) => item.descricao === 'Git').resultado, 'nao_comprovado')
})

test('skill informada apenas no formulario nao vira comprovacao integral', () => {
  const resultado = avaliarCompatibilidade({
    candidato: { hardSkills: ['Git'] },
    vaga: criarVaga({
      rubricaCompatibilidade: {
        ...criarVaga().rubricaCompatibilidade,
        requisitosObrigatorios: ['Git'],
        requisitosDesejaveis: [],
        experienciaMinima: 0,
        escolaridadeMinima: '',
        idiomasExigidos: [],
        modeloTrabalho: ''
      }
    }),
    textoCurriculo: 'Perfil colaborativo com foco em qualidade.'
  })

  const git = resultado.criterios.find((item) => item.id === 'hardSkills').detalhes[0]
  assert.equal(git.resultado, 'atende_parcialmente')
  assert.equal(git.fonte, 'formulario_sem_comprovacao_curriculo')
  assert.equal(resultado.discrepancias[0].campo, 'hardSkill:Git')
})

test('projetos com mestrados e doutorados nao elevam escolaridade', () => {
  const resultado = avaliarCompatibilidade({
    candidato: {},
    vaga: criarVaga({
      rubricaCompatibilidade: {
        ...criarVaga().rubricaCompatibilidade,
        requisitosObrigatorios: [],
        requisitosDesejaveis: [],
        experienciaMinima: 0,
        escolaridadeMinima: 'superior_completo',
        idiomasExigidos: [],
        modeloTrabalho: ''
      }
    }),
    textoCurriculo: [
      'Educacao',
      'Ensino Medio Tecnico em Informatica, cursando.',
      'Projetos',
      'Plataforma para publicar TCCs, Mestrados e Doutorados.'
    ].join('\n')
  })

  const escolaridade = resultado.criterios.find((item) => item.id === 'escolaridade')
  assert.equal(escolaridade.resultado, 'nao_atende')
  assert.deepEqual(escolaridade.evidencias, ['tecnico'])
})

test('criterios nao configurados ficam fora da nota e da cobertura', () => {
  const resultado = avaliarCompatibilidade({
    candidato: { escolaridade: 'Doutorado', proficienciaIdiomas: 'Ingles fluente' },
    vaga: criarVaga({
      rubricaCompatibilidade: {
        ...criarVaga().rubricaCompatibilidade,
        escolaridadeMinima: '',
        idiomasExigidos: []
      }
    }),
    textoCurriculo: 'Doutorado concluido. Ingles fluente.'
  })

  const escolaridade = resultado.criterios.find((item) => item.id === 'escolaridade')
  const idiomas = resultado.criterios.find((item) => item.id === 'idiomas')
  assert.equal(escolaridade.resultado, 'nao_aplicavel')
  assert.equal(escolaridade.peso, 0)
  assert.equal(idiomas.resultado, 'nao_aplicavel')
  assert.equal(idiomas.peso, 0)
})

test('criterio eliminatorio so alerta quando existe incompatibilidade explicita', () => {
  const vaga = criarVaga({
    rubricaCompatibilidade: {
      ...criarVaga().rubricaCompatibilidade,
      requisitosObrigatorios: [],
      requisitosDesejaveis: [],
      criteriosEliminatorios: ['Ausencia de experiencia pratica com desenvolvimento front-end'],
      experienciaMinima: 0,
      escolaridadeMinima: '',
      idiomasExigidos: [],
      modeloTrabalho: ''
    }
  })
  const semNegacao = avaliarCompatibilidade({ candidato: {}, vaga, textoCurriculo: 'Objetivo: estagio em desenvolvimento de sistemas.' })
  const comNegacao = avaliarCompatibilidade({ candidato: {}, vaga, textoCurriculo: 'Nao tenho experiencia pratica com desenvolvimento front-end.' })

  assert.equal(semNegacao.alertas.some((item) => item.tipo === 'eliminatorio_evidenciado'), false)
  assert.equal(comNegacao.alertas.some((item) => item.tipo === 'eliminatorio_evidenciado'), true)
})

test('semantica sem apoio lexical nao comprova responsabilidades', () => {
  const resultado = avaliarCompatibilidade({
    candidato: {},
    vaga: criarVaga({
      descricaoLonga: 'Construir interfaces web acessiveis e responsivas.',
      rubricaCompatibilidade: {
        ...criarVaga().rubricaCompatibilidade,
        perfilIdeal: 'Especialista em interfaces web acessiveis.',
        requisitosObrigatorios: [],
        requisitosDesejaveis: [],
        experienciaMinima: 0,
        escolaridadeMinima: '',
        idiomasExigidos: [],
        modeloTrabalho: ''
      }
    }),
    textoCurriculo: 'Atendimento comercial e controle de estoque.',
    semantica: { responsabilidades: { similaridade: 0.9, evidencia: 'Atendimento comercial e controle de estoque.' } }
  })

  assert.equal(resultado.criterios.find((item) => item.id === 'responsabilidades').resultado, 'nao_comprovado')
})

test('evidencias removem identificacao e dados de contato', () => {
  const sanitizado = sanitizarTextoCurriculo([
    'Pessoa de Teste',
    'Idade: 17 anos',
    'Tel.: (11) 95046-3602',
    'E-mail: pessoa@example.com',
    'JavaScript e React.'
  ].join('\n'))

  assert.equal(sanitizado.includes('Pessoa de Teste'), false)
  assert.equal(sanitizado.includes('17 anos'), false)
  assert.equal(sanitizado.includes('95046'), false)
  assert.equal(sanitizado.includes('example.com'), false)
  assert.equal(sanitizado.includes('JavaScript e React'), true)
})
