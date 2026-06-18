import './styles/AdminPages.css'

import { useMemo, useState } from 'react'
import { FaChartLine, FaClock, FaMoneyBillWave, FaReceipt } from 'react-icons/fa'

import {
  AdminDetailGrid,
  AdminError,
  AdminLoading,
  AdminMetricCard,
  AdminMetrics,
  AdminModal,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTable,
  AdminToolbar,
} from '../../components/admin/AdminUI'
import { useToast } from '../../hooks/useToast'
import { buscarFinanceiroAdmin } from '../../services/firestoreAdmin'
import {
  formatCurrency,
  formatDate,
  formatNumber,
  initials,
  normalizeText,
} from './adminFormatters'
import { useAdminData } from './useAdminData'

const withdrawalStatusLabels = {
  solicitado: 'Pendente',
  pendente: 'Pendente',
  em_analise: 'Em análise',
  pago: 'Pago',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
  erro: 'Erro',
}

const pendingWithdrawalStatuses = new Set(['solicitado', 'pendente'])

function AdminFinanceiro() {
  const toast = useToast()
  const { data, loading, error, reload } = useAdminData(buscarFinanceiroAdmin)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('todos')
  const [selected, setSelected] = useState(null)

  const rows = useMemo(() => {
    if (!data) return []
    const term = normalizeText(search)

    return data.saques.filter((saque) => {
      const matchesSearch = !term || [
        saque.indicadorNome,
        saque.indicadorEmail,
        saque.chavePix,
      ].some((value) => normalizeText(value).includes(term))
      const matchesStatus = status === 'todos'
        || (status === 'pendentes' && pendingWithdrawalStatuses.has(saque.status))
        || saque.status === status

      return matchesSearch && matchesStatus
    })
  }, [data, search, status])

  if (loading) return <AdminLoading label="Carregando financeiro global..." />
  if (error) return <AdminError message={error} onRetry={reload} />

  const futureAction = () => toast.info('Ação financeira disponível em uma versão futura. Nenhuma alteração foi realizada.')
  const columns = [
    {
      key: 'indicador',
      label: 'Indicador',
      render: (saque) => (
        <div className="admin-entity">
          <span className="admin-entity-avatar">{initials(saque.indicadorNome)}</span>
          <div><strong>{saque.indicadorNome}</strong><span>{saque.indicadorEmail || saque.indicadorId}</span></div>
        </div>
      ),
    },
    { key: 'valor', label: 'Valor', render: (saque) => formatCurrency(saque.valor) },
    { key: 'pix', label: 'Dados Pix', render: (saque) => saque.chavePix || 'Não informado' },
    {
      key: 'status',
      label: 'Status',
      render: (saque) => <AdminStatusBadge status={saque.status} label={withdrawalStatusLabels[saque.status] || saque.status} />,
    },
    { key: 'data', label: 'Data', render: (saque) => formatDate(saque.dataSolicitacao) },
    {
      key: 'acoes',
      label: 'Ação',
      render: (saque) => (
        <button className="admin-table-action" type="button" onClick={() => setSelected(saque)}>
          Ver detalhes
        </button>
      ),
    },
  ]

  return (
    <>
      <AdminPageHeader
        eyebrow="Gestão de payouts • Somente leitura"
        title="Financeiro"
        description="Acompanhe pagamentos, solicitações de saque e a eficiência do fluxo financeiro sem executar payouts automáticos."
      />

      <AdminMetrics>
        <AdminMetricCard icon={FaClock} label="Total em aberto" value={formatCurrency(data.metricas.totalEmAberto)} helper="Saques aguardando análise" />
        <AdminMetricCard icon={FaMoneyBillWave} label="Pago no mês" value={formatCurrency(data.metricas.totalPagoMes)} tone="primary" />
        <AdminMetricCard icon={FaChartLine} label="Eficiência" value={`${data.metricas.eficiencia}%`} helper="Aprovados entre pagamentos encerrados" />
        <AdminMetricCard icon={FaReceipt} label="Pagamentos pendentes" value={formatNumber(data.metricas.pagamentosPendentes)} />
      </AdminMetrics>

      <AdminToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Filtrar por indicador ou chave Pix..."
        onClear={() => { setSearch(''); setStatus('todos') }}
      >
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="todos">Todos os status</option>
          <option value="pendentes">Pendentes</option>
          <option value="em_analise">Em análise</option>
          <option value="pago">Pagos</option>
          <option value="aprovado">Aprovados</option>
          <option value="recusado">Recusados</option>
        </select>
      </AdminToolbar>

      <AdminTable
        columns={columns}
        rows={rows}
        emptyTitle="Nenhuma solicitação de saque"
        emptyDescription="Solicitações feitas por indicadores aparecerão aqui."
      />

      <div className="admin-finance-grid">
        <article className="admin-section-card">
          <div className="admin-section-heading">
            <div>
              <h2>Pagamentos recentes</h2>
              <span>Últimos registros de recompensas</span>
            </div>
          </div>
          <div className="admin-payment-list">
            {data.pagamentos.length ? data.pagamentos.map((pagamento) => (
              <article className="admin-payment-item" key={pagamento.id}>
                <div>
                  <strong>{pagamento.candidatoNome || 'Candidato'}</strong>
                  <span>{pagamento.vagaTitulo || 'Vaga'} • {pagamento.indicadorNome || 'Indicador'}</span>
                  <AdminStatusBadge status={pagamento.status} label={pagamento.status} />
                </div>
                <strong>{formatCurrency(pagamento.valor)}</strong>
              </article>
            )) : <p>Nenhum pagamento registrado.</p>}
          </div>
        </article>

        <article className="admin-section-card">
          <div className="admin-section-heading">
            <div>
              <h2>Operações seguras</h2>
              <span>Ações financeiras estão bloqueadas</span>
            </div>
          </div>
          <p>Nenhum payout ou saldo pode ser alterado por esta interface administrativa.</p>
          <button className="admin-table-action" type="button" onClick={futureAction}>
            Exportar relatório
          </button>
        </article>
      </div>

      {selected && (
        <AdminModal title={`Saque de ${selected.indicadorNome}`} eyebrow="Solicitação financeira" onClose={() => setSelected(null)}>
          <AdminDetailGrid items={[
            { label: 'Indicador', value: selected.indicadorNome },
            { label: 'E-mail', value: selected.indicadorEmail },
            { label: 'Valor', value: formatCurrency(selected.valor) },
            { label: 'Chave Pix', value: selected.chavePix },
            { label: 'Status', value: withdrawalStatusLabels[selected.status] || selected.status },
            { label: 'Solicitado em', value: formatDate(selected.dataSolicitacao) },
            { label: 'Observação', value: selected.observacao },
            { label: 'ID', value: selected.id },
          ]} />
          <section className="admin-modal-section">
            <button className="admin-table-action" type="button" onClick={futureAction}>
              Marcar como analisado
            </button>
          </section>
        </AdminModal>
      )}
    </>
  )
}

export default AdminFinanceiro
