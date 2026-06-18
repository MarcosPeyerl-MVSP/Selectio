import './styles/AdminPages.css'

import { Link } from 'react-router-dom'
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
  formatCompactCurrency,
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
  const { data, loading, error, reload } = useAdminData(buscarVisaoGeralAdmin)

  if (loading) return <AdminLoading label="Consolidando o ecossistema Selectio..." />
  if (error) return <AdminError message={error} onRetry={reload} />

  return (
    <>
      <AdminPageHeader
        eyebrow="Plataforma • Admin dashboard"
        title="Panorama Geral"
        description="Monitore o crescimento do ecossistema, acompanhe processos e visualize o fluxo financeiro da Selectio."
      />

      <AdminMetrics className="five">
        <AdminMetricCard icon={FaBuilding} label="Empresas ativas" value={formatNumber(data.metricas.empresasAtivas)} />
        <AdminMetricCard icon={FaUserTie} label="Indicadores totais" value={formatNumber(data.metricas.indicadoresTotais)} />
        <AdminMetricCard icon={FaBriefcase} label="Vagas em aberto" value={formatNumber(data.metricas.vagasAbertas)} />
        <AdminMetricCard
          icon={FaCheckCircle}
          label="Contratações"
          value={formatNumber(data.metricas.contratacoes)}
          helper="Status contratado"
        />
        <AdminMetricCard
          icon={FaMoneyBillWave}
          label="Payout global"
          value={formatCompactCurrency(data.metricas.payoutGlobal)}
          helper="Pagamentos aprovados"
          tone="primary"
        />
      </AdminMetrics>

      <div className="admin-overview-layout">
        <div className="admin-overview-main">
          <article className="admin-section-card">
            <div className="admin-section-heading">
              <div>
                <h2>Saúde do Ecossistema</h2>
                <span>Novos registros nos últimos sete meses</span>
              </div>
              <div className="admin-chart-legend">
                <span><i /> Indicadores</span>
                <span><i /> Vagas</span>
                <span><i /> Candidatos</span>
              </div>
            </div>

            <div className="admin-ecosystem-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.grafico} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
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
                  <Bar dataKey="indicadores" fill="#b61c2f" radius={[5, 5, 0, 0]} maxBarSize={34} />
                  <Bar dataKey="vagas" fill="#ef8390" radius={[5, 5, 0, 0]} maxBarSize={34} />
                  <Bar dataKey="candidatos" fill="#6f7481" radius={[5, 5, 0, 0]} maxBarSize={34} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="admin-section-card">
            <div className="admin-section-heading">
              <div>
                <h2>Atividade Recente</h2>
                <span>Eventos reais encontrados no Firestore</span>
              </div>
            </div>

            {data.atividade.length ? (
              <div className="admin-activity-list">
                {data.atividade.map((activity) => {
                  const Icon = activityIcons[activity.tipo] || FaCheckCircle

                  return (
                    <article className="admin-activity-item" key={activity.id}>
                      <span className="admin-activity-icon"><Icon /></span>
                      <div>
                        <strong>{activity.titulo}</strong>
                        <span>{activity.descricao}</span>
                      </div>
                      <time>{formatRelativeDate(activity.data)}</time>
                    </article>
                  )
                })}
              </div>
            ) : (
              <p className="admin-dashboard-note">As atividades aparecerão conforme a plataforma receber novos registros.</p>
            )}
          </article>
        </div>

        <aside className="admin-overview-aside">
          <article className="admin-pending-card">
            <div className="admin-section-heading">
              <div>
                <h2>Ações Pendentes</h2>
                <span>Itens para acompanhamento</span>
              </div>
              <strong>{data.pendencias.length}</strong>
            </div>

            <div className="admin-pending-list">
              {data.pendencias.length ? data.pendencias.map((pending) => (
                <article className="admin-pending-item" key={pending.id}>
                  <div>
                    <span>{pending.tipo}</span>
                    <strong>{pending.titulo}</strong>
                    <p>{pending.descricao}</p>
                  </div>
                  <Link to={pending.link}>Ver</Link>
                </article>
              )) : (
                <article className="admin-pending-item">
                  <div>
                    <span>Operação</span>
                    <strong>Nenhuma pendência crítica</strong>
                    <p>Os fluxos monitorados estão sem itens aguardando análise.</p>
                  </div>
                </article>
              )}
            </div>
          </article>

          <article className="admin-support-card">
            <span>Operação saudável</span>
            <h2>Suporte ao Ecossistema</h2>
            <p>Use as áreas administrativas para investigar cadastros, processos seletivos e movimentações.</p>
          </article>
        </aside>
      </div>
    </>
  )
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
