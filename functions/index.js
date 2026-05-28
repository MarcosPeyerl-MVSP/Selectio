const admin = require('firebase-admin')
const functions = require('firebase-functions')

admin.initializeApp()

const db = admin.firestore()
const FieldValue = admin.firestore.FieldValue

const STATUS_PAGAMENTO = {
  approved: 'approved',
  pending: 'pending',
  in_process: 'pending',
  authorized: 'pending',
  rejected: 'rejected',
  cancelled: 'cancelled',
  refunded: 'refunded',
  charged_back: 'refunded',
  failed: 'failed'
}

const moedaPadrao = 'BRL'
const regiao = 'us-central1'

function erroHttps(codigo, mensagem) {
  throw new functions.https.HttpsError(codigo, mensagem)
}

function obterAccessToken() {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN

  if (!token) {
    throw new Error('MERCADO_PAGO_ACCESS_TOKEN nao configurado nas Cloud Functions.')
  }

  return token
}

function obterAppUrl() {
  return process.env.APP_URL || 'http://localhost:5173'
}

function obterWebhookUrl() {
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || admin.app().options.projectId
  const urlBase = process.env.MP_WEBHOOK_URL || `https://${regiao}-${projectId}.cloudfunctions.net/mercadoPagoWebhook`
  const segredo = process.env.MP_WEBHOOK_SECRET

  if (!segredo) return urlBase

  const separador = urlBase.includes('?') ? '&' : '?'
  return `${urlBase}${separador}secret=${encodeURIComponent(segredo)}`
}

function validarWebhook(req) {
  const segredo = process.env.MP_WEBHOOK_SECRET

  if (!segredo) return true

  return req.query.secret === segredo
}

function numeroPositivo(valor) {
  const numero = Number(valor)

  return Number.isFinite(numero) && numero > 0 ? Number(numero.toFixed(2)) : null
}

function dinheiro(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

function textoSeguro(valor, fallback = '') {
  const texto = String(valor || '').trim()
  return texto || fallback
}

function normalizarStatusMercadoPago(status) {
  return STATUS_PAGAMENTO[status] || 'failed'
}

async function chamarMercadoPago(caminho, opcoes = {}) {
  const resposta = await globalThis.fetch(`https://api.mercadopago.com${caminho}`, {
    ...opcoes,
    headers: {
      Authorization: `Bearer ${obterAccessToken()}`,
      'Content-Type': 'application/json',
      ...(opcoes.headers || {})
    }
  })

  const corpo = await resposta.json().catch(() => ({}))

  if (!resposta.ok) {
    const mensagem = corpo.message || corpo.error || 'Erro ao consultar Mercado Pago.'
    throw new Error(mensagem)
  }

  return corpo
}

async function buscarIndicacao({ indicacaoId, candidatoId, empresaId }) {
  if (indicacaoId) {
    const indicacaoDoc = await db.collection('indicacoes').doc(indicacaoId).get()
    return indicacaoDoc.exists ? { id: indicacaoDoc.id, ...indicacaoDoc.data() } : null
  }

  const indicacoesSnap = await db.collection('indicacoes')
    .where('candidatoId', '==', candidatoId)
    .limit(10)
    .get()

  const indicacaoDoc = indicacoesSnap.docs.find((doc) => doc.data().empresaId === empresaId)

  return indicacaoDoc ? { id: indicacaoDoc.id, ...indicacaoDoc.data() } : null
}

async function buscarPagamentoAberto({ candidatoId, empresaId }) {
  const pagamentosSnap = await db.collection('pagamentos')
    .where('candidatoId', '==', candidatoId)
    .limit(20)
    .get()

  const pagamentos = pagamentosSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))

  return {
    aprovado: pagamentos.find((pagamento) => pagamento.empresaId === empresaId && pagamento.status === 'approved'),
    pendente: pagamentos.find((pagamento) => (
      pagamento.empresaId === empresaId
      && ['pending', 'in_process'].includes(pagamento.status)
      && (pagamento.checkoutUrl || pagamento.sandboxCheckoutUrl)
    ))
  }
}

function montarReferenciaExterna({ pagamentoId, empresaId, indicadorId, vagaId, candidatoId, indicacaoId }) {
  return ['selectio', pagamentoId, empresaId, indicadorId, vagaId || 'sem-vaga', candidatoId, indicacaoId || 'sem-indicacao'].join(':')
}

function extrairPagamentoIdDaReferencia(referencia) {
  const partes = String(referencia || '').split(':')

  if (partes[0] !== 'selectio') return null
  return partes[1] || null
}

