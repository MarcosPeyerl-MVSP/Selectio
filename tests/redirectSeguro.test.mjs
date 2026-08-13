import assert from 'node:assert/strict'
import test from 'node:test'

import { obterRedirectInterno } from '../src/utils/redirectSeguro.js'

test('aceita apenas caminhos internos validos', () => {
  assert.equal(obterRedirectInterno('/painel/empresa?secao=vagas'), '/painel/empresa?secao=vagas')
  assert.equal(obterRedirectInterno('/vaga/abc#detalhes'), '/vaga/abc#detalhes')
})

test('bloqueia URLs externas e variantes com barras codificadas', () => {
  assert.equal(obterRedirectInterno('https://exemplo.com'), null)
  assert.equal(obterRedirectInterno('//exemplo.com'), null)
  assert.equal(obterRedirectInterno('/\\exemplo.com'), null)
  assert.equal(obterRedirectInterno('/%5Cexemplo.com'), null)
  assert.equal(obterRedirectInterno('/%255Cexemplo.com'), null)
  assert.equal(obterRedirectInterno('/%2Fexemplo.com'), null)
  assert.equal(obterRedirectInterno(null), null)
})
