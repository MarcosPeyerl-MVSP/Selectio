import './styles/EmpresaPagamentos.css'

import { useEffect, useMemo, useRef, useState } from 'react'
import { FaCreditCard, FaExternalLinkAlt, FaReceipt, FaSyncAlt } from 'react-icons/fa'
import { useSearchParams } from 'react-router-dom'

import PageLoader from '../../components/ui/PageLoader'
import { useToast } from '../../hooks/useToast'
import { getFirebaseUid } from '../../services/identidadeFirebase'
import {
  listarPagamentosPorEmpresa,
  obterMercadoPagoBackendUrl,
  obterCheckoutUrlPagamento,
  sincronizarPagamentoMercadoPago
} from '../../services/firestorePagamentos'

const statusLabels = {
  created: 'Criado',
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Recusado',
  cancelled: 'Cancelado',
  refunded: 'Estornado',
  failed: 'Falhou'
}

function EmpresaPagamentos({ empresa }) {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const empresaId = getFirebaseUid(empresa)
  const [pagamentos, setPagamentos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [sincronizandoId, setSincronizandoId] = useState('')
  const retornoProcessado = useRef('')
  const backendUrl = obterMercadoPagoBackendUrl()

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
            toast.success('Pagamento de teste aprovado e transação atualizada.')
          } else if (pagamentoAtualizado?.status === 'pending') {
            toast.warning('Pagamento ainda pendente no Mercado Pago.')
          } else {
            toast.error('O pagamento não foi aprovado pelo Mercado Pago.')
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
      } catch (error) {
        toast.error(error.message || 'Não foi possível carregar pagamentos.')
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregarPagamentos()

    return () => {
      ativo = false
    }
  }, [empresaId, searchParams, setSearchParams, toast])

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
        toast.success('Pagamento aprovado e saldo do indicador atualizado.')
      } else if (resultado?.status === 'pending') {
        toast.warning('Pagamento ainda pendente no Mercado Pago.')
      } else if (resultado?.status) {
        toast.error(`Pagamento ${statusLabels[resultado.status]?.toLowerCase() || resultado.status}.`)
      } else {
        toast.info('Nenhuma atualização encontrada para este pagamento.')
      }

      const dados = await listarPagamentosPorEmpresa(empresaId)
      setPagamentos(dados)
    } catch (error) {
      toast.error(error.message || 'Não foi possível atualizar o pagamento.')
    } finally {
      setSincronizandoId('')
    }
  }

  if (carregando) return <PageLoader label="Carregando pagamentos..." compact />

  return (
    <section className="empresa-pagamentos">
      <header className="empresa-pagamentos-header">
        <span>Financeiro da empresa</span>
        <h1>Pagamentos de recompensas</h1>
        <p>Acompanhe recompensas pagas, pendentes e aprovadas para indicadores vinculados aos candidatos contratados.</p>
        <div className="empresa-pagamentos-env">
          <strong>Ambiente local Mercado Pago</strong>
          <span>{backendUrl || 'VITE_MERCADO_PAGO_SANDBOX_URL não configurado'}</span>
        </div>
      </header>

      <section className="empresa-pagamentos-metricas">
        <MetricCard label="Volume aprovado" value={formatCurrency(metricas.totalAprovado)} />
        <MetricCard label="Volume pendente" value={formatCurrency(metricas.totalPendente)} />
        <MetricCard label="Total criado" value={formatCurrency(metricas.totalCriado)} />
      </section>

      <article className="empresa-pagamentos-lista">
        <div className="empresa-pagamentos-lista-header">
          <span><FaReceipt /> Histórico</span>
          <strong>{pagamentos.length}</strong>
        </div>

        {pagamentos.length ? (
          pagamentos.map((pagamento) => (
            <div className="empresa-pagamento-item" key={pagamento.id}>
              <div>
                <strong>{pagamento.candidatoNome || 'Candidato'}</strong>
                <span>{pagamento.vagaTitulo || 'Vaga não informada'} - {pagamento.indicadorNome || 'Indicador'}</span>
                <small>Criado em {formatDateTime(pagamento.criadoEm)}</small>
                {pagamento.transacaoEm && (
                  <small>Transação em {formatDateTime(pagamento.transacaoEm)}</small>
                )}
                {pagamento.encerradoEm && (
                  <small>Encerrado em {formatDateTime(pagamento.encerradoEm)}</small>
                )}
              </div>

              <div className="empresa-pagamento-meta">
                <strong>{formatCurrency(pagamento.valor)}</strong>
                <span className={`empresa-pagamento-status ${pagamento.status}`}>
                  {statusLabels[pagamento.status] || pagamento.status}
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
                      <FaExternalLinkAlt /> Continuar checkout
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => atualizarStatusPagamento(pagamento)}
                    disabled={sincronizandoId === pagamento.id}
                  >
                    <FaSyncAlt /> {sincronizandoId === pagamento.id ? 'Atualizando...' : 'Atualizar status'}
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="empresa-pagamentos-vazio">
            <FaCreditCard />
            <strong>Nenhum pagamento criado</strong>
            <p>Quando uma recompensa for paga para um candidato contratado, ela aparecerá aqui.</p>
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

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

function formatDateTime(value) {
  if (!value) return 'não informado'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'não informado'

  return date.toLocaleString('pt-BR')
}

export default EmpresaPagamentos