exports.createMercadoPagoPreference = functions
  .region(regiao)
  .https.onCall(async (dados, contexto) => {
    if (!contexto.auth) {
      erroHttps('unauthenticated', 'Faca login como empresa para criar pagamento.')
    }

    const empresaId = String(dados.empresaId || '')
    const candidatoId = String(dados.candidatoId || '')
    const indicadorIdInput = String(dados.indicadorId || '')
    const indicacaoId = String(dados.indicacaoId || '')
    const vagaIdInput = String(dados.vagaId || '')
    const valor = numeroPositivo(dados.valor)

    if (!empresaId || empresaId !== contexto.auth.uid) {
      erroHttps('permission-denied', 'Esta empresa nao pode criar este pagamento.')
    }

    if (!candidatoId || !valor) {
      erroHttps('invalid-argument', 'Candidato e valor positivo sao obrigatorios.')
    }

    const empresaDoc = await db.collection('empresas').doc(empresaId).get()
    if (!empresaDoc.exists) {
      erroHttps('permission-denied', 'Perfil de empresa nao encontrado.')
    }

    const candidatoDoc = await db.collection('candidatos').doc(candidatoId).get()
    if (!candidatoDoc.exists) {
      erroHttps('not-found', 'Candidato nao encontrado.')
    }

    const empresa = empresaDoc.data()
    const candidato = candidatoDoc.data()

    if (candidato.empresaId !== empresaId && candidato.empresaUid !== empresaId) {
      erroHttps('permission-denied', 'Candidato nao pertence a esta empresa.')
    }

    const indicacao = await buscarIndicacao({ indicacaoId, candidatoId, empresaId })
    const indicadorId = indicadorIdInput || candidato.indicadorId || candidato.indicadorUid || indicacao?.indicadorId

    if (!indicadorId) {
      erroHttps('failed-precondition', 'Candidato nao possui indicador vinculado.')
    }

    if (
      (candidato.indicadorId && candidato.indicadorId !== indicadorId)
      || (indicacao?.indicadorId && indicacao.indicadorId !== indicadorId)
    ) {
      erroHttps('permission-denied', 'Indicador nao corresponde ao candidato ou indicacao.')
    }

    const { aprovado, pendente } = await buscarPagamentoAberto({ candidatoId, empresaId })

    if (aprovado) {
      erroHttps('already-exists', 'Ja existe pagamento aprovado para este candidato.')
    }

    if (pendente) {
      return {
        pagamentoId: pendente.id,
        preferenceId: pendente.mercadoPagoPreferenceId,
        initPoint: pendente.checkoutUrl,
        sandboxInitPoint: pendente.sandboxCheckoutUrl,
        reused: true
      }
    }

    const indicadorDoc = await db.collection('indicadores').doc(indicadorId).get()
    const vagaId = vagaIdInput || candidato.vagaId || indicacao?.vagaId || ''
    const vagaDoc = vagaId ? await db.collection('vagas').doc(vagaId).get() : null
    const indicador = indicadorDoc.exists ? indicadorDoc.data() : {}
    const vaga = vagaDoc?.exists ? vagaDoc.data() : {}
    const pagamentoRef = db.collection('pagamentos').doc()
    const finalIndicacaoId = indicacao?.id || indicacaoId || ''
    const vagaTitulo = textoSeguro(vaga.titulo || candidato.vagaTitulo || indicacao?.vagaTitulo, 'Vaga Selectio')
    const candidatoNome = textoSeguro(candidato.nome || indicacao?.candidatoNome, 'Candidato')
    const descricao = textoSeguro(dados.descricao, `Recompensa Selectio - ${vagaTitulo} - ${candidatoNome}`)
    const referenciaExterna = montarReferenciaExterna({
      pagamentoId: pagamentoRef.id,
      empresaId,
      indicadorId,
      vagaId,
      candidatoId,
      indicacaoId: finalIndicacaoId
    })

    const preferencia = await chamarMercadoPago('/checkout/preferences', {
      method: 'POST',
      body: JSON.stringify({
        items: [
          {
            title: descricao,
            quantity: 1,
            unit_price: valor,
            currency_id: moedaPadrao
          }
        ],
        payer: {
          email: empresa.email || contexto.auth.token.email || undefined
        },
        back_urls: {
          success: `${obterAppUrl()}/painel/empresa?secao=pagamentos&status=success`,
          failure: `${obterAppUrl()}/painel/empresa?secao=pagamentos&status=failure`,
          pending: `${obterAppUrl()}/painel/empresa?secao=pagamentos&status=pending`
        },
        auto_return: 'approved',
        notification_url: obterWebhookUrl(),
        external_reference: referenciaExterna,
        metadata: {
          empresaId,
          indicadorId,
          candidatoId,
          vagaId,
          indicacaoId: finalIndicacaoId,
          valor
        }
      })
    })

    const agora = FieldValue.serverTimestamp()
    const pagamento = {
      mercadoPagoPreferenceId: preferencia.id || '',
      mercadoPagoPaymentId: '',
      status: 'pending',
      statusDetail: '',
      valor,
      moeda: moedaPadrao,
      empresaId,
      empresaNome: empresa.nomeEmpresa || empresa.razaoSocial || '',
      indicadorId,
      indicadorNome: indicador.nome || candidato.indicadorNome || indicacao?.indicadorNome || '',
      candidatoId,
      candidatoNome,
      vagaId,
      vagaTitulo,
      indicacaoId: finalIndicacaoId,
      descricao,
      checkoutUrl: preferencia.init_point || '',
      sandboxCheckoutUrl: preferencia.sandbox_init_point || '',
      externalReference: referenciaExterna,
      creditado: false,
      criadoEm: agora,
      atualizadoEm: agora
    }

    await pagamentoRef.set(pagamento)

    return {
      pagamentoId: pagamentoRef.id,
      preferenceId: preferencia.id,
      initPoint: preferencia.init_point || '',
      sandboxInitPoint: preferencia.sandbox_init_point || ''
    }
  })

