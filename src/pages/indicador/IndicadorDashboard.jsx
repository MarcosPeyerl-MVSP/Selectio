import './styles/IndicadorDashboard.css'

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  FaArrowRight,
  FaChartLine,
  FaClock,
  FaUserCheck,
  FaUserFriends,
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
import { listarCandidatosPreSalvosParaRecomendacao } from '../../services/firestoreCandidatosPreSalvos'
import { listarIndicacoesPorIndicador } from '../../services/firestoreIndicacoes'
import { listarVagasPagina } from '../../services/firestoreVagas'
import { recomendarVagas } from '../../services/recomendacoes/recomendacoesVagas'
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
  const [recomendacoes, setRecomendacoes] = useState({ indicadorId: '', erro: false, resultado: null })

  useEffect(() => {
    let ativo = true

    const carregarDashboard = async () => {
      setRecomendacoes({ indicadorId, erro: false, resultado: null })
      if (!indicadorId) {
        if (ativo) {
          setErro(t('dashboard.missingUid'))
          setCarregando(false)
        }
        return
      }

      try {
        setErro('')
        setCarregando(true)

        const dadosRecomendacoes = Promise.all([
          listarVagasPagina(), listarIndicacoesPorIndicador(indicadorId),
          listarCandidatosPreSalvosParaRecomendacao(indicadorId),
        ])
        // Uma falha da shortlist não deve indisponibilizar as métricas do painel.
        const [candidatos, pagamentos, movimentacoes, extras] = await Promise.all([
          listarCandidatosPorIndicador(indicadorId),
          listarPagamentosPorIndicador(indicadorId),
          listarMovimentacoesIndicador(indicadorId),
          dadosRecomendacoes.then((valor) => ({ valor }), () => ({ erro: true })),
        ])

        if (!ativo) return
        setDados({ candidatos, pagamentos, movimentacoes })
        setRecomendacoes({ indicadorId, erro: Boolean(extras.erro),
          resultado: extras.erro ? null : recomendarVagas({ indicadorId, candidatos,
            vagas: extras.valor[0].vagas, indicacoes: extras.valor[1], preSalvos: extras.valor[2] }) })
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

  const distribuicao = resumo.desempenho.map((item) => ({ ...item,
    label: t(`common:statuses.candidates.${item.status}`, { defaultValue: t('dashboard.unknownStatus') }) }))

  if (carregando || recomendacoes.indicadorId && recomendacoes.indicadorId !== indicadorId) {
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
                  <span>{t('dashboard.networkPerformance')}</span>
                  <h2>{t('dashboard.referralConversion')}</h2>
                </div>
                <FaChartLine />
              </div>

              <p className="indicador-performance-description">{t('dashboard.conversionDescription')}</p>
              <div className="indicador-conversion-summary">
                <strong>{formatPercent(resumo.taxaContratacao)}</strong>
                <span>{t('dashboard.hireRatio', { count: resumo.totalContratacoes, hired: resumo.totalContratacoes, total: resumo.totalIndicacoes })}</span>
              </div>
              <p className="indicador-performance-description">{t('dashboard.statusDescription')}</p>
              <div className="indicador-performance-chart" aria-hidden="true">
                <ResponsiveContainer width="100%" height={235}>
                  <BarChart data={distribuicao} layout="vertical" margin={{ top: 4, right: 28, left: 0, bottom: 0 }} accessibilityLayer={false}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="4 6" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                    <YAxis type="category" dataKey="label" width={100} tick={{ fill: 'var(--text)', fontSize: 12 }} tickLine={false} axisLine={false} />
                    <Bar dataKey="quantidade" fill="var(--primary)" radius={[0, 5, 5, 0]} label={{ position: 'right', fill: 'var(--text)' }} maxBarSize={24} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="indicador-performance-counts">
                {distribuicao.map((item) => <li key={item.status}>{item.label}: {item.quantidade} ({formatPercent(item.percentual)})</li>)}
              </ul>
              <ConversionRow
                label={t('dashboard.referralsAdvanced')}
                value={resumo.taxaEntrevista}
                detail={t('dashboard.ratio', { part: resumo.totalAvancaram, total: resumo.totalIndicacoes })}
              />
              <ConversionRow
                label={t('dashboard.advancedToHires')}
                value={resumo.taxaEntrevistaContratacao}
                detail={t('dashboard.ratio', { part: resumo.totalContratacoes, total: resumo.totalAvancaram })}
              />
              <p className="indicador-performance-description">{t('dashboard.advancedDescription')}</p>
              <p className="indicador-performance-description">{t('dashboard.sampleDescription')}</p>
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


        </div>

        <aside className="indicador-dashboard-aside" aria-label={t('dashboard.recommendations.title')}>
          <article className="indicador-dashboard-card indicador-recommendations-card">
            <div className="indicador-dashboard-card-heading">
              <div>
                <h2>{t('dashboard.recommendations.title')}</h2>
              </div>
            </div>

            {recomendacoes.erro ? (
              <EstadoDados title={t('dashboard.recommendations.errorTitle')} description={t('dashboard.recommendations.errorDescription')}
                actionLabel={t('dashboard.retry')} onAction={() => { setCarregando(true); setReloadKey((value) => value + 1) }} tone="error" />
            ) : (
              <>
                <p>{t(recomendacoes.resultado?.personalizada ? 'dashboard.recommendations.description' : 'dashboard.recommendations.newUser')}</p>
                <p className="indicador-recommendations-note">{t('dashboard.recommendations.shortlist')}</p>
                <div className="indicador-recommendations-list">
                  {recomendacoes.resultado?.vagas.map(({ vaga, motivos }) => (
                    <article className="indicador-recommendation" key={vaga.id}>
                      <h3>{vaga.titulo || t('dashboard.job')}</h3>
                      <p>{vaga.empresa || vaga.empresaNome || t('dashboard.company')}</p>
                      <p>{[vaga.area, vaga.rubricaCompatibilidade?.modeloTrabalho, vaga.localizacao].filter(Boolean).join(' • ')}</p>
                      <ul>{motivos.map((motivo) => <li key={motivo.tipo}>{t(`dashboard.recommendations.reasons.${motivo.tipo}`, { count: motivo.count })}</li>)}</ul>
                      <Link to={`/vaga/${vaga.id}`}>{t('dashboard.recommendations.viewJob')} <FaArrowRight aria-hidden="true" /></Link>
                    </article>
                  ))}
                </div>
                {!recomendacoes.resultado?.vagas.length && <p role="status">{t('dashboard.recommendations.empty')}</p>}
              </>
            )}
            <Link className="indicador-recommendations-all" to="/vagas">{t('dashboard.recommendations.viewAll')} <FaArrowRight aria-hidden="true" /></Link>
          </article>
        </aside>

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

function primeiroNome(nome, fallback) {
  return String(nome || fallback).trim().split(/\s+/)[0]
}

function iniciais(nome, fallback) {
  const partes = String(nome || fallback).trim().split(/\s+/).filter(Boolean)
  return partes.slice(0, 2).map((parte) => parte[0]).join('').toUpperCase()
}

export default IndicadorDashboard
