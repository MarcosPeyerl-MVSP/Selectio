import './styles/AdminPages.css'

import { useMemo, useState } from 'react'
import { FaBriefcase, FaClock, FaUserFriends } from 'react-icons/fa'
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
import { buscarVagasAdmin } from '../../services/firestoreAdmin'
import {
  formatDate,
  formatNumber,
  initials,
  normalizeText,
} from './adminFormatters'
import { useAdminData } from './useAdminData'
import { formatJobReward, formatJobSalary, formatJobType } from '../../i18n/domainFormatters'

function AdminVagas() {
  const { t } = useTranslation(['admin', 'common'])
  const { data, loading, error, reload } = useAdminData(buscarVagasAdmin)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('todos')
  const [selected, setSelected] = useState(null)

  const rows = useMemo(() => {
    if (!data) return []
    const term = normalizeText(search)

    return data.vagas.filter((vaga) => {
      const matchesSearch = !term || [
        vaga.titulo,
        vaga.empresa,
        vaga.empresaNome,
        vaga.area,
      ].some((value) => normalizeText(value).includes(term))
      return matchesSearch && (status === 'todos' || vaga.statusAdmin === status)
    })
  }, [data, search, status])

  if (loading) return <AdminLoading label={t('jobs.loading')} />
  if (error) return <AdminError message={error} onRetry={reload} />

  const columns = [
    {
      key: 'empresa',
      label: t('jobs.company'),
      render: (vaga) => {
        const empresa = vaga.empresa || vaga.empresaNome || t('jobs.company')
        return (
          <div className="admin-entity">
            <span className="admin-entity-avatar">{initials(empresa)}</span>
            <div><strong>{empresa}</strong><span>{vaga.area || t('jobs.areaNotProvided')}</span></div>
          </div>
        )
      },
    },
    { key: 'titulo', label: t('jobs.job'), render: (vaga) => vaga.titulo || t('jobs.untitled') },
    {
      key: 'remuneracao',
      label: t('jobs.salaryReward'),
      render: (vaga) => vaga.salario
        ? formatJobSalary(vaga, t)
        : (vaga.recompensa || vaga.recompensaValorFixo)
          ? formatJobReward(vaga, t)
          : t('common:generic.notProvided'),
    },
    { key: 'publicacao', label: t('jobs.publication'), render: (vaga) => formatDate(vaga.dataPublicacao) },
    {
      key: 'status',
      label: t('jobs.status'),
      render: (vaga) => <AdminStatusBadge status={vaga.statusAdmin} label={t(`jobs.statuses.${vaga.statusAdmin}`, { defaultValue: vaga.statusAdmin })} />,
    },
    { key: 'candidatos', label: t('jobs.candidates'), render: (vaga) => formatNumber(vaga.totalCandidatos) },
    {
      key: 'acoes',
      label: t('jobs.actions'),
      render: (vaga) => <button className="admin-table-action" type="button" onClick={() => setSelected(vaga)}>{t('jobs.viewDetails')}</button>,
    },
  ]

  return (
    <>
      <AdminPageHeader
        eyebrow={t('jobs.eyebrow')}
        title={t('jobs.title')}
        description={t('jobs.description')}
      />

      <AdminMetrics>
        <AdminMetricCard icon={FaBriefcase} label={t('jobs.total')} value={formatNumber(data.metricas.total)} />
        <AdminMetricCard icon={FaBriefcase} label={t('jobs.open')} value={formatNumber(data.metricas.abertas)} />
        <AdminMetricCard icon={FaClock} label={t('jobs.review')} value={formatNumber(data.metricas.revisao)} />
        <AdminMetricCard
          icon={FaUserFriends}
          label={t('jobs.totalCandidates')}
          value={formatNumber(data.metricas.candidatos)}
          helper={t('jobs.averageConversion', { value: data.metricas.conversao })}
          tone="primary"
        />
      </AdminMetrics>

      <AdminToolbar
        search={search}
        onSearch={setSearch}
        placeholder={t('jobs.searchPlaceholder')}
        onClear={() => { setSearch(''); setStatus('todos') }}
      >
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="todos">{t('jobs.allStatuses')}</option>
          <option value="aberta">{t('jobs.publishedPlural')}</option>
          <option value="pausada">{t('jobs.pausedPlural')}</option>
          <option value="encerrada">{t('jobs.closedPlural')}</option>
          <option value="expirada">{t('jobs.expiredPlural')}</option>
        </select>
      </AdminToolbar>

      <AdminTable
        columns={columns}
        rows={rows}
        emptyTitle={t('jobs.emptyTitle')}
        emptyDescription={t('jobs.emptyDescription')}
      />

      {selected && (
        <AdminModal title={selected.titulo || t('jobs.job')} eyebrow={t('jobs.opportunityDetails')} onClose={() => setSelected(null)}>
          <AdminDetailGrid items={[
            { label: t('jobs.company'), value: selected.empresa || selected.empresaNome },
            { label: t('jobs.area'), value: selected.area },
            { label: t('jobs.location'), value: selected.localizacao },
            { label: t('jobs.modelContract'), value: formatJobType(selected, t) },
            { label: t('jobs.salary'), value: formatJobSalary(selected, t) },
            { label: t('jobs.reward'), value: formatJobReward(selected, t) },
            { label: t('jobs.status'), value: t(`jobs.statuses.${selected.statusAdmin}`, { defaultValue: selected.statusAdmin }) },
            { label: t('jobs.candidates'), value: formatNumber(selected.totalCandidatos) },
            { label: t('jobs.publication'), value: formatDate(selected.dataPublicacao) },
            { label: t('jobs.deadline'), value: formatDate(selected.expiraEm || selected.dataLimite) },
          ]} />

          {(selected.descricaoLonga || selected.descricaoCurta) && (
            <section className="admin-modal-section">
              <h3>{t('jobs.roleDescription')}</h3>
              <p>{selected.descricaoLonga || selected.descricaoCurta}</p>
            </section>
          )}
        </AdminModal>
      )}
    </>
  )
}

export default AdminVagas