exports.solicitarSaqueIndicador = functions
  .region(regiao)
  .https.onCall(async (dados, contexto) => {
    if (!contexto.auth) {
      erroHttps('unauthenticated', 'Faca login como indicador para solicitar saque.')
    }

    const indicadorId = String(dados.indicadorId || '')
    const valor = numeroPositivo(dados.valor)
    const chavePix = textoSeguro(dados.chavePix)

    if (!indicadorId || indicadorId !== contexto.auth.uid) {
      erroHttps('permission-denied', 'Este indicador nao pode solicitar saque para outra conta.')
    }

    if (!valor || !chavePix) {
      erroHttps('invalid-argument', 'Valor e chave Pix sao obrigatorios.')
    }

    const indicadorDoc = await db.collection('indicadores').doc(indicadorId).get()
    if (!indicadorDoc.exists) {
      erroHttps('permission-denied', 'Perfil de indicador nao encontrado.')
    }

    const indicador = indicadorDoc.data()
    const saldoRef = db.collection('indicadorSaldos').doc(indicadorId)
    const saqueRef = db.collection('saques').doc()
    const movimentacaoRef = db.collection('movimentacoesFinanceiras').doc()

    await db.runTransaction(async (transaction) => {
      const saldoDoc = await transaction.get(saldoRef)
      const saldo = saldoDoc.exists ? saldoDoc.data() : {}
      const saldoDisponivel = Number(saldo.saldoDisponivel || 0)

      if (saldoDisponivel < valor) {
        throw new functions.https.HttpsError('failed-precondition', 'Saldo disponivel insuficiente.')
      }

      const agora = FieldValue.serverTimestamp()

      transaction.set(saqueRef, {
        indicadorId,
        indicadorNome: indicador.nome || '',
        valor,
        chavePix,
        status: 'solicitado',
        solicitadoEm: agora,
        atualizadoEm: agora,
        observacao: textoSeguro(dados.observacao)
      })

      transaction.set(movimentacaoRef, {
        indicadorId,
        tipo: 'saque_solicitado',
        valor,
        status: 'solicitado',
        saqueId: saqueRef.id,
        descricao: `Solicitacao de saque de ${dinheiro(valor)}`,
        criadoEm: agora
      })

      transaction.set(saldoRef, {
        indicadorId,
        saldoDisponivel: FieldValue.increment(-valor),
        saldoPendente: FieldValue.increment(valor),
        atualizadoEm: agora
      }, { merge: true })
    })

    return {
      saqueId: saqueRef.id,
      status: 'solicitado'
    }
  })

