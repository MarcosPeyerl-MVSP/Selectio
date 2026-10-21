import assert from 'node:assert/strict'
import { test } from 'node:test'
import { obterCheckoutUrlPagamento, obterRetornoCheckout, limparRetornoCheckout, obterChaveErroCheckout } from '../src/utils/mercadoPagoCheckout.js'

test('checkout distingue falhas de sessao, acesso, conflito e servico sem exibir mensagens externas', () => {
  assert.equal(obterChaveErroCheckout({ code: 'appCheck/recaptcha-error' }), 'sessionCheckError')
  assert.equal(obterChaveErroCheckout({ code: 'functions/network-error' }), 'connectionError')
  assert.equal(obterChaveErroCheckout({ status: 401 }), 'sessionError')
  assert.equal(obterChaveErroCheckout({ status: 403 }), 'accessError')
  assert.equal(obterChaveErroCheckout({ status: 409 }), 'existingPaymentError')
  assert.equal(obterChaveErroCheckout({ status: 429 }), 'rateLimitError')
  assert.equal(obterChaveErroCheckout({ status: 502 }), 'serviceError')
  assert.equal(obterChaveErroCheckout({ status: 400, message: 'mensagem externa nao confiavel' }), 'createError')
  assert.equal(obterChaveErroCheckout(null), 'createError')
})

test('checkout respeita a URL escolhida pelo backend mesmo com sandbox disponivel', () => {
  assert.equal(obterCheckoutUrlPagamento({ ambiente: 'production', checkoutUrl: 'https://checkout-real', sandboxCheckoutUrl: 'https://checkout-teste', sandboxInitPoint: 'https://checkout-teste' }), 'https://checkout-real')
  assert.equal(obterCheckoutUrlPagamento({ ambiente: 'sandbox', sandboxCheckoutUrl: 'https://checkout-teste' }), 'https://checkout-teste')
  assert.equal(obterCheckoutUrlPagamento({ ambiente: 'production', sandboxCheckoutUrl: 'https://checkout-teste' }), '')
  assert.equal(obterCheckoutUrlPagamento(null), '')
})

test('retorno ignora null, undefined e IDs invalidos sem confiar no status da URL', () => {
  assert.equal(obterRetornoCheckout(new URLSearchParams('payment_id=null&collection_id=undefined&status=approved')), null)
  assert.equal(obterRetornoCheckout(new URLSearchParams('payment_id=-1&preference_id=null')), null)
  assert.deepEqual(obterRetornoCheckout(new URLSearchParams('payment_id=null&collection_id=123')), { paymentId: '123', pagamentoId: '', preferenceId: '' })
  assert.deepEqual(obterRetornoCheckout(new URLSearchParams('payment_id=null&pagamento_id=pagamento-1&preference_id=pref-1')), { paymentId: '', pagamentoId: 'pagamento-1', preferenceId: 'pref-1' })
})

test('limpeza de retorno preserva a secao e demais filtros do painel', () => {
  const params = new URLSearchParams('secao=pagamentos&filtro=pendentes&payment_id=123&pagamento_id=pagamento-1&status=success&preference_id=pref-1')
  assert.equal(limparRetornoCheckout(params).toString(), 'secao=pagamentos&filtro=pendentes')
  assert.equal(params.get('payment_id'), '123')
})
