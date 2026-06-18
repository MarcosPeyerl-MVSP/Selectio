import './styles/AdminPages.css'

import { useMemo, useState } from 'react'
import { FaCheckCircle, FaMoneyBillWave, FaUserCheck, FaUserTie } from 'react-icons/fa'

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

  if (loading) return <AdminLoading label="Carregando indicadores..." />
  if (error) return <AdminError message={error} onRetry={reload} />

  const columns = [
    {
      key: 'indicador',
      label: 'Indicador',
      render: (indicador) => (
        <div className="admin-entity">
          <span className="admin-entity-avatar">{initials(indicador.nome)}</span>
          <div><strong>{indicador.nome}</strong><span>{indicador.especialidades || 'Rede de talentos'}</span></div>
        </div>
      ),
    },
    { key: 'email', label: 'E-mail', render: (indicador) => indicador.email || 'Não informado' },
    { key: 'indicacoes', label: 'Indicações', render: (indicador) => formatNumber(indicador.totalIndicacoes) },
    { key: 'contratacoes', label: 'Contratações', render: (indicador) => formatNumber(indicador.totalContratacoes) },
    { key: 'ganhos', label: 'Ganhos', render: (indicador) => formatCurrency(indicador.ganhos) },
    {
      key: 'status',
      label: 'Status',
      render: (indicador) => <AdminStatusBadge status={indicador.statusAdmin} label={indicador.statusAdmin} />,
    },
    { key: 'data', label: 'Cadastro', render: (indicador) => formatDate(indicador.dataCadastro) },
    {
      key: 'acoes',
      label: 'Ações',
      render: (indicador) => <button className="admin-table-action" type="button" onClick={() => setSelected(indicador)}>Ver perfil</button>,
    },
  ]

  return (
    <>
      <AdminPageHeader
        eyebrow="Rede • Performance"
        title="Indicadores"
        description="Acompanhe desempenho, indicações e situação financeira dos indicadores."
      />

      <AdminMetrics>
        <AdminMetricCard icon={FaUserTie} label="Indicadores totais" value={formatNumber(data.metricas.total)} />
        <AdminMetricCard icon={FaUserCheck} label="Indicadores ativos" value={formatNumber(data.metricas.ativos)} />
        <AdminMetricCard icon={FaCheckCircle} label="Total de indicações" value={formatNumber(data.metricas.indicacoes)} />
        <AdminMetricCard
          icon={FaMoneyBillWave}
          label="Premiações acumuladas"
          value={formatCurrency(data.metricas.premiacoes)}
          helper={`${formatNumber(data.metricas.contratacoes)} contratações`}
          tone="primary"
        />
      </AdminMetrics>

      <AdminToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Buscar por nome, e-mail ou CPF..."
        onClear={() => { setSearch(''); setStatus('todos'); setPerformance('todos') }}
      >
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="todos">Todos os status</option>
          <option value="ativo">Ativos</option>
          <option value="inativo">Inativos</option>
        </select>
        <select value={performance} onChange={(event) => setPerformance(event.target.value)}>
          <option value="todos">Todo desempenho</option>
          <option value="com-contratacao">Com contratação</option>
          <option value="sem-indicacao">Sem indicações</option>
        </select>
      </AdminToolbar>

      <AdminTable
        columns={columns}
        rows={rows}
        emptyTitle="Nenhum indicador encontrado"
        emptyDescription="Ajuste os filtros para visualizar outros perfis."
      />

      {selected && (
        <AdminModal title={selected.nome} eyebrow="Perfil do indicador" onClose={() => setSelected(null)}>
          <AdminDetailGrid items={[
            { label: 'E-mail', value: selected.email },
            { label: 'Telefone', value: selected.telefone },
            { label: 'CPF', value: selected.cpf },
            { label: 'Pix', value: selected.pix },
            { label: 'LinkedIn', value: selected.linkedin },
            { label: 'Especialidades', value: selected.especialidades },
            { label: 'Total de indicações', value: formatNumber(selected.totalIndicacoes) },
            { label: 'Contratações', value: formatNumber(selected.totalContratacoes) },
            { label: 'Ganhos aprovados', value: formatCurrency(selected.ganhos) },
            { label: 'Saldo disponível', value: formatCurrency(selected.saldoDisponivel) },
          ]} />

          <section className="admin-modal-section">
            <h3>Últimas indicações</h3>
            <div className="admin-mini-list">
              {selected.ultimasIndicacoes.length ? selected.ultimasIndicacoes.map((candidato) => (
                <article key={candidato.id}>
                  <div>
                    <strong>{candidato.nome || 'Candidato'}</strong>
                    <span>{candidato.vagaTitulo || 'Vaga não informada'}</span>
                  </div>
                  <AdminStatusBadge status={candidato.status} label={candidato.status} />
                </article>
              )) : <span>Nenhuma indicação encontrada.</span>}
            </div>
          </section>
        </AdminModal>
      )}
    </>
  )
}

export default AdminIndicadores
