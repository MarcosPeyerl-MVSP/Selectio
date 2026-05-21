// Objetivo do arquivo: renderizar a página de candidatos da empresa.
// A página valida a sessão da empresa, busca candidatos vinculados às vagas da empresa,
// permite filtro por status e busca textual, e atualiza o status dos candidatos pela API.

import './Candidatos.css'
import { Navigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import {
  FaCalendarAlt,
  FaChevronDown,
  FaEllipsisH,
  FaSearch,
  FaUser,
} from 'react-icons/fa'
import Navbar from '../../../components/Navbar/Navbar/Navbar'
import Sidebar from '../../../components/Sidebar/Sidebar'
import Footer from '../../../components/Footer/Footer'
import { getLegacyId } from '../../../services/legacyIds'

// Abas de filtro exibidas na interface.
const tabs = ['Todos', 'Indicado', 'Entrevista', 'Contratado', 'Cancelado']

// Opções disponíveis para alteração de status do candidato.
const statusOptions = [
  { value: 'indicado', label: 'Indicado' },
  { value: 'entrevista', label: 'Entrevista' },
  { value: 'contratado', label: 'Contratado' },
  { value: 'cancelado', label: 'Cancelado' },
]

// Mapeia status retornados pela API para os textos exibidos na interface.
const statusLabels = {
  indicado: 'Indicado',
  entrevista: 'Entrevista',
  contratado: 'Contratado',
  cancelado: 'Cancelado',
  recusado: 'Cancelado',
}

// Lista de imagens usadas como avatares visuais dos candidatos.
const avatars = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=160&q=80',
]

// Responsabilidade: recuperar a empresa autenticada salva no localStorage.
function getEmpresa() {
  const stored = localStorage.getItem('empresaUser')
  if (!stored) return null

  try {
    return JSON.parse(stored)
  } catch {
    // Fluxo de segurança: remove a sessão se o dado salvo não for um JSON válido.
    localStorage.removeItem('empresaUser')
    return null
  }
}

// Responsabilidade: normalizar textos para busca sem considerar acentos ou maiúsculas.
function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

// Responsabilidade: formatar datas para exibição no padrão brasileiro.
function formatDate(value) {
  if (!value) return 'Não informado'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).replace('.', '')
}