exports.mercadoPagoWebhook = functions
  .region(regiao)
  .https.onRequest(async (req, res) => {
    if (!validarWebhook(req)) {
      res.status(401).send('invalid secret')
      return
    }

    try {
      const tipo = req.body?.type || req.query.type || req.query.topic
      const paymentId = req.body?.data?.id || req.body?.id || req.query.id || req.query['data.id']

      if (!paymentId || !String(tipo || '').includes('payment')) {
        res.status(200).send('ignored')
        return
      }

      const pagamentoMp = await chamarMercadoPago(`/v1/payments/${paymentId}`)
      const referenciaExterna = pagamentoMp.external_reference
      const pagamentoId = extrairPagamentoIdDaReferencia(referenciaExterna)

      if (!pagamentoId) {
        res.status(200).send('missing reference')
        return
      }

      const pagamentoRef = db.collection('pagamentos').doc(pagamentoId)
      const statusInterno = normalizarStatusMercadoPago(pagamentoMp.status)
      const valorPago = Number(pagamentoMp.transaction_amount || 0)

      await db.runTransaction(async (transaction) => {
        const pagamentoDoc = await transaction.get(pagamentoRef)

        if (!pagamentoDoc.exists) {
          throw new Error('Pagamento interno nao encontrado.')
        }

        const pagamento = pagamentoDoc.data()
        const agora = FieldValue.serverTimestamp()
        const valorEsperado = Number(pagamento.valor || 0)
        const valorConfere = Math.abs(valorPago - valorEsperado) < 0.01

        if (!valorConfere) {
          transaction.update(pagamentoRef, {
            status: 'failed',
            statusDetail: 'valor_divergente',
            mercadoPagoPaymentId: String(pagamentoMp.id || paymentId),
            rawPayment: resumirPagamentoMercadoPago(pagamentoMp),
            atualizadoEm: agora
          })
          return
        }

        const atualizacaoPagamento = {
          status: statusInterno,
          statusDetail: pagamentoMp.status_detail || '',
          mercadoPagoPaymentId: String(pagamentoMp.id || paymentId),
          rawPayment: resumirPagamentoMercadoPago(pagamentoMp),
          atualizadoEm: agora
        }

        if (statusInterno === 'approved') {
          atualizacaoPagamento.aprovadoEm = agora
        }

        if (statusInterno !== 'approved' || pagamento.creditado) {
          transaction.update(pagamentoRef, atualizacaoPagamento)
          return
        }

        const saldoRef = db.collection('indicadorSaldos').doc(pagamento.indicadorId)
        const movimentacaoRef = db.collection('movimentacoesFinanceiras').doc()
        const notificacaoIndicadorRef = db.collection('notificacoes').doc()
        const notificacaoEmpresaRef = db.collection('notificacoes').doc()

        transaction.set(saldoRef, {
          indicadorId: pagamento.indicadorId,
          saldoDisponivel: FieldValue.increment(valorEsperado),
          saldoPendente: FieldValue.increment(0),
          totalRecebido: FieldValue.increment(valorEsperado),
          totalSacado: FieldValue.increment(0),
          atualizadoEm: agora
        }, { merge: true })

        transaction.set(movimentacaoRef, {
          indicadorId: pagamento.indicadorId,
          tipo: 'credito_recompensa',
          valor: valorEsperado,
          status: 'approved',
          pagamentoId: pagamentoDoc.id,
          candidatoId: pagamento.candidatoId,
          vagaId: pagamento.vagaId,
          empresaId: pagamento.empresaId,
          descricao: `Credito de recompensa por ${pagamento.candidatoNome || 'candidato'} em ${pagamento.vagaTitulo || 'vaga'}`,
          criadoEm: agora
        })

        transaction.set(notificacaoIndicadorRef, {
          userId: pagamento.indicadorId,
          tipo: 'pagamento_aprovado',
          titulo: 'Pagamento recebido',
          mensagem: `Voce recebeu ${dinheiro(valorEsperado)} pela indicacao de ${pagamento.candidatoNome || 'um candidato'} para a vaga ${pagamento.vagaTitulo || 'informada'}.`,
          lida: false,
          link: '/painel/indicador?secao=financeiro',
          metadata: {
            pagamentoId: pagamentoDoc.id,
            candidatoId: pagamento.candidatoId,
            vagaId: pagamento.vagaId
          },
          criadoEm: agora
        })

        transaction.set(notificacaoEmpresaRef, {
          userId: pagamento.empresaId,
          tipo: 'pagamento_aprovado',
          titulo: 'Pagamento aprovado',
          mensagem: `Pagamento de ${dinheiro(valorEsperado)} aprovado para ${pagamento.candidatoNome || 'o candidato'}.`,
          lida: false,
          link: '/painel/empresa?secao=pagamentos',
          metadata: {
            pagamentoId: pagamentoDoc.id,
            candidatoId: pagamento.candidatoId,
            vagaId: pagamento.vagaId
          },
          criadoEm: agora
        })

        transaction.update(pagamentoRef, {
          ...atualizacaoPagamento,
          creditado: true
        })
      })

      res.status(200).send('ok')
    } catch (error) {
      console.error('Erro no webhook Mercado Pago:', error)
      res.status(500).send('webhook error')
    }
  })

function resumirPagamentoMercadoPago(pagamento) {
  return {
    id: pagamento.id || null,
    status: pagamento.status || '',
    status_detail: pagamento.status_detail || '',
    transaction_amount: pagamento.transaction_amount || 0,
    currency_id: pagamento.currency_id || moedaPadrao,
    external_reference: pagamento.external_reference || '',
    payment_method_id: pagamento.payment_method_id || '',
    payment_type_id: pagamento.payment_type_id || '',
    date_approved: pagamento.date_approved || null,
    date_created: pagamento.date_created || null
  }
}
