import './Candidatos.css'
import { Link, Navigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import {
  FaPlus,
  FaSearch,
} from 'react-icons/fa'
import Navbar from '../../../components/Navbar/Navbar/Navbar'
import Sidebar from '../../../components/Sidebar/Sidebar'
import Footer from '../../../components/Footer/Footer'

const statusTabs = ['Todos', 'Indicado', 'Entrevista', 'Contratado', 'Cancelado']

const statusLabels = {
  indicado: 'Indicado',
  entrevista: 'Entrevista',
  contratado: 'Contratado',
  cancelado: 'Cancelado',
  recusado: 'Cancelado',
}

const statusClass = {
  Indicado: 'indicado',
  Entrevista: 'entrevista',
  Contratado: 'contratado',
  Cancelado: 'cancelado',
}

const avatars = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=160&q=80',
]

function getIndicador() {
  const stored = localStorage.getItem('indicadorUser')
  if (!stored) return null

  try {
    return JSON.parse(stored)
  } catch {
    localStorage.removeItem('indicadorUser')
    return null
  }
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

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function Candidatos() {
  const [indicador] = useState(getIndicador)
  const [candidatos, setCandidatos] = useState([])
  const [busca, setBusca] = useState('')
  const [activeStatus, setActiveStatus] = useState('Todos')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchCandidatos = async () => {
      if (!indicador) return

      try {
        const response = await fetch(`http://localhost:3333/indicador/${indicador.id}/candidatos`)
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
  }, [indicador])

  const candidatosFiltrados = useMemo(() => {
    const termo = normalizeText(busca)

    return candidatos.filter((candidato) => {
      const status = statusLabels[candidato.status] || 'Indicado'
      const matchesStatus = activeStatus === 'Todos' || status === activeStatus
      const matchesBusca = !termo || [
        candidato.nome,
        candidato.cargoAtual,
        candidato.vagaTitulo,
        candidato.vagaEmpresa,
      ].some((value) => normalizeText(value).includes(termo))

      return matchesStatus && matchesBusca
    })
  }, [activeStatus, busca, candidatos])

  if (!indicador) {
    return <Navigate to="/login?redirect=/candidatos/indicador" replace />
  }

  return (
    <>
      <Navbar />

      <div className="candidatos-layout">
        <Sidebar type="indicador" user={indicador} />

        <main className="candidatos-page">
          <header className="candidatos-header">
            <span>Recrutamento ativo - Maio 2026</span>
            <h1>Candidatos</h1>
            <p>Gerencie o fluxo de talentos e acompanhe o progresso das suas vagas abertas com precisao editorial.</p>
          </header>

          <section className="candidatos-toolbar">
            <label className="candidate-search">
              <FaSearch />
              <input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar por nome, cargo ou palavra-chave..."
              />
            </label>

            <div className="candidate-tabs">
              {statusTabs.map((status) => (
                <button
                  key={status}
                  className={activeStatus === status ? 'active' : ''}
                  onClick={() => setActiveStatus(status)}
                  type="button"
                >
                  {status}
                </button>
              ))}
            </div>
          </section>

          {loading && <p className="candidate-feedback">Carregando candidatos...</p>}
          {error && <p className="candidate-feedback error">{error}</p>}

          {!loading && !error && (
            <section className="candidate-grid">
              {candidatosFiltrados.map((candidato, index) => {
                const status = statusLabels[candidato.status] || 'Indicado'
                const cardClass = statusClass[status] || 'indicado'

                return (
                  <article className={`candidate-card ${cardClass}`} key={candidato.id}>
                    <div className="candidate-card-top">
                      <div className="candidate-avatar-wrap">
                        <img src={avatars[index % avatars.length]} alt={candidato.nome} />
                        <span />
                      </div>
                      <strong className="candidate-status">{status}</strong>
                    </div>

                    <h2>{candidato.nome}</h2>
                    <p>{candidato.cargoAtual || candidato.vagaTitulo || 'Candidato indicado'}</p>

                    <div className="candidate-meta">
                      <div>
                        <span>Origem</span>
                        <strong>{candidato.origem}</strong>
                      </div>
                      <div>
                        <span>{status === 'Contratado' ? 'Contratado em' : 'Aplicado em'}</span>
                        <strong>{formatDate(candidato.aplicadoEm)}</strong>
                      </div>
                    </div>
                  </article>
                )
              })}

              <Link className="candidate-add-card" to="/vagas">
                <span>
                  <FaPlus />
                </span>
                <strong>Adicionar candidato</strong>
                <small>Manualmente ou via CSV</small>
              </Link>
            </section>
          )}
        </main>
      </div>

      <Footer />
    </>
  )
}

export default Candidatos