function CandidatosEmpresa() {
  // Mantém os dados da empresa autenticada durante a renderização da página.
  const [empresa] = useState(getEmpresa)
  const legacyEmpresaId = getLegacyId(empresa)

  // Armazena candidatos retornados pela API.
  const [candidatos, setCandidatos] = useState([])

  // Armazena o termo digitado no campo de busca.
  const [busca, setBusca] = useState('')

  // Controla a aba de status ativa.
  const [activeTab, setActiveTab] = useState('Todos')

  // Controla o carregamento inicial da lista.
  const [loading, setLoading] = useState(true)

  // Armazena mensagens de erro de busca ou atualização.
  const [error, setError] = useState('')

  // Controla qual candidato está com status em atualização.
  const [updatingId, setUpdatingId] = useState(null)

  useEffect(() => {
    // Responsabilidade: buscar candidatos vinculados às vagas da empresa autenticada.
    const fetchCandidatos = async () => {
      if (!empresa) return

      if (!legacyEmpresaId) {
        setCandidatos([])
        setLoading(false)
        return
      }

      try {
        const response = await fetch(`http://localhost:3333/empresa/${legacyEmpresaId}/candidatos`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.erro || 'Erro ao buscar candidatos')
        }

        setCandidatos(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchCandidatos()
  }, [empresa, legacyEmpresaId])

  // Filtra candidatos por status selecionado e termo de busca.
  const candidatosFiltrados = useMemo(() => {
    const termo = normalizeText(busca)

    return candidatos.filter((candidato) => {
      const status = statusLabels[candidato.status] || 'Indicado'
      const matchesStatus = activeTab === 'Todos' || status === activeTab
      const matchesBusca = !termo || [
        candidato.nome,
        candidato.cargoAtual,
        candidato.vagaTitulo,
        candidato.indicadorNome,
      ].some((value) => normalizeText(value).includes(termo))

      return matchesStatus && matchesBusca
    })
  }, [activeTab, busca, candidatos])

  // Regra de acesso: sem empresa autenticada, redireciona para login.
  if (!empresa) {
    return <Navigate to="/login?redirect=/candidatos/empresa" replace />
  }

  // Responsabilidade: atualizar o status de um candidato pela API.
  const updateStatus = async (candidatoId, status) => {
    setUpdatingId(candidatoId)
    setError('')

    if (!legacyEmpresaId) {
      setError('Atualizacao de candidatos ainda depende do perfil legado da empresa.')
      setUpdatingId(null)
      return
    }

    try {
      const response = await fetch(`http://localhost:3333/candidatos/${candidatoId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, empresaId: legacyEmpresaId })
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.erro || 'Erro ao atualizar status')
      }

      // Atualiza localmente o status do candidato alterado.
      setCandidatos((current) => current.map((candidato) => (
        candidato.id === candidatoId ? { ...candidato, status } : candidato
      )))
    } catch (err) {
      setError(err.message)
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <>
      {/* Componente de navegação principal. */}
      <Navbar />

      <div className="empresa-candidatos-layout">
        {/* Menu lateral do painel da empresa. */}
        <Sidebar type="empresa" user={empresa} />

        <main className="empresa-candidatos-page">
          <header className="empresa-candidatos-header">
            <span>Gestão de talentos - Q3 pipeline</span>
            <h1>Visualização de Candidatos</h1>
            <p>Curadoria estratégica de profissionais em processo seletivo. Analise o progresso das candidaturas através do pipeline editorial da Selectio.</p>
            <a href="/vagas">Voltar para minhas vagas</a>
          </header>

          {/* Barra de busca e filtros por status. */}
          <section className="empresa-candidatos-toolbar">
            <label className="empresa-candidate-search">
              <FaSearch />
              <input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar por nome ou cargo..."
              />
            </label>

            <div className="empresa-candidate-tabs">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={activeTab === tab ? 'active' : ''}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          </section>

          {/* Mensagens de carregamento e erro. */}
          {loading && <p className="empresa-candidate-feedback">Carregando candidatos...</p>}
          {error && <p className="empresa-candidate-feedback error">{error}</p>}

          {!loading && !error && (
            <section className="empresa-candidate-grid">
              {candidatosFiltrados.map((candidato, index) => {
                // Regra de normalização: status "recusado" é tratado visualmente como "cancelado".
                const status = candidato.status === 'recusado' ? 'cancelado' : candidato.status || 'indicado'

                return (
                  <article className="empresa-candidate-card" key={candidato.id}>
                    <div className="empresa-candidate-top">
                      <img src={avatars[index % avatars.length]} alt={candidato.nome} />

                      <label className={`empresa-status-select ${status}`}>
                        <select
                          value={status}
                          onChange={(event) => updateStatus(candidato.id, event.target.value)}
                          disabled={updatingId === candidato.id}
                        >
                          {statusOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <h2>{candidato.nome}</h2>
                    <p>{candidato.cargoAtual || candidato.vagaTitulo || 'Candidato indicado'}</p>

                    <div className="empresa-candidate-details">
                      <span><FaUser /> {candidato.indicadorNome ? `Indicação de ${candidato.indicadorNome}` : candidato.origem}</span>
                      <span><FaCalendarAlt /> Aplicado em {formatDate(candidato.aplicadoEm)}</span>
                    </div>

                    <div className="empresa-candidate-actions">
                      <button type="button">Ver Perfil</button>
                      <button type="button" aria-label="Mais opções">
                        <FaEllipsisH />
                      </button>
                    </div>
                  </article>
                )
              })}

              <button className="empresa-load-more" type="button">
                <span><FaChevronDown /></span>
                <strong>Visualizar mais candidatos</strong>
                <small>Carregar registros adicionais do banco de talentos Q3.</small>
              </button>
            </section>
          )}
        </main>
      </div>

      {/* Componente de rodapé. */}
      <Footer />
    </>
  )
}

export default CandidatosEmpresa
