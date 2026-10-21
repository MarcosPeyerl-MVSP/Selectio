// checkoutUrl e a URL escolhida pelo backend para o ambiente do pagamento.
export const obterChaveErroCheckout = (error) => {
  if (String(error?.code || '').toLowerCase().startsWith('appcheck/')) return 'sessionCheckError'
  if (error?.code === 'functions/network-error') return 'connectionError'
  if (error?.status === 401) return 'sessionError'
  if (error?.status === 403) return 'accessError'
  if (error?.status === 409) return 'existingPaymentError'
  if (error?.status === 429) return 'rateLimitError'
  if (error?.status >= 500) return 'serviceError'
  return 'createError'
}

export const obterCheckoutUrlPagamento = (pagamento) => {
  if (!pagamento) return ''
  if (pagamento.checkoutUrl) return pagamento.checkoutUrl
  return pagamento.ambiente === 'sandbox'
    ? pagamento.sandboxCheckoutUrl || pagamento.sandboxInitPoint || pagamento.initPoint || ''
    : pagamento.initPoint || ''
}

export const obterRetornoCheckout = (parametros) => {
  const paymentId = [parametros.get('payment_id'), parametros.get('collection_id')]
    .find((valor) => /^\d{1,30}$/.test(valor || '')) || ''
  const identificador = (nome) => {
    const valor = parametros.get(nome) || ''
    return !['null', 'undefined'].includes(valor) && /^[\w-]{1,200}$/.test(valor) ? valor : ''
  }
  const pagamentoId = identificador('pagamento_id')
  const preferenceId = identificador('preference_id')
  return paymentId || pagamentoId || preferenceId ? { paymentId, pagamentoId, preferenceId } : null
}

export const limparRetornoCheckout = (parametros) => {
  const limpos = new URLSearchParams(parametros)
  ;['collection_id', 'collection_status', 'external_reference', 'merchant_order_id',
    'payment_id', 'payment_type', 'preference_id', 'pagamento_id', 'site_id', 'status']
    .forEach((nome) => limpos.delete(nome))
  return limpos
}
