import './styles/EmpresaPagamentos.css'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FaCreditCard, FaExternalLinkAlt, FaReceipt, FaSyncAlt } from 'react-icons/fa'
import { useSearchParams } from 'react-router-dom'

import PageLoader from '../../components/ui/PageLoader'
import { useToast } from '../../hooks/useToast'
import { formatCurrency, formatDate } from '../../i18n/formatters'
import { getFirebaseUid } from '../../services/identidadeFirebase'
import { obterRetornoCheckout, limparRetornoCheckout } from '../../utils/mercadoPagoCheckout'
import {
  listarPagamentosPorEmpresa,
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
        const retorno = obterRetornoCheckout(searchParams)
        const retornoId = retorno && JSON.stringify(retorno)

        if (retorno && retornoProcessado.current !== retornoId) {
          retornoProcessado.current = retornoId
          try {
            const atualizado = await sincronizarPagamentoMercadoPago({ ...retorno, empresaId })
            if (atualizado?.status === 'approved') {
              toast.success(t(atualizado.ambiente === 'sandbox' ? 'payments.testApproved' : 'payments.approvedBalance'))
            } else if (!atualizado?.encontrado || atualizado.status === 'pending') {
              toast.warning(t('payments.stillPending'))
            } else {
              toast.error(t('payments.notApproved'))
            }
            setSearchParams(limparRetornoCheckout(searchParams), { replace: true })
          } catch {
            // A falha na consulta do provedor nao deve esconder o historico.
            retornoProcessado.current = ''
            toast.warning(t('payments.returnSyncError'))
          }
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

      if (resultado?.checkoutReparado) {
        toast.success(t('payments.checkoutRepaired'))
      } else if (!resultado?.encontrado) {
        toast.info(t('payments.noUpdate'))
      } else if (resultado.status === 'approved') {
        toast.success(t(resultado.ambiente === 'sandbox' ? 'payments.testApproved' : 'payments.approvedBalance'))
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

              {['created', 'pending'].includes(pagamento.status) && (
                <div className="empresa-pagamento-acoes">
                  {obterCheckoutUrlPagamento(pagamento) && (
                    <a
                      href={obterCheckoutUrlPagamento(pagamento)}
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
