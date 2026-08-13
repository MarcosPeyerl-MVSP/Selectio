import './styles/AdminPages.css'

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  AdminDetailGrid,
  AdminError,
  AdminLoading,
  AdminModal,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTable,
  AdminToolbar,
} from '../../components/admin/AdminUI'
import { buscarCandidatosAdmin } from '../../services/firestoreAdmin'
import { formatDate, formatNumber, initials, normalizeText } from './adminFormatters'
import { useAdminData } from './useAdminData'

function AdminCandidatos() {
  const { t } = useTranslation(['admin', 'common'])
  const { data, loading, error, reload } = useAdminData(buscarCandidatosAdmin)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('todos')
  const [vaga, setVaga] = useState('todas')
  const [period, setPeriod] = useState('todos')
  const [selected, setSelected] = useState(null)

  const rows = useMemo(() => {
    if (!data) return []
    const term = normalizeText(search)
    const now = new Date(data.geradoEm).getTime()
    const periodDays = period === '7' ? 7 : period === '30' ? 30 : null

    return data.candidatos.filter((candidato) => {
      const matchesSearch = !term || [
        candidato.nome,
        candidato.email,
        candidato.vagaTitulo,
        candidato.indicadorNome,
      ].some((value) => normalizeText(value).includes(term))
      const matchesStatus = status === 'todos' || candidato.status === status
      const matchesVaga = vaga === 'todas' || candidato.vagaTitulo === vaga
      const date = new Date(candidato.dataIndicacao).getTime()
      const matchesPeriod = !periodDays || (date && now - date <= periodDays * 86_400_000)
      return matchesSearch && matchesStatus && matchesVaga && matchesPeriod
    })
  }, [data, period, search, status, vaga])

  if (loading) return <AdminLoading label={t('candidates.loading')} />
  if (error) return <AdminError message={error} onRetry={reload} />

  const columns = [
    {
      key: 'candidato',
      label: t('candidates.candidate'),
      render: (candidato) => (
        <div className="admin-entity">
          <span className="admin-entity-avatar">{initials(candidato.nome || t('candidates.candidate'))}</span>
          <div><strong>{candidato.nome || t('candidates.candidate')}</strong><span>{candidato.cargoAtual || candidato.email || t('candidates.referredTalent')}</span></div>
        </div>
      ),
    },
    { key: 'vaga', label: t('candidates.relatedJob'), render: (candidato) => candidato.vagaTitulo || t('candidates.jobNotProvided') },
    { key: 'indicador', label: t('candidates.referredBy'), render: (candidato) => candidato.indicadorNome || t('candidates.referrerNotProvided') },
    { key: 'data', label: t('candidates.referralDate'), render: (candidato) => formatDate(candidato.dataIndicacao) },
    {
      key: 'status',
      label: t('candidates.funnelStatus'),
      render: (candidato) => <AdminStatusBadge status={candidato.status} label={t(`candidates.statuses.${candidato.status}`, { defaultValue: candidato.status })} />,
    },
    {
      key: 'acoes',
      label: t('candidates.actions'),
      render: (candidato) => <button className="admin-table-action" type="button" onClick={() => setSelected(candidato)}>{t('candidates.viewDetails')}</button>,
    },
  ]

  return (
    <>
      <AdminPageHeader
        eyebrow={t('candidates.eyebrow')}
        title={t('candidates.title')}
        description={t('candidates.description')}
      />

      <AdminToolbar
        search={search}
        onSearch={setSearch}
        placeholder={t('candidates.searchPlaceholder')}
        onClear={() => { setSearch(''); setStatus('todos'); setVaga('todas'); setPeriod('todos') }}
      >
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="todos">{t('candidates.allStages')}</option>
          <option value="indicado">{t('candidates.screening')}</option>
          <option value="entrevista">{t('candidates.interview')}</option>
          <option value="contratado">{t('candidates.hired')}</option>
          <option value="recusado">{t('candidates.rejected')}</option>
          <option value="cancelado">{t('candidates.cancelled')}</option>
        </select>
        <select value={vaga} onChange={(event) => setVaga(event.target.value)}>
          <option value="todas">{t('candidates.allJobs')}</option>
          {data.vagas.map((vagaTitulo) => <option key={vagaTitulo} value={vagaTitulo}>{vagaTitulo}</option>)}
        </select>
        <select value={period} onChange={(event) => setPeriod(event.target.value)}>
          <option value="todos">{t('candidates.allPeriod')}</option>
          <option value="7">{t('candidates.lastSevenDays')}</option>
          <option value="30">{t('candidates.lastThirtyDays')}</option>
        </select>
      </AdminToolbar>

      <AdminTable
        columns={columns}
        rows={rows}
        emptyTitle={t('candidates.emptyTitle')}
        emptyDescription={t('candidates.emptyDescription')}
      />

      <section className="admin-summary-cards">
        <article className="admin-summary-card primary">
          <span>{t('candidates.conversionRate')}</span>
          <strong>{data.metricas.conversao}%</strong>
          <p>{t('candidates.conversionDescription')}</p>
        </article>
        <article className="admin-summary-card accent">
          <span>{t('candidates.newTalent')}</span>
          <strong>+{formatNumber(data.metricas.novos)}</strong>
          <p>{t('candidates.newTalentDescription')}</p>
        </article>
        <article className="admin-summary-card">
          <span>{t('candidates.inInterview')}</span>
          <strong>{formatNumber(data.metricas.entrevistas)}</strong>
          <p>{t('candidates.alreadyHired', { count: data.metricas.contratados })}</p>
        </article>
      </section>

      {selected && (
        <AdminModal title={selected.nome || t('candidates.candidate')} eyebrow={t('candidates.profile')} onClose={() => setSelected(null)}>
          <AdminDetailGrid items={[
            { label: t('candidates.email'), value: selected.email },
            { label: t('candidates.phone'), value: selected.telefone },
            { label: t('candidates.currentRole'), value: selected.cargoAtual },
            { label: t('candidates.job'), value: selected.vagaTitulo || t('candidates.jobNotProvided') },
            { label: t('candidates.company'), value: selected.vagaEmpresa },
            { label: t('candidates.referrer'), value: selected.indicadorNome || t('candidates.referrerNotProvided') },
            { label: t('candidates.status'), value: t(`candidates.statuses.${selected.status}`, { defaultValue: selected.status }) },
            { label: t('candidates.referralDate'), value: formatDate(selected.dataIndicacao) },
            { label: t('candidates.linkedin'), value: selected.linkedin },
            { label: t('candidates.resume'), value: selected.curriculoNome },
          ]} />

          {selected.narrativa && (
            <section className="admin-modal-section">
              <h3>{t('candidates.referralNarrative')}</h3>
              <p>{selected.narrativa}</p>
            </section>
          )}
        </AdminModal>
      )}
    </>
  )
}

export default AdminCandidatos
