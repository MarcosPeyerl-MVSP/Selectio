import './styles/AdminPages.css'

import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  FaBriefcase,
  FaBuilding,
  FaCheckCircle,
  FaMoneyBillWave,
  FaUserFriends,
  FaUserTie,
} from 'react-icons/fa'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import {
  AdminError,
  AdminLoading,
  AdminMetricCard,
  AdminMetrics,
  AdminPageHeader,
} from '../../components/admin/AdminUI'
import { buscarVisaoGeralAdmin } from '../../services/firestoreAdmin'
import {
  formatCurrency,
  formatCompactCurrency,
  formatMonthKey,
  formatNumber,
  formatRelativeDate,
} from './adminFormatters'
import { useAdminData } from './useAdminData'

const activityIcons = {
  empresa: FaBuilding,
  indicador: FaUserTie,
  vaga: FaBriefcase,
  candidato: FaUserFriends,
  pagamento: FaMoneyBillWave,
}

function AdminVisaoGeral() {
  const { t } = useTranslation('admin')
  const { data, loading, error, reload } = useAdminData(buscarVisaoGeralAdmin)

  if (loading) return <AdminLoading label={t('overview.loading')} />
  if (error) return <AdminError message={error} onRetry={reload} />

  const chartData = data.grafico.map((item) => ({
    ...item,
    mes: formatMonthKey(item.chave),
  }))

  return (
    <>
      <AdminPageHeader
        eyebrow={t('overview.eyebrow')}
        title={t('overview.title')}
        description={t('overview.description')}
      />

      <AdminMetrics className="five">
        <AdminMetricCard icon={FaBuilding} label={t('overview.activeCompanies')} value={formatNumber(data.metricas.empresasAtivas)} />
        <AdminMetricCard icon={FaUserTie} label={t('overview.totalReferrers')} value={formatNumber(data.metricas.indicadoresTotais)} />
        <AdminMetricCard icon={FaBriefcase} label={t('overview.openJobs')} value={formatNumber(data.metricas.vagasAbertas)} />
        <AdminMetricCard
          icon={FaCheckCircle}
          label={t('overview.hires')}
          value={formatNumber(data.metricas.contratacoes)}
          helper={t('overview.hiredStatus')}
        />
        <AdminMetricCard
          icon={FaMoneyBillWave}
          label={t('overview.globalPayout')}
          value={formatCompactCurrency(data.metricas.payoutGlobal)}
          helper={t('overview.approvedPayments')}
          tone="primary"
        />
      </AdminMetrics>

      <div className="admin-overview-layout">
        <div className="admin-overview-main">
          <article className="admin-section-card">
            <div className="admin-section-heading">
              <div>
                <h2>{t('overview.health')}</h2>
                <span>{t('overview.lastSevenMonths')}</span>
              </div>
              <div className="admin-chart-legend">
                <span><i /> {t('overview.referrers')}</span>
                <span><i /> {t('overview.jobs')}</span>
                <span><i /> {t('overview.candidates')}</span>
              </div>
            </div>

            <div className="admin-ecosystem-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="4 6" vertical={false} />
                  <XAxis
                    axisLine={false}
                    dataKey="mes"
                    tick={{ fill: 'var(--muted)', fontSize: 9, fontWeight: 800 }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tick={{ fill: 'var(--muted)', fontSize: 9 }}
                    tickLine={false}
                  />
                  <Tooltip content={<EcosystemTooltip />} cursor={{ fill: 'rgba(182, 28, 47, 0.05)' }} />
                  <Bar name={t('overview.referrers')} dataKey="indicadores" fill="#b61c2f" radius={[5, 5, 0, 0]} maxBarSize={34} />
                  <Bar name={t('overview.jobs')} dataKey="vagas" fill="#ef8390" radius={[5, 5, 0, 0]} maxBarSize={34} />
                  <Bar name={t('overview.candidates')} dataKey="candidatos" fill="#6f7481" radius={[5, 5, 0, 0]} maxBarSize={34} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="admin-section-card">
            <div className="admin-section-heading">
              <div>
                <h2>{t('overview.recentActivity')}</h2>
                <span>{t('overview.firestoreEvents')}</span>
              </div>
            </div>

            {data.atividade.length ? (
              <div className="admin-activity-list">
                {data.atividade.map((activity) => {
                  const Icon = activityIcons[activity.tipo] || FaCheckCircle
                  const presentation = getActivityPresentation(activity, t)

                  return (
                    <article className="admin-activity-item" key={activity.id}>
                      <span className="admin-activity-icon"><Icon /></span>
                      <div>
                        <strong>{presentation.title}</strong>
                        <span>{presentation.description}</span>
                      </div>
                      <time>{formatRelativeDate(activity.data)}</time>
                    </article>
                  )
                })}
              </div>
            ) : (
              <p className="admin-dashboard-note">{t('overview.activityEmpty')}</p>
            )}
          </article>
        </div>

        <aside className="admin-overview-aside">
          <article className="admin-pending-card">
            <div className="admin-section-heading">
              <div>
                <h2>{t('overview.pendingActions')}</h2>
                <span>{t('overview.trackingItems')}</span>
              </div>
              <strong>{data.pendencias.length}</strong>
            </div>

            <div className="admin-pending-list">
              {data.pendencias.length ? data.pendencias.map((pending) => {
                const presentation = getPendingPresentation(pending, t)

                return (
                  <article className="admin-pending-item" key={pending.id}>
                    <div>
                      <span>{presentation.type}</span>
                      <strong>{presentation.title}</strong>
                      <p>{presentation.description}</p>
                    </div>
                    <Link to={pending.link}>{t('overview.view')}</Link>
                  </article>
                )
              }) : (
                <article className="admin-pending-item">
                  <div>
                    <span>{t('overview.operation')}</span>
                    <strong>{t('overview.noCriticalPending')}</strong>
                    <p>{t('overview.noCriticalPendingDescription')}</p>
                  </div>
                </article>
              )}
            </div>
          </article>

          <article className="admin-support-card">
            <span>{t('overview.healthyOperation')}</span>
            <h2>{t('overview.ecosystemSupport')}</h2>
            <p>{t('overview.supportDescription')}</p>
          </article>
        </aside>
      </div>
    </>
  )
}

function getActivityPresentation(activity, t) {
  if (activity.tipo === 'empresa') {
    return {
      title: t('overview.activity.companyJoined', {
        name: activity.nome || t('overview.activity.newCompany'),
      }),
      description: activity.email || t('overview.activity.companyRegistration'),
    }
  }

  if (activity.tipo === 'indicador') {
    return {
      title: t('overview.activity.referrerJoined', {
        name: activity.nome || t('overview.activity.newReferrer'),
      }),
      description: activity.email || t('overview.activity.referrerRegistration'),
    }
  }

  if (activity.tipo === 'vaga') {
    return {
      title: t('overview.activity.jobPublished', {
        company: activity.empresaNome || t('overview.activity.company'),
        job: activity.vagaTitulo || t('overview.activity.aJob'),
      }),
      description: t(`common:statuses.jobs.${activity.status || 'indisponivel'}`),
    }
  }

  if (activity.tipo === 'candidato') {
    return {
      title: t('overview.activity.candidateReferred', {
        referrer: activity.indicadorNome || t('overview.activity.aReferrer'),
        candidate: activity.candidatoNome || t('overview.activity.aCandidate'),
      }),
      description: activity.vagaTitulo || t('overview.activity.candidateReferral'),
    }
  }

  return {
    title: t('overview.activity.rewardApproved', {
      candidate: activity.candidatoNome || t('overview.activity.candidate'),
    }),
    description: formatCurrency(activity.valor),
  }
}

function getPendingPresentation(pending, t) {
  if (pending.tipo === 'financeiro') {
    return {
      type: t('overview.pending.financial'),
      title: t('overview.pending.withdrawalRequest'),
      description: t('overview.pending.withdrawalDescription', {
        referrer: pending.indicadorNome || t('overview.activity.referrer'),
        value: formatCurrency(pending.valor),
      }),
    }
  }

  if (pending.tipo === 'recompensa') {
    return {
      type: t('overview.pending.reward'),
      title: t('overview.pending.rewardWaitingCompany'),
      description: t('overview.pending.rewardDescription', {
        candidate: pending.candidatoNome || t('overview.activity.candidate'),
      }),
    }
  }

  return {
    type: t('overview.pending.job'),
    title: t('overview.pending.pausedJob'),
    description: t('overview.pending.pausedJobDescription', {
      job: pending.vagaTitulo || t('overview.activity.job'),
    }),
  }
}

function EcosystemTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div className="admin-chart-tooltip">
      <strong>{label}</strong>
      {payload.map((item) => (
        <div key={item.dataKey}>
          <span>{item.name}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  )
}

export default AdminVisaoGeral
