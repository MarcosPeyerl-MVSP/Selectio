import './styles/AdminPages.css'

import { useMemo, useState } from 'react'

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

const statusLabels = {
  indicado: 'Triagem',
  entrevista: 'Entrevista',
  contratado: 'Contratado',
  recusado: 'Recusado',
  cancelado: 'Cancelado',
}

function AdminCandidatos() {
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

  if (loading) return <AdminLoading label="Carregando candidatos..." />
  if (error) return <AdminError message={error} onRetry={reload} />

  const columns = [
    {
      key: 'candidato',
      label: 'Candidato',
      render: (candidato) => (
        <div className="admin-entity">
          <span className="admin-entity-avatar">{initials(candidato.nome)}</span>
          <div><strong>{candidato.nome}</strong><span>{candidato.cargoAtual || candidato.email || 'Talento indicado'}</span></div>
        </div>
      ),
    },
    { key: 'vaga', label: 'Vaga relacionada', render: (candidato) => candidato.vagaTitulo },
    { key: 'indicador', label: 'Indicado por', render: (candidato) => candidato.indicadorNome },
    { key: 'data', label: 'Data da indicação', render: (candidato) => formatDate(candidato.dataIndicacao) },
    {
      key: 'status',
      label: 'Status do funil',
      render: (candidato) => <AdminStatusBadge status={candidato.status} label={statusLabels[candidato.status] || candidato.status} />,
    },
    {
      key: 'acoes',
      label: 'Ações',
      render: (candidato) => <button className="admin-table-action" type="button" onClick={() => setSelected(candidato)}>Ver detalhes</button>,
    },
  ]

  return (
    <>
      <AdminPageHeader
        eyebrow="Gestão de talentos • Base global"
        title="Candidatos"
        description="Visualize talentos indicados, vagas relacionadas e o estágio atual de cada processo seletivo."
      />

      <AdminToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Buscar por nome, vaga ou indicador..."
        onClear={() => { setSearch(''); setStatus('todos'); setVaga('todas'); setPeriod('todos') }}
      >
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="todos">Todas as etapas</option>
          <option value="indicado">Triagem</option>
          <option value="entrevista">Entrevista</option>
          <option value="contratado">Contratado</option>
          <option value="recusado">Recusado</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <select value={vaga} onChange={(event) => setVaga(event.target.value)}>
          <option value="todas">Todas as vagas</option>
          {data.vagas.map((vagaTitulo) => <option key={vagaTitulo} value={vagaTitulo}>{vagaTitulo}</option>)}
        </select>
        <select value={period} onChange={(event) => setPeriod(event.target.value)}>
          <option value="todos">Todo período</option>
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
        </select>
      </AdminToolbar>

      <AdminTable
        columns={columns}
        rows={rows}
        emptyTitle="Nenhum candidato encontrado"
        emptyDescription="Ajuste a etapa, vaga, período ou busca."
      />

      <section className="admin-summary-cards">
        <article className="admin-summary-card primary">
          <span>Taxa de conversão</span>
          <strong>{data.metricas.conversao}%</strong>
          <p>Percentual de candidatos que chegaram ao status contratado.</p>
        </article>
        <article className="admin-summary-card accent">
          <span>Novos talentos</span>
          <strong>+{formatNumber(data.metricas.novos)}</strong>
          <p>Indicações recebidas nos últimos sete dias.</p>
        </article>
        <article className="admin-summary-card">
          <span>Em entrevista</span>
          <strong>{formatNumber(data.metricas.entrevistas)}</strong>
          <p>{formatNumber(data.metricas.contratados)} candidatos já foram contratados.</p>
        </article>
      </section>

      {selected && (
        <AdminModal title={selected.nome} eyebrow="Perfil do candidato" onClose={() => setSelected(null)}>
          <AdminDetailGrid items={[
            { label: 'E-mail', value: selected.email },
            { label: 'Telefone', value: selected.telefone },
            { label: 'Cargo atual', value: selected.cargoAtual },
            { label: 'Vaga', value: selected.vagaTitulo },
            { label: 'Empresa', value: selected.vagaEmpresa },
            { label: 'Indicador', value: selected.indicadorNome },
            { label: 'Status', value: statusLabels[selected.status] || selected.status },
            { label: 'Data da indicação', value: formatDate(selected.dataIndicacao) },
            { label: 'LinkedIn', value: selected.linkedin },
            { label: 'Currículo', value: selected.curriculoNome },
          ]} />

          {selected.narrativa && (
            <section className="admin-modal-section">
              <h3>Narrativa da indicação</h3>
              <p>{selected.narrativa}</p>
            </section>
          )}
        </AdminModal>
      )}
    </>
  )
}

export default AdminCandidatos
