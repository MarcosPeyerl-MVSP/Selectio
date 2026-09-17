import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  metadadosPlanosCurriculo,
  normalizarMetadadosCurriculo
} from '../src/utils/curriculoCandidato.js'

const TIPO_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

test('upload novo prevalece sobre metadados planos antigos e vazios', () => {
  const curriculo = normalizarMetadadosCurriculo({
    curriculoNome: '',
    curriculoTipo: '',
    curriculoTamanho: 0,
    curriculo: {
      nome: 'curriculo ana.docx',
      tipo: TIPO_DOCX,
      tamanho: 13689,
      caminho: 'curriculos/indicador/pre-salvos/candidato/arquivo.docx',
      status: 'disponivel'
    }
  })

  assert.deepEqual(curriculo, {
    nome: 'curriculo ana.docx',
    tipo: TIPO_DOCX,
    tamanho: 13689,
    caminho: 'curriculos/indicador/pre-salvos/candidato/arquivo.docx',
    status: 'disponivel'
  })
})

test('registro afetado recupera nome e tipo pela extensao do caminho', () => {
  const dados = {
    curriculoNome: '',
    curriculo: {
      caminho: 'curriculos/indicador/pre-salvos/candidato/arquivo.docx',
      status: 'disponivel'
    }
  }

  assert.deepEqual(normalizarMetadadosCurriculo(dados), {
    nome: 'curriculo.docx',
    tipo: TIPO_DOCX,
    tamanho: 0,
    caminho: 'curriculos/indicador/pre-salvos/candidato/arquivo.docx',
    status: 'disponivel'
  })
  assert.deepEqual(metadadosPlanosCurriculo(dados), {
    curriculoNome: 'curriculo.docx',
    curriculoTipo: TIPO_DOCX,
    curriculoTamanho: 0
  })
})

test('metadados planos continuam atendendo registros legados sem caminho', () => {
  assert.deepEqual(normalizarMetadadosCurriculo({
    curriculoNome: 'perfil.pdf',
    curriculoTipo: 'application/pdf',
    curriculoTamanho: 2048
  }), {
    nome: 'perfil.pdf',
    tipo: 'application/pdf',
    tamanho: 2048,
    caminho: '',
    status: 'pendente_reenvio'
  })
})

test('candidato sem curriculo permanece sem metadados', () => {
  assert.deepEqual(normalizarMetadadosCurriculo({}), {})
})
