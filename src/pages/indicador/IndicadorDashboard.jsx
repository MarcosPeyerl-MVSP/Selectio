import './styles/IndicadorDashboard.css'

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  FaArrowRight,
  FaBriefcase,
  FaCalendarCheck,
  FaChartLine,
  FaCheckCircle,
  FaClock,
  FaLightbulb,
  FaMoneyBillWave,
  FaUserCheck,
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

import EstadoDados from '../../components/ui/EstadoDados'
import PageLoader from '../../components/ui/PageLoader'
import { listarCandidatosPorIndicador } from '../../services/firestoreCandidatos'
import {
  listarMovimentacoesIndicador,
  listarPagamentosPorIndicador,
} from '../../services/firestorePagamentos'
import { getFirebaseUid } from '../../services/identidadeFirebase'
import { montarResumoDashboard } from './indicadorDashboardDados'
import {
  formatCurrency,
  formatDate,
  formatPercent
} from '../../i18n/formatters'

function IndicadorDashboard({ user }) {
  const { t, i18n } = useTranslation(['referrer', 'common'])
  const indicadorId = getFirebaseUid(user)
  const [dados, setDados] = useState({
    candidatos: [],
    pagamentos: [],
    movimentacoes: [],
  })
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let ativo = true

    const carregarDashboard = async () => {
      if (!indicadorId) {
        if (ativo) {
          setErro(t('dashboard.missingUid'))
          setCarregando(false)
        }
        return
      }

      try {
        setErro('')

        const [candidatos, pagamentos, movimentacoes] = await Promise.all([
          listarCandidatosPorIndicador(indicadorId),
          listarPagamentosPorIndicador(indicadorId),
          listarMovimentacoesIndicador(indicadorId),
        ])

        if (!ativo) return
        setDados({ candidatos, pagamentos, movimentacoes })
      } catch {
        if (ativo) {
          setErro(t('dashboard.loadError'))
        }
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregarDashboard()

    return () => {
      ativo = false
    }
  }, [indicadorId, reloadKey, t])

  const resumo = useMemo(
    () => montarResumoDashboard(dados, new Date(), i18n.resolvedLanguage || i18n.language),
    [dados, i18n.language, i18n.resolvedLanguage],
  )

  const proximosPassos = useMemo(
    () => montarProximosPassos({ resumo, user, t }),
    [resumo, t, user],
  )

  if (carregando) {
    return <PageLoader label={t('dashboard.loading')} compact />
  }

  if (erro) {
    return (
      <EstadoDados
        actionLabel={t('dashboard.retry')}
        description={erro}
        onAction={() => {
          setCarregando(true)
          setReloadKey((value) => value + 1)
        }}
        title={navigator.onLine ? t('dashboard.unavailable') : t('dashboard.offline')}
        tone={navigator.onLine ? 'error' : 'offline'}
      />
    )
  }

  return (
    <section className="indicador-dashboard">
      <header className="indicador-dashboard-header">
        <div>
          <span>{t('dashboard.networkOverview')}</span>
          <h1>{t('dashboard.title')}</h1>
          <p>{t('dashboard.greeting', {
            name: primeiroNome(user?.nome, t('panel.defaultName'))
          })}</p>
        </div>

        <Link className="indicador-dashboard-primary-action" to="/vagas">
          {t('dashboard.newReferral')} <FaArrowRight />
        </Link>
      </header>

      <section
        className="indicador-dashboard-metrics"
        data-tour="indicador-dashboard-metricas"
        aria-label={t('dashboard.metricsLabel')}
      >
        <MetricCard
          icon={FaUserFriends}
          label={t('dashboard.totalReferrals')}
          value={resumo.totalIndicacoes}
          helper={t('dashboard.advanced', { count: resumo.totalAvancaram })}
        />
        <MetricCard
          icon={FaUserCheck}
          label={t('dashboard.hires')}
          value={resumo.totalContratacoes}
          helper={t('dashboard.conversionHelper', { value: formatPercent(resumo.taxaContratacao) })}
        />
        <MetricCard
          icon={FaMoneyBillWave}
          label={t('dashboard.totalRewards')}
          value={formatCurrency(resumo.totalPremios)}
          helper={t('dashboard.approvedPayments')}
          tone="primary"
          badge={t('dashboard.finance')}
        />
        <MetricCard
          icon={FaClock}
          label={t('dashboard.activeReferrals')}
          value={resumo.totalAtivas}
          helper={t('dashboard.inInterview', { count: resumo.totalEntrevistas })}
        />
      </section>

      <div className="indicador-dashboard-layout">
        <div className="indicador-dashboard-main">
          <section className="indicador-dashboard-performance-grid">
            <article className="indicador-dashboard-card indicador-network-card">
              <div className="indicador-dashboard-card-heading">
                <div>
                  <span>{t('dashboard.conversion')}</span>
                  <h2>{t('dashboard.networkPerformance')}</h2>
                </div>
                <FaChartLine />
              </div>

              <ConversionRow
                label={t('dashboard.referralsToInterviews')}
                value={resumo.taxaEntrevista}
                detail={t('dashboard.ratio', { part: resumo.totalAvancaram, total: resumo.totalIndicacoes })}
              />
              <ConversionRow
                label={t('dashboard.interviewsToHires')}
                value={resumo.taxaEntrevistaContratacao}
                detail={t('dashboard.ratio', { part: resumo.totalContratacoes, total: resumo.totalAvancaram })}
              />
            </article>

            <article className="indicador-dashboard-card indicador-pending-card">
              <div className="indicador-dashboard-card-heading">
                <div>
                  <span>{t('dashboard.tracking')}</span>
                  <h2>{t('dashboard.pendingRewards')}</h2>
                </div>
                <FaMoneyBillWave />
              </div>

              <div className="indicador-pending-value">
                <strong>{resumo.premiosPendentes}</strong>
                <span>{t('dashboard.reward', { count: resumo.premiosPendentes })}</span>
              </div>
              <p>
                {resumo.premiosPendentes
                  ? t('dashboard.pendingValue', { value: formatCurrency(resumo.valorPendente) })
                  : t('dashboard.noPending')}
              </p>
              <Link to="/painel/indicador/dashboard?secao=financeiro">
                {t('dashboard.openFinance')} <FaArrowRight />
              </Link>
            </article>
          </section>

          <article
            className="indicador-dashboard-card indicador-recent-card"
            data-tour="indicador-dashboard-recentes"
          >
            <div className="indicador-dashboard-card-heading">
              <div>
                <span>{t('dashboard.pipeline')}</span>
                <h2>{t('dashboard.recentReferrals')}</h2>
              </div>
              <Link to="/candidatos/indicador">{t('dashboard.viewAll')} <FaArrowRight /></Link>
            </div>

            {resumo.recentes.length ? (
              <div className="indicador-recent-table-wrap">
                <table className="indicador-recent-table">
                  <thead>
                    <tr>
                      <th>{t('dashboard.candidate')}</th>
                      <th>{t('dashboard.job')}</th>
                      <th>{t('dashboard.company')}</th>
                      <th>{t('dashboard.date')}</th>
                      <th>{t('dashboard.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumo.recentes.map((candidato, index) => (
                      <tr key={candidato.id}>
                        <td>
                          <Link to="/candidatos/indicador" className="indicador-candidate-cell">
                            <span className={`indicador-candidate-initial tone-${index % 4}`}>
                              {iniciais(candidato.nome, t('dashboard.candidate'))}
                            </span>
                            <strong>{candidato.nome || t('dashboard.candidate')}</strong>
                          </Link>
                        </td>
                        <td>{candidato.vagaTitulo || t('dashboard.jobNotProvided')}</td>
                        <td>{candidato.vagaEmpresa || candidato.empresaNome || t('dashboard.company')}</td>
                        <td>{formatDate(candidato.aplicadoEm || candidato.criadoEm)}</td>
                        <td>
                          <span className={`indicador-status-badge ${candidato.status || 'indicado'}`}>
                            {t(`common:statuses.candidates.${candidato.status || 'indicado'}`)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="indicador-dashboard-empty">
                <FaUserFriends />
                <div>
                  <strong>{t('dashboard.firstReferralTitle')}</strong>
                  <p>{t('dashboard.firstReferralDescription')}</p>
                </div>
                <Link to="/vagas">{t('dashboard.exploreJobs')}</Link>
              </div>
            )}
          </article>

          <article
            className="indicador-dashboard-card indicador-chart-card"
            data-tour="indicador-dashboard-grafico"
          >
            <div className="indicador-dashboard-card-heading">
              <div>
                <span>{t('dashboard.lastSixMonths')}</span>
                <h2>{t('dashboard.monthlyEarnings')}</h2>
              </div>
              <div className="indicador-chart-total">
                <span>{t('dashboard.periodTotal')}</span>
                <strong>{formatCurrency(resumo.totalPeriodoGrafico)}</strong>
              </div>
            </div>

            {resumo.totalPeriodoGrafico > 0 ? (
              <div className="indicador-chart">
                <ResponsiveContainer width="100%" height={270}>
                  <BarChart data={resumo.ganhosMensais} margin={{ top: 12, right: 4, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="selectioBarGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#b61c2f" />
                        <stop offset="100%" stopColor="#d85a69" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="4 6" vertical={false} />
                    <XAxis
                      axisLine={false}
                      dataKey="mes"
                      tick={{ fill: 'var(--muted)', fontSize: 11, fontWeight: 700 }}
                      tickLine={false}
                    />
                    <YAxis
                      axisLine={false}
                      tick={{ fill: 'var(--muted)', fontSize: 10 }}
                      tickFormatter={(value) => formatCurrency(value, { notation: 'compact', maximumFractionDigits: 1 })}
                      tickLine={false}
                      width={70}
                    />
                    <Tooltip content={<GanhosTooltip />} cursor={{ fill: 'rgba(182, 28, 47, 0.06)' }} />
                    <Bar dataKey="valor" fill="url(#selectioBarGradient)" radius={[8, 8, 2, 2]} maxBarSize={62} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="indicador-chart-empty">
                <FaChartLine />
                <strong>{t('dashboard.chartEmptyTitle')}</strong>
                <p>{t('dashboard.chartEmptyDescription')}</p>
              </div>
            )}

            <footer className="indicador-chart-footer">
              <span>
                {t('dashboard.source', {
                  source: resumo.fonteGanhos === 'movimentacoes'
                    ? t('dashboard.transactionCredits')
                    : t('dashboard.approvedPayments').toLocaleLowerCase(i18n.resolvedLanguage || i18n.language)
                })}
              </span>
              {resumo.ultimoCredito && (
                <span>{t('dashboard.lastCredit', { date: formatDate(resumo.ultimoCredito, {
                  day: '2-digit', month: 'short', year: 'numeric'
                }) })}</span>
              )}
            </footer>
          </article>
        </div>

        <aside className="indicador-dashboard-aside">
          <article className="indicador-editorial-card">
            <span><FaLightbulb /> {t('dashboard.editorTip')}</span>
            <h2>{t('dashboard.successTitle')}</h2>
            <p>{t('dashboard.successDescription')}</p>
            <ul>
              <li>{t('dashboard.tipExperience')}</li>
              <li>{t('dashboard.tipResults')}</li>
              <li>{t('dashboard.tipProfile')}</li>
            </ul>
            <Link to="/vagas">{t('dashboard.findOpportunity')} <FaArrowRight /></Link>
          </article>

          <article className="indicador-next-steps-card">
            <div className="indicador-dashboard-card-heading">
              <div>
                <span>{t('dashboard.now')}</span>
                <h2>{t('dashboard.nextSteps')}</h2>
              </div>
            </div>

            <div className="indicador-next-steps-list">
              {proximosPassos.map((passo) => {
                const Icon = passo.icon

                return (
                  <Link to={passo.to} key={passo.title}>
                    <span><Icon /></span>
                    <div>
                      <strong>{passo.title}</strong>
                      <p>{passo.description}</p>
                    </div>
                    <FaArrowRight className="indicador-next-step-arrow" />
                  </Link>
                )
              })}
            </div>
          </article>
        </aside>
      </div>
    </section>
  )
}

function MetricCard({ badge, helper, icon: Icon, label, tone = '', value }) {
  return (
    <article className={`indicador-metric-card ${tone}`}>
      <div className="indicador-metric-card-top">
        <span><Icon /></span>
        {tone === 'primary' && <small>{badge}</small>}
      </div>
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{helper}</small>
    </article>
  )
}

function ConversionRow({ detail, label, value }) {
  const safeValue = Math.min(100, Math.max(0, Number(value || 0)))

  return (
    <div className="indicador-conversion-row">
      <div>
        <span>{label}</span>
        <strong>{formatPercent(safeValue)}</strong>
      </div>
      <div className="indicador-conversion-track" aria-label={`${label}: ${formatPercent(safeValue)}`}>
        <span style={{ width: `${safeValue}%` }} />
      </div>
      <small>{detail}</small>
    </div>
  )
}

function GanhosTooltip({ active, payload }) {
  if (!active || !payload?.length) return null

  const item = payload[0]?.payload

  return (
    <div className="indicador-chart-tooltip">
      <span>{item?.mesCompleto}</span>
      <strong>{formatCurrency(item?.valor)}</strong>
    </div>
  )
}

function montarProximosPassos({ resumo, user, t }) {
  const passos = []
  const perfilIncompleto = !user?.linkedin || !user?.especialidades

  if (!resumo.totalIndicacoes) {
    passos.push({
      icon: FaBriefcase,
      title: t('dashboard.next.firstTitle'),
      description: t('dashboard.next.firstDescription'),
      to: '/vagas',
    })
  }

  if (resumo.totalAtivas) {
    passos.push({
      icon: FaCalendarCheck,
      title: t('dashboard.next.activeTitle'),
      description: t('dashboard.next.activeDescription', { count: resumo.totalAtivas }),
      to: '/candidatos/indicador',
    })
  }

  if (resumo.premiosPendentes) {
    passos.push({
      icon: FaMoneyBillWave,
      title: t('dashboard.next.rewardsTitle'),
      description: t('dashboard.next.rewardsDescription', { count: resumo.premiosPendentes }),
      to: '/painel/indicador/dashboard?secao=financeiro',
    })
  }

  if (perfilIncompleto) {
    passos.push({
      icon: FaUserTie,
      title: t('dashboard.next.profileTitle'),
      description: t('dashboard.next.profileDescription'),
      to: '/painel/indicador/dashboard?secao=perfil',
    })
  }

  if (passos.length < 3) {
    passos.push({
      icon: FaCheckCircle,
      title: t('dashboard.next.reviewTitle'),
      description: t('dashboard.next.reviewDescription'),
      to: '/candidatos/indicador',
    })
  }

  if (passos.length < 3) {
    passos.push({
      icon: FaBriefcase,
      title: t('dashboard.next.networkTitle'),
      description: t('dashboard.next.networkDescription'),
      to: '/vagas',
    })
  }

  return passos.slice(0, 3)
}

function primeiroNome(nome, fallback) {
  return String(nome || fallback).trim().split(/\s+/)[0]
}

function iniciais(nome, fallback) {
  const partes = String(nome || fallback).trim().split(/\s+/).filter(Boolean)
  return partes.slice(0, 2).map((parte) => parte[0]).join('').toUpperCase()
}

export default IndicadorDashboard
