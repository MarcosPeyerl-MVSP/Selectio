import './styles/AdminPages.css'

import { useMemo, useState } from 'react'
import { FaChartLine, FaClock, FaMoneyBillWave, FaReceipt } from 'react-icons/fa'
import { useTranslation } from 'react-i18next'

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

const pendingWithdrawalStatuses = new Set(['solicitado', 'pendente'])

function AdminFinanceiro() {
  const { t } = useTranslation(['admin', 'common'])
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

  if (loading) return <AdminLoading label={t('finance.loading')} />
  if (error) return <AdminError message={error} onRetry={reload} />

  const futureAction = () => toast.info(t('finance.futureAction'))
  const columns = [
    {
      key: 'indicador',
      label: t('finance.referrer'),
      render: (saque) => (
        <div className="admin-entity">
          <span className="admin-entity-avatar">{initials(saque.indicadorNome || t('finance.referrer'))}</span>
          <div><strong>{saque.indicadorNome || t('finance.referrer')}</strong><span>{saque.indicadorEmail || saque.indicadorId}</span></div>
        </div>
      ),
    },
    { key: 'valor', label: t('finance.value'), render: (saque) => formatCurrency(saque.valor) },
    { key: 'pix', label: t('finance.pixData'), render: (saque) => saque.chavePix || t('common:generic.notProvided') },
    {
      key: 'status',
      label: t('finance.status'),
      render: (saque) => <AdminStatusBadge status={saque.status} label={t(`common:statuses.withdrawals.${saque.status}`, { defaultValue: saque.status })} />,
    },
    { key: 'data', label: t('finance.date'), render: (saque) => formatDate(saque.dataSolicitacao) },
    {
      key: 'acoes',
      label: t('finance.action'),
      render: (saque) => (
        <button className="admin-table-action" type="button" onClick={() => setSelected(saque)}>
          {t('finance.viewDetails')}
        </button>
      ),
    },
  ]

  return (
    <>
      <AdminPageHeader
        eyebrow={t('finance.eyebrow')}
        title={t('finance.title')}
        description={t('finance.description')}
      />

      <AdminMetrics>
        <AdminMetricCard icon={FaClock} label={t('finance.totalOpen')} value={formatCurrency(data.metricas.totalEmAberto)} helper={t('finance.awaitingReview')} />
        <AdminMetricCard icon={FaMoneyBillWave} label={t('finance.paidThisMonth')} value={formatCurrency(data.metricas.totalPagoMes)} tone="primary" />
        <AdminMetricCard icon={FaChartLine} label={t('finance.efficiency')} value={`${data.metricas.eficiencia}%`} helper={t('finance.efficiencyDescription')} />
        <AdminMetricCard icon={FaReceipt} label={t('finance.pendingPayments')} value={formatNumber(data.metricas.pagamentosPendentes)} />
      </AdminMetrics>

      <AdminToolbar
        search={search}
        onSearch={setSearch}
        placeholder={t('finance.searchPlaceholder')}
        onClear={() => { setSearch(''); setStatus('todos') }}
      >
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="todos">{t('finance.allStatuses')}</option>
          <option value="pendentes">{t('finance.pendingPlural')}</option>
          <option value="em_analise">{t('finance.underReview')}</option>
          <option value="pago">{t('finance.paidPlural')}</option>
          <option value="aprovado">{t('finance.approvedPlural')}</option>
          <option value="recusado">{t('finance.rejectedPlural')}</option>
        </select>
      </AdminToolbar>

      <AdminTable
        columns={columns}
        rows={rows}
        emptyTitle={t('finance.emptyTitle')}
        emptyDescription={t('finance.emptyDescription')}
      />

      <div className="admin-finance-grid">
        <article className="admin-section-card">
          <div className="admin-section-heading">
            <div>
              <h2>{t('finance.recentPayments')}</h2>
              <span>{t('finance.latestRewards')}</span>
            </div>
          </div>
          <div className="admin-payment-list">
            {data.pagamentos.length ? data.pagamentos.map((pagamento) => (
              <article className="admin-payment-item" key={pagamento.id}>
                <div>
                  <strong>{pagamento.candidatoNome || t('finance.candidate')}</strong>
                  <span>{pagamento.vagaTitulo || t('finance.job')} • {pagamento.indicadorNome || t('finance.referrer')}</span>
                  <AdminStatusBadge status={pagamento.status} label={t(`common:statuses.payments.${pagamento.status}`, { defaultValue: pagamento.status })} />
                </div>
                <strong>{formatCurrency(pagamento.valor)}</strong>
              </article>
            )) : <p>{t('finance.noPayments')}</p>}
          </div>
        </article>

        <article className="admin-section-card">
          <div className="admin-section-heading">
            <div>
              <h2>{t('finance.safeOperations')}</h2>
              <span>{t('finance.actionsBlocked')}</span>
            </div>
          </div>
          <p>{t('finance.readOnlyDescription')}</p>
          <button className="admin-table-action" type="button" onClick={futureAction}>
            {t('finance.exportReport')}
          </button>
        </article>
      </div>

      {selected && (
        <AdminModal title={t('finance.withdrawalTitle', { name: selected.indicadorNome || t('finance.referrer') })} eyebrow={t('finance.financialRequest')} onClose={() => setSelected(null)}>
          <AdminDetailGrid items={[
            { label: t('finance.referrer'), value: selected.indicadorNome || t('finance.referrer') },
            { label: t('finance.email'), value: selected.indicadorEmail },
            { label: t('finance.value'), value: formatCurrency(selected.valor) },
            { label: t('finance.pixKey'), value: selected.chavePix },
            { label: t('finance.status'), value: t(`common:statuses.withdrawals.${selected.status}`, { defaultValue: selected.status }) },
            { label: t('finance.requestedAt'), value: formatDate(selected.dataSolicitacao) },
            { label: t('finance.note'), value: selected.observacao },
            { label: 'ID', value: selected.id },
          ]} />
          <section className="admin-modal-section">
            <button className="admin-table-action" type="button" onClick={futureAction}>
              {t('finance.markReviewed')}
            </button>
          </section>
        </AdminModal>
      )}
    </>
  )
}

export default AdminFinanceiro
