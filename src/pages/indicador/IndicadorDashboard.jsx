import './styles/IndicadorDashboard.css'

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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

const statusLabels = {
  indicado: 'Indicado',
  entrevista: 'Entrevista',
  contratado: 'Contratado',
  cancelado: 'Cancelado',
  recusado: 'Recusado',
}

function IndicadorDashboard({ user }) {
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
          setErro('Perfil do indicador sem UID do Firebase.')
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
      } catch (error) {
        if (ativo) {
          setErro(error.message || 'Não foi possível carregar os dados do dashboard.')
        }
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregarDashboard()

    return () => {
      ativo = false
    }
  }, [indicadorId, reloadKey])

  const resumo = useMemo(
    () => montarResumoDashboard(dados),
    [dados],
  )

  const proximosPassos = useMemo(
    () => montarProximosPassos({ resumo, user }),
    [resumo, user],
  )

  if (carregando) {
    return <PageLoader label="Montando seu dashboard..." compact />
  }

  if (erro) {
    return (
      <EstadoDados
        actionLabel="Tentar novamente"
        description={erro}
        onAction={() => {
          setCarregando(true)
          setReloadKey((value) => value + 1)
        }}
        title={navigator.onLine ? 'Dashboard indisponível' : 'Você está sem conexão'}
        tone={navigator.onLine ? 'error' : 'offline'}
      />
    )
  }

  return (
    <section className="indicador-dashboard">
      <header className="indicador-dashboard-header">
        <div>
          <span>Visão geral da rede</span>
          <h1>Performance do Indicador</h1>
          <p>
            Olá, {primeiroNome(user?.nome)}. Acompanhe indicações, conversões e recompensas em um só lugar.
          </p>
        </div>

        <Link className="indicador-dashboard-primary-action" to="/vagas">
          Nova indicação <FaArrowRight />
        </Link>
      </header>

      <section
        className="indicador-dashboard-metrics"
        data-tour="indicador-dashboard-metricas"
        aria-label="Métricas do indicador"
      >
        <MetricCard
          icon={FaUserFriends}
          label="Total de indicações"
          value={resumo.totalIndicacoes}
          helper={`${resumo.totalAvancaram} avançaram no processo`}
        />
        <MetricCard
          icon={FaUserCheck}
          label="Contratações"
          value={resumo.totalContratacoes}
          helper={`${formatPercent(resumo.taxaContratacao)} de conversão`}
        />
        <MetricCard
          icon={FaMoneyBillWave}
          label="Total em prêmios"
          value={formatCurrency(resumo.totalPremios)}
          helper="Pagamentos aprovados"
          tone="primary"
        />
        <MetricCard
          icon={FaClock}
          label="Indicações ativas"
          value={resumo.totalAtivas}
          helper={`${resumo.totalEntrevistas} em entrevista`}
        />
      </section>

      <div className="indicador-dashboard-layout">
        <div className="indicador-dashboard-main">
          <section className="indicador-dashboard-performance-grid">
            <article className="indicador-dashboard-card indicador-network-card">
              <div className="indicador-dashboard-card-heading">
                <div>
                  <span>Conversão</span>
                  <h2>Performance da rede</h2>
                </div>
                <FaChartLine />
              </div>

              <ConversionRow
                label="Indicações → entrevistas"
                value={resumo.taxaEntrevista}
                detail={`${resumo.totalAvancaram} de ${resumo.totalIndicacoes}`}
              />
              <ConversionRow
                label="Entrevistas → contratações"
                value={resumo.taxaEntrevistaContratacao}
                detail={`${resumo.totalContratacoes} de ${resumo.totalAvancaram}`}
              />
            </article>

            <article className="indicador-dashboard-card indicador-pending-card">
              <div className="indicador-dashboard-card-heading">
                <div>
                  <span>Em acompanhamento</span>
                  <h2>Prêmios pendentes</h2>
                </div>
                <FaMoneyBillWave />
              </div>

              <div className="indicador-pending-value">
                <strong>{resumo.premiosPendentes}</strong>
                <span>{resumo.premiosPendentes === 1 ? 'recompensa' : 'recompensas'}</span>
              </div>
              <p>
                {resumo.premiosPendentes
                  ? `${formatCurrency(resumo.valorPendente)} aguardando criação ou aprovação do pagamento.`
                  : 'Nenhuma recompensa pendente. Seu financeiro está em dia.'}
              </p>
              <Link to="/painel/indicador?secao=financeiro">
                Abrir financeiro <FaArrowRight />
              </Link>
            </article>
          </section>

          <article
            className="indicador-dashboard-card indicador-recent-card"
            data-tour="indicador-dashboard-recentes"
          >
            <div className="indicador-dashboard-card-heading">
              <div>
                <span>Pipeline</span>
                <h2>Indicações recentes</h2>
              </div>
              <Link to="/candidatos/indicador">Ver todas <FaArrowRight /></Link>
            </div>

            {resumo.recentes.length ? (
              <div className="indicador-recent-table-wrap">
                <table className="indicador-recent-table">
                  <thead>
                    <tr>
                      <th>Candidato</th>
                      <th>Vaga</th>
                      <th>Empresa</th>
                      <th>Data</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumo.recentes.map((candidato, index) => (
                      <tr key={candidato.id}>
                        <td>
                          <Link to="/candidatos/indicador" className="indicador-candidate-cell">
                            <span className={`indicador-candidate-initial tone-${index % 4}`}>
                              {iniciais(candidato.nome)}
                            </span>
                            <strong>{candidato.nome || 'Candidato'}</strong>
                          </Link>
                        </td>
                        <td>{candidato.vagaTitulo || 'Vaga não informada'}</td>
                        <td>{candidato.vagaEmpresa || candidato.empresaNome || 'Empresa'}</td>
                        <td>{formatDate(candidato.aplicadoEm || candidato.criadoEm)}</td>
                        <td>
                          <span className={`indicador-status-badge ${candidato.status || 'indicado'}`}>
                            {statusLabels[candidato.status] || statusLabels.indicado}
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
                  <strong>Sua rede começa com a primeira indicação</strong>
                  <p>Explore as vagas abertas e conecte um talento à oportunidade certa.</p>
                </div>
                <Link to="/vagas">Explorar vagas</Link>
              </div>
            )}
          </article>

          <article
            className="indicador-dashboard-card indicador-chart-card"
            data-tour="indicador-dashboard-grafico"
          >
            <div className="indicador-dashboard-card-heading">
              <div>
                <span>Últimos seis meses</span>
                <h2>Ganhos por mês</h2>
              </div>
              <div className="indicador-chart-total">
                <span>Total no período</span>
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
                      tickFormatter={formatAxisCurrency}
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
                <strong>O gráfico cresce com suas recompensas</strong>
                <p>Pagamentos aprovados aparecerão aqui, agrupados pelo mês de recebimento.</p>
              </div>
            )}

            <footer className="indicador-chart-footer">
              <span>
                Fonte: {resumo.fonteGanhos === 'movimentacoes'
                  ? 'créditos em movimentações financeiras'
                  : 'pagamentos aprovados'}
              </span>
              {resumo.ultimoCredito && (
                <span>Último crédito: {formatDate(resumo.ultimoCredito)}</span>
              )}
            </footer>
          </article>
        </div>

        <aside className="indicador-dashboard-aside">
          <article className="indicador-editorial-card">
            <span><FaLightbulb /> Dica do editor</span>
            <h2>Como aumentar suas chances de sucesso?</h2>
            <p>
              Uma indicação forte explica por que a pessoa combina com a vaga, não apenas onde ela trabalhou.
            </p>
            <ul>
              <li>Conecte experiências aos requisitos da vaga.</li>
              <li>Destaque resultados e contexto de colaboração.</li>
              <li>Mantenha LinkedIn e currículo atualizados.</li>
            </ul>
            <Link to="/vagas">Encontrar oportunidade <FaArrowRight /></Link>
          </article>

          <article className="indicador-next-steps-card">
            <div className="indicador-dashboard-card-heading">
              <div>
                <span>Agora</span>
                <h2>Próximos passos</h2>
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

function MetricCard({ helper, icon: Icon, label, tone = '', value }) {
  return (
    <article className={`indicador-metric-card ${tone}`}>
      <div className="indicador-metric-card-top">
        <span><Icon /></span>
        {tone === 'primary' && <small>Financeiro</small>}
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

function montarProximosPassos({ resumo, user }) {
  const passos = []
  const perfilIncompleto = !user?.linkedin || !user?.especialidades

  if (!resumo.totalIndicacoes) {
    passos.push({
      icon: FaBriefcase,
      title: 'Faça sua primeira indicação',
      description: 'Explore as vagas abertas e escolha um talento da sua rede.',
      to: '/vagas',
    })
  }

  if (resumo.totalAtivas) {
    passos.push({
      icon: FaCalendarCheck,
      title: 'Acompanhe processos ativos',
      description: `${resumo.totalAtivas} ${resumo.totalAtivas === 1 ? 'indicação está' : 'indicações estão'} em andamento.`,
      to: '/candidatos/indicador',
    })
  }

  if (resumo.premiosPendentes) {
    passos.push({
      icon: FaMoneyBillWave,
      title: 'Recompensas em acompanhamento',
      description: `${resumo.premiosPendentes} ${resumo.premiosPendentes === 1 ? 'pagamento precisa' : 'pagamentos precisam'} de atenção.`,
      to: '/painel/indicador?secao=financeiro',
    })
  }

  if (perfilIncompleto) {
    passos.push({
      icon: FaUserTie,
      title: 'Fortaleça seu perfil',
      description: 'Adicione LinkedIn e especialidades para deixar sua atuação mais completa.',
      to: '/painel/indicador?secao=perfil',
    })
  }

  if (passos.length < 3) {
    passos.push({
      icon: FaCheckCircle,
      title: 'Revise suas indicações',
      description: 'Mantenha dados e contexto dos candidatos sempre atualizados.',
      to: '/candidatos/indicador',
    })
  }

  if (passos.length < 3) {
    passos.push({
      icon: FaBriefcase,
      title: 'Amplie sua rede de oportunidades',
      description: 'Veja as vagas mais recentes publicadas pelas empresas.',
      to: '/vagas',
    })
  }

  return passos.slice(0, 3)
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

function formatAxisCurrency(value) {
  const numero = Number(value || 0)

  if (Math.abs(numero) >= 1000) {
    return `R$ ${(numero / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  }

  return `R$ ${numero.toLocaleString('pt-BR')}`
}

function formatPercent(value) {
  return `${Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

function formatDate(value) {
  if (!value) return 'Não informado'

  const data = new Date(value)
  if (Number.isNaN(data.getTime())) return 'Não informado'

  return data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).replace('.', '')
}

function primeiroNome(nome) {
  return String(nome || 'Indicador').trim().split(/\s+/)[0]
}

function iniciais(nome) {
  const partes = String(nome || 'Candidato').trim().split(/\s+/).filter(Boolean)
  return partes.slice(0, 2).map((parte) => parte[0]).join('').toUpperCase()
}

export default IndicadorDashboard
