import './styles/AdminPages.css'

import { useMemo, useState } from 'react'
import { FaCheckCircle, FaMoneyBillWave, FaUserCheck, FaUserTie } from 'react-icons/fa'
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
import { buscarIndicadoresAdmin } from '../../services/firestoreAdmin'
import {
  formatCurrency,
  formatDate,
  formatNumber,
  initials,
  normalizeText,
} from './adminFormatters'
import { useAdminData } from './useAdminData'

function AdminIndicadores() {
  const { t } = useTranslation(['admin', 'common'])
  const { data, loading, error, reload } = useAdminData(buscarIndicadoresAdmin)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('todos')
  const [performance, setPerformance] = useState('todos')
  const [selected, setSelected] = useState(null)

  const rows = useMemo(() => {
    if (!data) return []
    const term = normalizeText(search)

    return data.indicadores.filter((indicador) => {
      const matchesSearch = !term || [indicador.nome, indicador.email, indicador.cpf]
        .some((value) => normalizeText(value).includes(term))
      const matchesStatus = status === 'todos' || indicador.statusAdmin === status
      const matchesPerformance = performance === 'todos'
        || (performance === 'com-contratacao' && indicador.totalContratacoes > 0)
        || (performance === 'sem-indicacao' && indicador.totalIndicacoes === 0)
      return matchesSearch && matchesStatus && matchesPerformance
    })
  }, [data, performance, search, status])

  if (loading) return <AdminLoading label={t('referrers.loading')} />
  if (error) return <AdminError message={error} onRetry={reload} />

  const columns = [
    {
      key: 'indicador',
      label: t('referrers.referrer'),
      render: (indicador) => (
        <div className="admin-entity">
          <span className="admin-entity-avatar">{initials(indicador.nome || t('referrers.referrer'))}</span>
          <div><strong>{indicador.nome || t('referrers.referrer')}</strong><span>{indicador.especialidades || t('referrers.talentNetwork')}</span></div>
        </div>
      ),
    },
    { key: 'email', label: t('referrers.email'), render: (indicador) => indicador.email || t('common:generic.notProvided') },
    { key: 'indicacoes', label: t('referrers.referrals'), render: (indicador) => formatNumber(indicador.totalIndicacoes) },
    { key: 'contratacoes', label: t('referrers.hires'), render: (indicador) => formatNumber(indicador.totalContratacoes) },
    { key: 'ganhos', label: t('referrers.earnings'), render: (indicador) => formatCurrency(indicador.ganhos) },
    {
      key: 'status',
      label: t('referrers.status'),
      render: (indicador) => <AdminStatusBadge status={indicador.statusAdmin} label={t(`common:statuses.profiles.${indicador.statusAdmin}`, { defaultValue: indicador.statusAdmin })} />,
    },
    { key: 'data', label: t('referrers.registration'), render: (indicador) => formatDate(indicador.dataCadastro) },
    {
      key: 'acoes',
      label: t('referrers.actions'),
      render: (indicador) => <button className="admin-table-action" type="button" onClick={() => setSelected(indicador)}>{t('referrers.viewProfile')}</button>,
    },
  ]

  return (
    <>
      <AdminPageHeader
        eyebrow={t('referrers.eyebrow')}
        title={t('referrers.title')}
        description={t('referrers.description')}
      />

      <AdminMetrics>
        <AdminMetricCard icon={FaUserTie} label={t('referrers.total')} value={formatNumber(data.metricas.total)} />
        <AdminMetricCard icon={FaUserCheck} label={t('referrers.active')} value={formatNumber(data.metricas.ativos)} />
        <AdminMetricCard icon={FaCheckCircle} label={t('referrers.totalReferrals')} value={formatNumber(data.metricas.indicacoes)} />
        <AdminMetricCard
          icon={FaMoneyBillWave}
          label={t('referrers.accumulatedRewards')}
          value={formatCurrency(data.metricas.premiacoes)}
          helper={t('referrers.hireCount', { count: data.metricas.contratacoes })}
          tone="primary"
        />
      </AdminMetrics>

      <AdminToolbar
        search={search}
        onSearch={setSearch}
        placeholder={t('referrers.searchPlaceholder')}
        onClear={() => { setSearch(''); setStatus('todos'); setPerformance('todos') }}
      >
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="todos">{t('referrers.allStatuses')}</option>
          <option value="ativo">{t('referrers.activePlural')}</option>
          <option value="inativo">{t('referrers.inactivePlural')}</option>
        </select>
        <select value={performance} onChange={(event) => setPerformance(event.target.value)}>
          <option value="todos">{t('referrers.allPerformance')}</option>
          <option value="com-contratacao">{t('referrers.withHire')}</option>
          <option value="sem-indicacao">{t('referrers.withoutReferral')}</option>
        </select>
      </AdminToolbar>

      <AdminTable
        columns={columns}
        rows={rows}
        emptyTitle={t('referrers.emptyTitle')}
        emptyDescription={t('referrers.emptyDescription')}
      />

      {selected && (
        <AdminModal title={selected.nome || t('referrers.referrer')} eyebrow={t('referrers.profile')} onClose={() => setSelected(null)}>
          <AdminDetailGrid items={[
            { label: t('referrers.email'), value: selected.email },
            { label: t('referrers.phone'), value: selected.telefone },
            { label: t('referrers.cpf'), value: selected.cpf },
            { label: t('referrers.pix'), value: selected.pix },
            { label: t('referrers.linkedin'), value: selected.linkedin },
            { label: t('referrers.specialties'), value: selected.especialidades },
            { label: t('referrers.totalReferrals'), value: formatNumber(selected.totalIndicacoes) },
            { label: t('referrers.hires'), value: formatNumber(selected.totalContratacoes) },
            { label: t('referrers.approvedEarnings'), value: formatCurrency(selected.ganhos) },
            { label: t('referrers.availableBalance'), value: formatCurrency(selected.saldoDisponivel) },
          ]} />

          <section className="admin-modal-section">
            <h3>{t('referrers.latestReferrals')}</h3>
            <div className="admin-mini-list">
              {selected.ultimasIndicacoes.length ? selected.ultimasIndicacoes.map((candidato) => (
                <article key={candidato.id}>
                  <div>
                    <strong>{candidato.nome || t('referrers.candidate')}</strong>
                    <span>{candidato.vagaTitulo || t('referrers.jobNotProvided')}</span>
                  </div>
                  <AdminStatusBadge status={candidato.status} label={t(`common:statuses.candidates.${candidato.status}`, { defaultValue: candidato.status })} />
                </article>
              )) : <span>{t('referrers.noReferrals')}</span>}
            </div>
          </section>
        </AdminModal>
      )}
    </>
  )
}

export default AdminIndicadores
