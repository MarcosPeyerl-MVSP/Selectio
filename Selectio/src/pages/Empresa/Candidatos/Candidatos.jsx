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

const tabs = ['Todos', 'Indicado', 'Entrevista', 'Contratado', 'Cancelado']

const statusOptions = [
  { value: 'indicado', label: 'Indicado' },
  { value: 'entrevista', label: 'Entrevista' },
  { value: 'contratado', label: 'Contratado' },
  { value: 'cancelado', label: 'Cancelado' },
]

const statusLabels = {
  indicado: 'Indicado',
  entrevista: 'Entrevista',
  contratado: 'Contratado',
  cancelado: 'Cancelado',
  recusado: 'Cancelado',
}

const avatars = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=160&q=80',
]

function getEmpresa() {
  const stored = localStorage.getItem('empresaUser')
  if (!stored) return null

  try {
    return JSON.parse(stored)
  } catch {
    localStorage.removeItem('empresaUser')
    return null
  }
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function formatDate(value) {
  if (!value) return 'Nao informado'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).replace('.', '')
}

function CandidatosEmpresa() {
  const [empresa] = useState(getEmpresa)
  const [candidatos, setCandidatos] = useState([])
  const [busca, setBusca] = useState('')
  const [activeTab, setActiveTab] = useState('Todos')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)

  useEffect(() => {
    const fetchCandidatos = async () => {
      if (!empresa) return

      try {
        const response = await fetch(`http://localhost:3333/empresa/${empresa.id}/candidatos`)
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
  }, [empresa])

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

  if (!empresa) {
    return <Navigate to="/login?redirect=/candidatos/empresa" replace />
  }

  const updateStatus = async (candidatoId, status) => {
    setUpdatingId(candidatoId)
    setError('')

    try {
      const response = await fetch(`http://localhost:3333/candidatos/${candidatoId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, empresaId: empresa.id })
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.erro || 'Erro ao atualizar status')
      }

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
      <Navbar />

      <div className="empresa-candidatos-layout">
        <Sidebar type="empresa" user={empresa} />

        <main className="empresa-candidatos-page">
          <header className="empresa-candidatos-header">
            <span>Gestao de talentos - Q3 pipeline</span>
            <h1>Visualizacao de Candidatos</h1>
            <p>Curadoria estrategica de profissionais em processo seletivo. Analise o progresso das candidaturas atraves do pipeline editorial da Selectio.</p>
            <a href="/vagas">Voltar para minhas vagas</a>
          </header>

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

          {loading && <p className="empresa-candidate-feedback">Carregando candidatos...</p>}
          {error && <p className="empresa-candidate-feedback error">{error}</p>}

          {!loading && !error && (
            <section className="empresa-candidate-grid">
              {candidatosFiltrados.map((candidato, index) => {
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
                      <span><FaUser /> {candidato.indicadorNome ? `Indicacao de ${candidato.indicadorNome}` : candidato.origem}</span>
                      <span><FaCalendarAlt /> Aplicado em {formatDate(candidato.aplicadoEm)}</span>
                    </div>

                    <div className="empresa-candidate-actions">
                      <button type="button">Ver Perfil</button>
                      <button type="button" aria-label="Mais opcoes">
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

      <Footer />
    </>
  )
}

export default CandidatosEmpresa
