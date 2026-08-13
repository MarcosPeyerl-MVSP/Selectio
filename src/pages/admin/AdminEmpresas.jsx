import './styles/AdminPages.css'

import { useMemo, useState } from 'react'
import { FaBriefcase, FaBuilding, FaCalendarPlus, FaUserFriends } from 'react-icons/fa'
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
import { buscarEmpresasAdmin } from '../../services/firestoreAdmin'
import { formatDate, formatNumber, initials, normalizeText } from './adminFormatters'
import { useAdminData } from './useAdminData'
import { formatCompanyIndustry, formatCompanySize } from '../../i18n/domainFormatters'

function AdminEmpresas() {
  const { t } = useTranslation(['admin', 'common'])
  const { data, loading, error, reload } = useAdminData(buscarEmpresasAdmin)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('todos')
  const [selected, setSelected] = useState(null)

  const rows = useMemo(() => {
    if (!data) return []
    const term = normalizeText(search)

    return data.empresas.filter((empresa) => {
      const matchesSearch = !term || [
        empresa.nome,
        empresa.email,
        empresa.cnpj,
        empresa.setor,
      ].some((value) => normalizeText(value).includes(term))
      const matchesStatus = status === 'todos' || empresa.statusAdmin === status
      return matchesSearch && matchesStatus
    })
  }, [data, search, status])

  if (loading) return <AdminLoading label={t('companies.loading')} />
  if (error) return <AdminError message={error} onRetry={reload} />

  const columns = [
    {
      key: 'empresa',
      label: t('companies.company'),
      render: (empresa) => (
        <div className="admin-entity">
          <span className="admin-entity-avatar">{initials(empresa.nome || t('companies.company'))}</span>
          <div><strong>{empresa.nome || t('companies.company')}</strong><span>{formatCompanyIndustry(empresa.setor, t) || empresa.cnpj || t('companies.businessRegistration')}</span></div>
        </div>
      ),
    },
    { key: 'email', label: t('companies.ownerEmail'), render: (empresa) => empresa.email || t('common:generic.notProvided') },
    { key: 'vagas', label: t('companies.jobs'), render: (empresa) => formatNumber(empresa.totalVagas) },
    { key: 'candidatos', label: t('companies.receivedCandidates'), render: (empresa) => formatNumber(empresa.totalCandidatos) },
    {
      key: 'status',
      label: t('companies.status'),
      render: (empresa) => <AdminStatusBadge status={empresa.statusAdmin} label={t(`common:statuses.profiles.${empresa.statusAdmin}`, { defaultValue: empresa.statusAdmin })} />,
    },
    { key: 'data', label: t('companies.registration'), render: (empresa) => formatDate(empresa.dataCadastro) },
    {
      key: 'acoes',
      label: t('companies.actions'),
      render: (empresa) => <button className="admin-table-action" type="button" onClick={() => setSelected(empresa)}>{t('companies.viewDetails')}</button>,
    },
  ]

  return (
    <>
      <AdminPageHeader
        eyebrow={t('companies.eyebrow')}
        title={t('companies.title')}
        description={t('companies.description')}
      />

      <AdminMetrics>
        <AdminMetricCard icon={FaBuilding} label={t('companies.totalCompanies')} value={formatNumber(data.metricas.total)} />
        <AdminMetricCard icon={FaUserFriends} label={t('companies.activeCompanies')} value={formatNumber(data.metricas.ativas)} />
        <AdminMetricCard icon={FaCalendarPlus} label={t('companies.newThisMonth')} value={formatNumber(data.metricas.novasNoMes)} />
        <AdminMetricCard icon={FaBriefcase} label={t('companies.publishedJobs')} value={formatNumber(data.metricas.vagasPublicadas)} tone="primary" />
      </AdminMetrics>

      <AdminToolbar
        search={search}
        onSearch={setSearch}
        placeholder={t('companies.searchPlaceholder')}
        onClear={() => { setSearch(''); setStatus('todos') }}
      >
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="todos">{t('companies.allStatuses')}</option>
          <option value="ativo">{t('companies.active')}</option>
          <option value="inativo">{t('companies.inactive')}</option>
          <option value="bloqueado">{t('companies.blocked')}</option>
        </select>
      </AdminToolbar>

      <AdminTable
        columns={columns}
        rows={rows}
        emptyTitle={t('companies.emptyTitle')}
        emptyDescription={t('companies.emptyDescription')}
      />

      {selected && (
        <AdminModal title={selected.nome || t('companies.company')} eyebrow={t('companies.registeredCompany')} onClose={() => setSelected(null)}>
          <AdminDetailGrid items={[
            { label: t('companies.email'), value: selected.email },
            { label: t('companies.cnpj'), value: selected.cnpj },
            { label: t('companies.phone'), value: selected.telefone },
            { label: t('companies.sector'), value: formatCompanyIndustry(selected.setor, t) },
            { label: t('companies.size'), value: formatCompanySize(selected.tamanho, t) },
            { label: t('companies.website'), value: selected.site },
            { label: t('companies.address'), value: selected.endereco },
            { label: t('companies.registration'), value: formatDate(selected.dataCadastro) },
            { label: t('companies.publishedJobs'), value: formatNumber(selected.totalVagas) },
            { label: t('companies.receivedCandidates'), value: formatNumber(selected.totalCandidatos) },
          ]} />
        </AdminModal>
      )}
    </>
  )
}

export default AdminEmpresas
