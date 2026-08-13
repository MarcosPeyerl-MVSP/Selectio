import './ModalPagamentoRecompensa.css'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FaCreditCard, FaExternalLinkAlt, FaTimes } from 'react-icons/fa'

import { useConfirmacao } from '../../hooks/useConfirmacao'
import { useToast } from '../../hooks/useToast'
import {
  criarPagamentoRecompensa,
  obterCheckoutUrlPagamento,
  sincronizarPagamentoMercadoPago
} from '../../services/firestorePagamentos'
import { getFirebaseUid } from '../../services/identidadeFirebase'
import { formatCurrency } from '../../i18n/formatters'

function ModalPagamentoRecompensa({ candidato, empresa, pagamentoExistente, onClose, onCreated }) {
  const { t } = useTranslation('company')
  const toast = useToast()
  const confirm = useConfirmacao()
  const empresaId = getFirebaseUid(empresa)
  const recompensaFixa = useMemo(() => obterRecompensaFixa(candidato), [candidato])
  const valorRecompensa = recompensaFixa.valor
  const [carregando, setCarregando] = useState(false)
  const sincronizacaoTentada = useRef('')

  useEffect(() => {
    const pagamentoId = pagamentoExistente?.id
    if (!pagamentoId || pagamentoExistente.status !== 'pending' || !empresaId) return
    if (sincronizacaoTentada.current === pagamentoId) return
    sincronizacaoTentada.current = pagamentoId

    sincronizarPagamentoMercadoPago({
      pagamentoId,
      preferenceId: pagamentoExistente.mercadoPagoPreferenceId,
      empresaId
    }).then((resultado) => {
      if (resultado?.status && resultado.status !== pagamentoExistente.status) {
        onCreated?.({ ...pagamentoExistente, ...resultado, id: pagamentoId })
      }
    }).catch((error) => {
      console.error('Falha ao sincronizar o pagamento pendente:', error)
    })
  }, [empresaId, onCreated, pagamentoExistente])

  if (!candidato) return null

  const statusPagamento = pagamentoExistente?.status
  const checkoutUrl = obterCheckoutUrlPagamento(pagamentoExistente)
  const recompensaPaga = statusPagamento === 'approved'
  const pagamentoPendente = statusPagamento === 'pending' && checkoutUrl

  const montarDadosPagamento = () => ({
    empresaId,
    candidatoId: candidato.id,
    candidatoNome: candidato.nome || '',
    indicacaoId: candidato.indicacaoId || '',
    vagaId: candidato.vagaId || '',
    vagaTitulo: candidato.vagaTitulo || '',
    indicadorId: candidato.indicadorId || candidato.indicadorUid || '',
    indicadorNome: candidato.indicadorNome || '',
    valor: valorRecompensa,
    descricao: t('payments.modal.rewardDescription', {
      job: candidato.vagaTitulo || t('payments.modal.jobFallback'),
      candidate: candidato.nome || t('payments.modal.candidateFallback')
    })
  })

  const abrirCheckoutExistente = async () => {
    setCarregando(true)

    try {
      const pagamento = await criarPagamentoRecompensa(montarDadosPagamento())
      onCreated?.(pagamento)
      const url = pagamento.sandboxInitPoint || pagamento.checkoutUrl || pagamento.initPoint

      if (!url) throw new Error('URL de checkout ausente.')

      abrirCheckout(url, toast, t)
    } catch (error) {
      console.error('Falha ao continuar o checkout:', error)
      toast.error(t('payments.modal.createError'))
    } finally {
      setCarregando(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!recompensaFixa.disponivel) {
      toast.warning(t('payments.modal.fixedRequiredWarning'))
      return
    }

    const confirmado = await confirm({
      title: t('payments.modal.confirmTitle'),
      description: valorRecompensa
        ? t('payments.modal.confirmDescription', { value: formatCurrency(valorRecompensa) })
        : t('payments.modal.confirmValidation'),
      confirmLabel: t('payments.modal.confirm'),
      cancelLabel: t('payments.modal.back'),
      tone: 'danger'
    })

    if (!confirmado) return

    setCarregando(true)

    try {
      const pagamento = await criarPagamentoRecompensa(montarDadosPagamento())

      onCreated?.(pagamento)

      const url = pagamento.sandboxInitPoint || pagamento.checkoutUrl || pagamento.initPoint
      if (url) {
        if (url.includes('sandbox.mercadopago')) {
          toast.success(t('payments.modal.sandboxCreated'))
          return
        }

        abrirCheckout(url, toast, t)
        onClose()
        return
      }

      toast.success(t('payments.modal.preferenceCreated'))
      onClose()
    } catch (error) {
      console.error('Falha ao criar o checkout:', error)
      toast.error(t('payments.modal.createError'))
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="payment-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="payment-reward-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-reward-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="payment-modal-close" onClick={onClose} aria-label={t('payments.modal.close')}>
          <FaTimes />
        </button>

        <header>
          <span><FaCreditCard /> Mercado Pago</span>
          <h2 id="payment-reward-title">{t('payments.modal.title')}</h2>
          <p>{t('payments.modal.description')}</p>
        </header>

        <div className="payment-summary">
          <div>
            <span>{t('payments.modal.candidate')}</span>
            <strong>{candidato.nome || t('profile.notProvided')}</strong>
          </div>
          <div>
            <span>{t('payments.modal.job')}</span>
            <strong>{candidato.vagaTitulo || t('payments.modal.notProvidedFemale')}</strong>
          </div>
          <div>
            <span>{t('payments.modal.referrer')}</span>
            <strong>{candidato.indicadorNome || t('profile.notProvided')}</strong>
          </div>
        </div>

        {recompensaPaga ? (
          <div className="payment-state approved">
            <strong>{t('payments.modal.paid')}</strong>
            <p>{t('payments.modal.paidDescription')}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="payment-field">
              {t('payments.modal.rewardValue')}
              <input
                value={recompensaFixa.disponivel
                  ? valorRecompensa ? formatCurrency(valorRecompensa) : t('payments.modal.validatedByJob')
                  : t('payments.modal.fixedNotDefined')}
                readOnly
                disabled={Boolean(pagamentoPendente)}
              />
            </label>

            {!recompensaFixa.disponivel && (
              <div className="payment-state blocked">
                <strong>{t('payments.modal.fixedRequired')}</strong>
                <p>{t('payments.modal.fixedRequiredWarning')}</p>
              </div>
            )}

            {recompensaFixa.disponivel && !valorRecompensa && (
              <div className="payment-state pending">
                <strong>{t('payments.modal.pendingValue')}</strong>
                <p>{t('payments.modal.pendingValueDescription')}</p>
              </div>
            )}

            {pagamentoPendente && (
              <div className="payment-state pending">
                <strong>{t('payments.modal.pendingPayment')}</strong>
                <p>{t('payments.modal.pendingPaymentDescription')}</p>
              </div>
            )}

            <div className="payment-actions">
              <button type="button" className="secondary" onClick={onClose}>
                {t('payments.modal.cancel')}
              </button>

              {pagamentoPendente ? (
                <button type="button" onClick={abrirCheckoutExistente} disabled={carregando}>
                  <FaExternalLinkAlt /> {carregando ? t('payments.modal.creating') : t('payments.continueCheckout')}
                </button>
              ) : (
                <button type="submit" disabled={carregando || !recompensaFixa.disponivel}>
                  {carregando ? t('payments.modal.creating') : t('payments.modal.title')}
                </button>
              )}
            </div>
          </form>
        )}
      </section>
    </div>
  )
}

function abrirCheckout(url, toast, t) {
  if (url.includes('sandbox.mercadopago')) {
    const checkout = window.open(url, '_blank')

    if (!checkout) {
      window.location.href = url
      return
    }

    checkout.opener = null
    toast.info(t('payments.modal.sandboxOpened'))
    return
  }

  window.location.href = url
}

function obterRecompensaFixa(candidato) {
  const tipo = String(candidato?.recompensaTipo || '').toLowerCase()

  if (tipo && tipo !== 'fixo') {
    return { disponivel: false, valor: 0 }
  }

  if (Number(candidato?.recompensaValorFixo || 0) > 0) {
    return { disponivel: true, valor: Number(candidato.recompensaValorFixo) }
  }

  const texto = String(candidato?.recompensa || '').trim()

  if (
    !texto
    || /%|percent|sal[aá]rio|combinar|consultar|a definir|sob consulta/i.test(texto)
    || !/^(r\$\s*)?\d[\d.\s]*(,\d{1,2})?$/i.test(texto)
  ) {
    return { disponivel: false, valor: 0 }
  }

  return { disponivel: true, valor: normalizarValor(texto) }
}

function normalizarValor(valor) {
  const normalizado = String(valor || '')
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')

  const numero = Number(normalizado)
  return Number.isFinite(numero) && numero > 0 ? Number(numero.toFixed(2)) : 0
}

export default ModalPagamentoRecompensa
