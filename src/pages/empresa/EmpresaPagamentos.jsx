import './styles/EmpresaPagamentos.css'

import { useEffect, useMemo, useState } from 'react'
import { FaCreditCard, FaExternalLinkAlt, FaReceipt } from 'react-icons/fa'

import PageLoader from '../../components/ui/PageLoader'
import { useToast } from '../../hooks/useToast'
import { getFirebaseUid } from '../../services/firebaseIdentity'
import { listarPagamentosPorEmpresa } from '../../services/firestorePagamentos'

const statusLabels = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Recusado',
  cancelled: 'Cancelado',
  refunded: 'Estornado',
  failed: 'Falhou'
}

function EmpresaPagamentos({ empresa }) {
  const toast = useToast()
  const empresaId = getFirebaseUid(empresa)
  const [pagamentos, setPagamentos] = useState([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true

    const carregarPagamentos = async () => {
      if (!empresaId) {
        setCarregando(false)
        return
      }

      try {
        const dados = await listarPagamentosPorEmpresa(empresaId)
        if (ativo) setPagamentos(dados)
      } catch (error) {
        toast.error(error.message || 'Nao foi possivel carregar pagamentos.')
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregarPagamentos()

    return () => {
      ativo = false
    }
  }, [empresaId, toast])

  const metricas = useMemo(() => ({
    totalCriado: pagamentos.reduce((soma, pagamento) => soma + Number(pagamento.valor || 0), 0),
    totalAprovado: pagamentos
      .filter((pagamento) => pagamento.status === 'approved')
      .reduce((soma, pagamento) => soma + Number(pagamento.valor || 0), 0),
    totalPendente: pagamentos
      .filter((pagamento) => pagamento.status === 'pending')
      .reduce((soma, pagamento) => soma + Number(pagamento.valor || 0), 0)
  }), [pagamentos])

  if (carregando) return <PageLoader label="Carregando pagamentos..." compact />

  return (
    <section className="empresa-pagamentos">
      <header className="empresa-pagamentos-header">
        <span>Financeiro da empresa</span>
        <h1>Pagamentos de recompensas</h1>
        <p>Acompanhe recompensas pagas, pendentes e aprovadas para indicadores vinculados aos candidatos contratados.</p>
      </header>

      <section className="empresa-pagamentos-metricas">
        <MetricCard label="Volume aprovado" value={formatCurrency(metricas.totalAprovado)} />
        <MetricCard label="Volume pendente" value={formatCurrency(metricas.totalPendente)} />
        <MetricCard label="Total criado" value={formatCurrency(metricas.totalCriado)} />
      </section>

      <article className="empresa-pagamentos-lista">
        <div className="empresa-pagamentos-lista-header">
          <span><FaReceipt /> Historico</span>
          <strong>{pagamentos.length}</strong>
        </div>

        {pagamentos.length ? (
          pagamentos.map((pagamento) => (
            <div className="empresa-pagamento-item" key={pagamento.id}>
              <div>
                <strong>{pagamento.candidatoNome || 'Candidato'}</strong>
                <span>{pagamento.vagaTitulo || 'Vaga nao informada'} - {pagamento.indicadorNome || 'Indicador'}</span>
              </div>

              <div className="empresa-pagamento-meta">
                <strong>{formatCurrency(pagamento.valor)}</strong>
                <span className={`empresa-pagamento-status ${pagamento.status}`}>
                  {statusLabels[pagamento.status] || pagamento.status}
                </span>
              </div>

              {pagamento.status === 'pending' && (pagamento.checkoutUrl || pagamento.sandboxCheckoutUrl) && (
                <a href={pagamento.checkoutUrl || pagamento.sandboxCheckoutUrl}>
                  <FaExternalLinkAlt /> Continuar checkout
                </a>
              )}
            </div>
          ))
        ) : (
          <div className="empresa-pagamentos-vazio">
            <FaCreditCard />
            <strong>Nenhum pagamento criado</strong>
            <p>Quando uma recompensa for paga para um candidato contratado, ela aparecera aqui.</p>
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

export default EmpresaPagamentos
