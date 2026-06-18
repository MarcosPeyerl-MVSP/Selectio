import './styles/AdminPages.css'

import { useMemo, useState } from 'react'
import { FaBriefcase, FaBuilding, FaCalendarPlus, FaUserFriends } from 'react-icons/fa'

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

function AdminEmpresas() {
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

  if (loading) return <AdminLoading label="Carregando empresas..." />
  if (error) return <AdminError message={error} onRetry={reload} />

  const columns = [
    {
      key: 'empresa',
      label: 'Empresa',
      render: (empresa) => (
        <div className="admin-entity">
          <span className="admin-entity-avatar">{initials(empresa.nome)}</span>
          <div><strong>{empresa.nome}</strong><span>{empresa.setor || empresa.cnpj || 'Cadastro empresarial'}</span></div>
        </div>
      ),
    },
    { key: 'email', label: 'Responsável / e-mail', render: (empresa) => empresa.email || 'Não informado' },
    { key: 'vagas', label: 'Vagas', render: (empresa) => formatNumber(empresa.totalVagas) },
    { key: 'candidatos', label: 'Candidatos recebidos', render: (empresa) => formatNumber(empresa.totalCandidatos) },
    {
      key: 'status',
      label: 'Status',
      render: (empresa) => <AdminStatusBadge status={empresa.statusAdmin} label={empresa.statusAdmin} />,
    },
    { key: 'data', label: 'Cadastro', render: (empresa) => formatDate(empresa.dataCadastro) },
    {
      key: 'acoes',
      label: 'Ações',
      render: (empresa) => <button className="admin-table-action" type="button" onClick={() => setSelected(empresa)}>Ver detalhes</button>,
    },
  ]

  return (
    <>
      <AdminPageHeader
        eyebrow="Ecossistema • Organizações"
        title="Empresas"
        description="Gerencie empresas cadastradas, status e atividade dentro da Selectio."
      />

      <AdminMetrics>
        <AdminMetricCard icon={FaBuilding} label="Empresas totais" value={formatNumber(data.metricas.total)} />
        <AdminMetricCard icon={FaUserFriends} label="Empresas ativas" value={formatNumber(data.metricas.ativas)} />
        <AdminMetricCard icon={FaCalendarPlus} label="Novas no mês" value={formatNumber(data.metricas.novasNoMes)} />
        <AdminMetricCard icon={FaBriefcase} label="Vagas publicadas" value={formatNumber(data.metricas.vagasPublicadas)} tone="primary" />
      </AdminMetrics>

      <AdminToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Buscar empresa, e-mail ou CNPJ..."
        onClear={() => { setSearch(''); setStatus('todos') }}
      >
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="todos">Todos os status</option>
          <option value="ativo">Ativas</option>
          <option value="inativo">Inativas</option>
          <option value="bloqueado">Bloqueadas</option>
        </select>
      </AdminToolbar>

      <AdminTable
        columns={columns}
        rows={rows}
        emptyTitle="Nenhuma empresa encontrada"
        emptyDescription="Ajuste a busca ou os filtros para visualizar outros registros."
      />

      {selected && (
        <AdminModal title={selected.nome} eyebrow="Empresa cadastrada" onClose={() => setSelected(null)}>
          <AdminDetailGrid items={[
            { label: 'E-mail', value: selected.email },
            { label: 'CNPJ', value: selected.cnpj },
            { label: 'Telefone', value: selected.telefone },
            { label: 'Setor', value: selected.setor },
            { label: 'Tamanho', value: selected.tamanho },
            { label: 'Site', value: selected.site },
            { label: 'Endereço', value: selected.endereco },
            { label: 'Cadastro', value: formatDate(selected.dataCadastro) },
            { label: 'Vagas publicadas', value: formatNumber(selected.totalVagas) },
            { label: 'Candidatos recebidos', value: formatNumber(selected.totalCandidatos) },
          ]} />
        </AdminModal>
      )}
    </>
  )
}

export default AdminEmpresas
