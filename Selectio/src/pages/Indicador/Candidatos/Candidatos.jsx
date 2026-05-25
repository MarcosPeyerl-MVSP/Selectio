// Objetivo do arquivo: renderizar a página de candidatos do indicador.
// A página valida a sessão do indicador, busca candidatos na API, aplica filtros
// por status e busca textual, e exibe os candidatos em cards.

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
import { listarCandidatosPorIndicador } from '../../../services/firestoreCandidatos'
import { getFirebaseUid } from '../../../services/legacyIds'

// Status disponíveis para filtro na interface.
const statusTabs = ['Todos', 'Indicado', 'Entrevista', 'Contratado', 'Cancelado']

// Mapeia os status recebidos da API para os textos exibidos ao usuário.
const statusLabels = {
  indicado: 'Indicado',
  entrevista: 'Entrevista',
  contratado: 'Contratado',
  cancelado: 'Cancelado',
  recusado: 'Cancelado',
}

// Mapeia os status exibidos para classes CSS usadas nos cards.
const statusClass = {
  Indicado: 'indicado',
  Entrevista: 'entrevista',
  Contratado: 'contratado',
  Cancelado: 'cancelado',
}

// Lista de imagens usadas como avatares visuais dos candidatos.
const avatars = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=160&q=80',
]

// Responsabilidade: recuperar o indicador autenticado no localStorage.
function getIndicador() {
  const stored = localStorage.getItem('indicadorUser')
  if (!stored) return null

  try {
    return JSON.parse(stored)
  } catch {
    // Fluxo de segurança: remove a sessão se o dado salvo não for um JSON válido.
    localStorage.removeItem('indicadorUser')
    return null
  }
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

// Responsabilidade: normalizar textos para busca sem considerar acentos ou maiúsculas.
function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function Candidatos() {
  // Mantém os dados do indicador autenticado durante a renderização da página.
  const [indicador] = useState(getIndicador)
  const indicadorUid = getFirebaseUid(indicador)

  // Armazena candidatos retornados pela API.
  const [candidatos, setCandidatos] = useState([])

  // Armazena o termo digitado no campo de busca.
  const [busca, setBusca] = useState('')

  // Controla o status ativo nos filtros.
  const [activeStatus, setActiveStatus] = useState('Todos')

  // Controla o estado de carregamento da busca inicial.
  const [loading, setLoading] = useState(true)

  // Armazena mensagem de erro caso a busca de candidatos falhe.
  const [error, setError] = useState('')

  useEffect(() => {
    // Responsabilidade: buscar candidatos vinculados ao indicador autenticado.
    const fetchCandidatos = async () => {
      if (!indicador) {
        setLoading(false)
        return
      }

      if (!indicadorUid) {
        setCandidatos([])
        setError('Perfil do indicador sem UID do Firebase.')
        setLoading(false)
        return
      }

      try {
        const data = await listarCandidatosPorIndicador(indicadorUid)
        setCandidatos(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchCandidatos()
  }, [indicador, indicadorUid])

  // Filtra candidatos por status selecionado e termo de busca.
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

  // Regra de acesso: sem indicador autenticado, redireciona para login.
  if (!indicador) {
    return <Navigate to="/login?redirect=/candidatos/indicador" replace />
  }

  return (
    <>
      {/* Componente de navegação principal. */}
      <Navbar />

      <div className="candidatos-layout">
        {/* Menu lateral do painel do indicador. */}
        <Sidebar type="indicador" user={indicador} />

        <main className="candidatos-page">
          <header className="candidatos-header">
            <span>Recrutamento ativo - Maio 2026</span>
            <h1>Candidatos</h1>
            <p>Gerencie o fluxo de talentos e acompanhe o progresso das suas vagas abertas com precisão editorial.</p>
          </header>

          {/* Barra de busca e filtros por status. */}
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

          {/* Mensagens de carregamento e erro da busca de candidatos. */}
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

              {/* Link para a página de vagas, usada como entrada para adicionar candidato. */}
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

      {/* Componente de rodapé. */}
      <Footer />
    </>
  )
}

export default Candidatos
