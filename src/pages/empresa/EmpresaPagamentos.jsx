import './styles/EmpresaPagamentos.css'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FaCreditCard, FaExternalLinkAlt, FaReceipt, FaSyncAlt } from 'react-icons/fa'
import { useSearchParams } from 'react-router-dom'

import PageLoader from '../../components/ui/PageLoader'
import { useToast } from '../../hooks/useToast'
import { formatCurrency, formatDate } from '../../i18n/formatters'
import { getFirebaseUid } from '../../services/identidadeFirebase'
import {
  listarPagamentosPorEmpresa,
  obterMercadoPagoBackendUrl,
  obterCheckoutUrlPagamento,
  sincronizarPagamentoMercadoPago
} from '../../services/firestorePagamentos'

function EmpresaPagamentos({ empresa }) {
  const { t } = useTranslation(['company', 'common'])
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const empresaId = getFirebaseUid(empresa)
  const [pagamentos, setPagamentos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [sincronizandoId, setSincronizandoId] = useState('')
  const retornoProcessado = useRef('')
  const backendUrl = obterMercadoPagoBackendUrl()
  const formatDateTime = (value) => formatDate(value, {
    dateStyle: 'short',
    timeStyle: 'short'
  }) || t('payments.notProvided')

  useEffect(() => {
    let ativo = true

    const carregarPagamentos = async () => {
      if (!empresaId) {
        setCarregando(false)
        return
      }

      try {
        const paymentId = searchParams.get('payment_id') || searchParams.get('collection_id')

        if (paymentId && retornoProcessado.current !== paymentId) {
          retornoProcessado.current = paymentId
          const pagamentoAtualizado = await sincronizarPagamentoMercadoPago({ paymentId, empresaId })

          if (pagamentoAtualizado?.status === 'approved') {
            toast.success(t('payments.testApproved'))
          } else if (pagamentoAtualizado?.status === 'pending') {
            toast.warning(t('payments.stillPending'))
          } else {
            toast.error(t('payments.notApproved'))
          }

          const parametrosLimpos = new URLSearchParams(searchParams)
          ;[
            'collection_id',
            'collection_status',
            'external_reference',
            'merchant_order_id',
            'payment_id',
            'payment_type',
            'preference_id',
            'site_id',
            'status'
          ].forEach((parametro) => parametrosLimpos.delete(parametro))
          setSearchParams(parametrosLimpos, { replace: true })
        }

        const dados = await listarPagamentosPorEmpresa(empresaId)
        if (ativo) setPagamentos(dados)
      } catch {
        toast.error(t('payments.loadError'))
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregarPagamentos()

    return () => {
      ativo = false
    }
  }, [empresaId, searchParams, setSearchParams, t, toast])

  const metricas = useMemo(() => ({
    totalCriado: pagamentos.reduce((soma, pagamento) => soma + Number(pagamento.valor || 0), 0),
    totalAprovado: pagamentos
      .filter((pagamento) => pagamento.status === 'approved')
      .reduce((soma, pagamento) => soma + Number(pagamento.valor || 0), 0),
    totalPendente: pagamentos
      .filter((pagamento) => pagamento.status === 'pending')
      .reduce((soma, pagamento) => soma + Number(pagamento.valor || 0), 0)
  }), [pagamentos])

  const atualizarStatusPagamento = async (pagamento) => {
    setSincronizandoId(pagamento.id)

    try {
      const resultado = await sincronizarPagamentoMercadoPago({
        pagamentoId: pagamento.id,
        preferenceId: pagamento.mercadoPagoPreferenceId,
        empresaId
      })

      if (resultado?.status === 'approved') {
        toast.success(t('payments.approvedBalance'))
      } else if (resultado?.status === 'pending') {
        toast.warning(t('payments.stillPending'))
      } else if (resultado?.status) {
        toast.error(t('payments.statusResult', {
          status: t(`common:statuses.payments.${resultado.status}`, { defaultValue: resultado.status }).toLowerCase()
        }))
      } else {
        toast.info(t('payments.noUpdate'))
      }

      const dados = await listarPagamentosPorEmpresa(empresaId)
      setPagamentos(dados)
    } catch {
      toast.error(t('payments.updateError'))
    } finally {
      setSincronizandoId('')
    }
  }

  if (carregando) return <PageLoader label={t('payments.loading')} compact />

  return (
    <section className="empresa-pagamentos">
      <header className="empresa-pagamentos-header">
        <span>{t('payments.eyebrow')}</span>
        <h1>{t('payments.title')}</h1>
        <p>{t('payments.description')}</p>
        <div className="empresa-pagamentos-env">
          <strong>{t('payments.localEnvironment')}</strong>
          <span>{backendUrl || t('payments.backendNotConfigured')}</span>
        </div>
      </header>

      <section className="empresa-pagamentos-metricas">
        <MetricCard label={t('payments.approvedVolume')} value={formatCurrency(metricas.totalAprovado)} />
        <MetricCard label={t('payments.pendingVolume')} value={formatCurrency(metricas.totalPendente)} />
        <MetricCard label={t('payments.totalCreated')} value={formatCurrency(metricas.totalCriado)} />
      </section>

      <article className="empresa-pagamentos-lista">
        <div className="empresa-pagamentos-lista-header">
          <span><FaReceipt /> {t('payments.history')}</span>
          <strong>{pagamentos.length}</strong>
        </div>

        {pagamentos.length ? (
          pagamentos.map((pagamento) => (
            <div className="empresa-pagamento-item" key={pagamento.id}>
              <div>
                <strong>{pagamento.candidatoNome || t('payments.candidate')}</strong>
                <span>{pagamento.vagaTitulo || t('payments.jobNotProvided')} - {pagamento.indicadorNome || t('payments.referrer')}</span>
                <small>{t('payments.createdAt', { date: formatDateTime(pagamento.criadoEm) })}</small>
                {pagamento.transacaoEm && (
                  <small>{t('payments.transactionAt', { date: formatDateTime(pagamento.transacaoEm) })}</small>
                )}
                {pagamento.encerradoEm && (
                  <small>{t('payments.closedAt', { date: formatDateTime(pagamento.encerradoEm) })}</small>
                )}
              </div>

              <div className="empresa-pagamento-meta">
                <strong>{formatCurrency(pagamento.valor)}</strong>
                <span className={`empresa-pagamento-status ${pagamento.status}`}>
                  {t(`common:statuses.payments.${pagamento.status}`, { defaultValue: pagamento.status })}
                </span>
              </div>

              {pagamento.status === 'pending' && (
                <div className="empresa-pagamento-acoes">
                  {obterCheckoutUrlPagamento(pagamento) && (
                    <a
                      href={obterCheckoutUrlPagamento(pagamento)}
                      target={obterCheckoutUrlPagamento(pagamento).includes('sandbox.mercadopago') ? '_blank' : undefined}
                      rel="noreferrer"
                    >
                      <FaExternalLinkAlt /> {t('payments.continueCheckout')}
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => atualizarStatusPagamento(pagamento)}
                    disabled={sincronizandoId === pagamento.id}
                  >
                    <FaSyncAlt /> {sincronizandoId === pagamento.id ? t('payments.updating') : t('payments.updateStatus')}
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="empresa-pagamentos-vazio">
            <FaCreditCard />
            <strong>{t('payments.emptyTitle')}</strong>
            <p>{t('payments.emptyDescription')}</p>
          </div>
        )}
      </article>
    </section>
  )
}

function MetricCard({ label, value }) {
  return (
    <div className="empresa-pagamentos-metrica">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export default EmpresaPagamentos
