import './styles/AdminPages.css'

import { useMemo, useState } from 'react'
import { FaBriefcase, FaClock, FaUserFriends } from 'react-icons/fa'

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
  formatCurrency,
  formatDate,
  formatNumber,
  initials,
  normalizeText,
} from './adminFormatters'
import { useAdminData } from './useAdminData'

const vagaStatusLabels = {
  aberta: 'Publicada',
  pausada: 'Pausada',
  encerrada: 'Encerrada',
  expirada: 'Expirada',
}

function AdminVagas() {
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

  if (loading) return <AdminLoading label="Carregando vagas..." />
  if (error) return <AdminError message={error} onRetry={reload} />

  const columns = [
    {
      key: 'empresa',
      label: 'Empresa',
      render: (vaga) => {
        const empresa = vaga.empresa || vaga.empresaNome || 'Empresa'
        return (
          <div className="admin-entity">
            <span className="admin-entity-avatar">{initials(empresa)}</span>
            <div><strong>{empresa}</strong><span>{vaga.area || 'Área não informada'}</span></div>
          </div>
        )
      },
    },
    { key: 'titulo', label: 'Vaga', render: (vaga) => vaga.titulo || 'Sem título' },
    {
      key: 'remuneracao',
      label: 'Salário / recompensa',
      render: (vaga) => vaga.salario
        || vaga.recompensa
        || (vaga.recompensaValorFixo ? formatCurrency(vaga.recompensaValorFixo) : 'Não informado'),
    },
    { key: 'publicacao', label: 'Publicação', render: (vaga) => formatDate(vaga.dataPublicacao) },
    {
      key: 'status',
      label: 'Status',
      render: (vaga) => <AdminStatusBadge status={vaga.statusAdmin} label={vagaStatusLabels[vaga.statusAdmin] || vaga.statusAdmin} />,
    },
    { key: 'candidatos', label: 'Candidatos', render: (vaga) => formatNumber(vaga.totalCandidatos) },
    {
      key: 'acoes',
      label: 'Ações',
      render: (vaga) => <button className="admin-table-action" type="button" onClick={() => setSelected(vaga)}>Ver detalhes</button>,
    },
  ]

  return (
    <>
      <AdminPageHeader
        eyebrow="Curadoria administrativa • Oportunidades"
        title="Gestão de Vagas"
        description="Acompanhe todas as oportunidades publicadas, seus status reais e o volume de candidatos."
      />

      <AdminMetrics>
        <AdminMetricCard icon={FaBriefcase} label="Total de vagas" value={formatNumber(data.metricas.total)} />
        <AdminMetricCard icon={FaBriefcase} label="Vagas abertas" value={formatNumber(data.metricas.abertas)} />
        <AdminMetricCard icon={FaClock} label="Pausadas / revisão" value={formatNumber(data.metricas.revisao)} />
        <AdminMetricCard
          icon={FaUserFriends}
          label="Total de candidatos"
          value={formatNumber(data.metricas.candidatos)}
          helper={`Conversão média: ${data.metricas.conversao}%`}
          tone="primary"
        />
      </AdminMetrics>

      <AdminToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Buscar vaga, empresa ou área..."
        onClear={() => { setSearch(''); setStatus('todos') }}
      >
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="todos">Todos os status</option>
          <option value="aberta">Publicadas</option>
          <option value="pausada">Pausadas</option>
          <option value="encerrada">Encerradas</option>
          <option value="expirada">Expiradas</option>
        </select>
      </AdminToolbar>

      <AdminTable
        columns={columns}
        rows={rows}
        emptyTitle="Nenhuma vaga encontrada"
        emptyDescription="Não há oportunidades compatíveis com os filtros atuais."
      />

      {selected && (
        <AdminModal title={selected.titulo || 'Vaga'} eyebrow="Detalhes da oportunidade" onClose={() => setSelected(null)}>
          <AdminDetailGrid items={[
            { label: 'Empresa', value: selected.empresa || selected.empresaNome },
            { label: 'Área', value: selected.area },
            { label: 'Localização', value: selected.localizacao },
            { label: 'Modelo / contrato', value: selected.tipo },
            { label: 'Salário', value: selected.salario },
            { label: 'Recompensa', value: selected.recompensa },
            { label: 'Status', value: vagaStatusLabels[selected.statusAdmin] || selected.statusAdmin },
            { label: 'Candidatos', value: formatNumber(selected.totalCandidatos) },
            { label: 'Publicação', value: formatDate(selected.dataPublicacao) },
            { label: 'Data limite', value: formatDate(selected.expiraEm || selected.dataLimite) },
          ]} />

          {(selected.descricaoLonga || selected.descricaoCurta) && (
            <section className="admin-modal-section">
              <h3>Descrição</h3>
              <p>{selected.descricaoLonga || selected.descricaoCurta}</p>
            </section>
          )}
        </AdminModal>
      )}
    </>
  )
}

export default AdminVagas
