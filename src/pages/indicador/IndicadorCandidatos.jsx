// Objetivo do arquivo: renderizar a página de candidatos do indicador.
// A página valida a sessão do indicador, busca candidatos no Firestore, aplica filtros
// por status e busca textual, e exibe os candidatos em cards.

import './styles/IndicadorCandidatos.css'
import { Link, Navigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import {
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaExternalLinkAlt,
  FaPlus,
  FaSearch,
  FaWallet,
} from 'react-icons/fa'
import Navbar from '../../components/layout/Navbar'
import Sidebar from '../../components/layout/Sidebar'
import Footer from '../../components/layout/Footer'
import ModalPerfilCandidato from '../../components/ui/ModalPerfilCandidato'
import LinhaStatusCandidato from '../../components/ui/LinhaStatusCandidato'
import CardEsqueleto from '../../components/ui/CardEsqueleto'
import { listarCandidatosPorIndicador } from '../../services/firestoreCandidatos'
import { listarPagamentosPorIndicador } from '../../services/firestorePagamentos'
import { getFirebaseUid } from '../../services/identidadeFirebase'
import { useToast } from '../../hooks/useToast'

// Status disponíveis para filtro na interface.
const statusTabs = ['Todos', 'Indicado', 'Entrevista', 'Contratado', 'Cancelado']

// Mapeia os status recebidos do Firestore para os textos exibidos ao usuário.
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

const paymentStatusInfo = {
  created: {
    title: 'Pagamento pendente',
    description: 'Aguardando confirmação do Mercado Pago.',
    tone: 'pending',
    icon: FaClock
  },
  pending: {
    title: 'Pagamento pendente',
    description: 'Aguardando confirmação do Mercado Pago.',
    tone: 'pending',
    icon: FaClock
  },
  in_process: {
    title: 'Pagamento pendente',
    description: 'Aguardando confirmação do Mercado Pago.',
    tone: 'pending',
    icon: FaClock
  },
  authorized: {
    title: 'Pagamento pendente',
    description: 'Aguardando confirmação do Mercado Pago.',
    tone: 'pending',
    icon: FaClock
  },
  rejected: {
    title: 'Pagamento recusado',
    description: 'Mercado Pago recusou a transação. A recompensa não foi creditada.',
    tone: 'danger',
    icon: FaExclamationTriangle
  },
  cancelled: {
    title: 'Pagamento cancelado',
    description: 'A transação foi cancelada. A recompensa não foi creditada.',
    tone: 'danger',
    icon: FaExclamationTriangle
  },
  refunded: {
    title: 'Pagamento estornado',
    description: 'O valor foi estornado. A recompensa não fica disponível no saldo.',
    tone: 'danger',
    icon: FaExclamationTriangle
  },
  failed: {
    title: 'Pagamento falhou',
    description: 'Não foi possível confirmar o pagamento. A recompensa não foi creditada.',
    tone: 'danger',
    icon: FaExclamationTriangle
  }
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
  const toast = useToast()
  // Mantém os dados do indicador autenticado durante a renderização da página.
  const [indicador] = useState(getIndicador)
  const indicadorUid = getFirebaseUid(indicador)

  // Armazena candidatos retornados pelo Firestore.
  const [candidatos, setCandidatos] = useState([])

  // Armazena pagamentos de recompensa vinculados ao indicador.
  const [pagamentos, setPagamentos] = useState([])

  // Armazena o termo digitado no campo de busca.
  const [busca, setBusca] = useState('')

  // Controla o status ativo nos filtros.
  const [activeStatus, setActiveStatus] = useState('Todos')

  // Controla o estado de carregamento da busca inicial.
  const [loading, setLoading] = useState(true)

  // Armazena mensagem de erro caso a busca de candidatos falhe.
  const [error, setError] = useState('')

  // Controla o candidato exibido no painel de perfil.
  const [selectedCandidate, setSelectedCandidate] = useState(null)

  useEffect(() => {
    // Responsabilidade: buscar candidatos vinculados ao indicador autenticado.
    const fetchCandidatos = async () => {
      if (!indicador) {
        setLoading(false)
        return
      }

      if (!indicadorUid) {
        setCandidatos([])
        setPagamentos([])
        setError('Perfil do indicador sem UID do Firebase.')
        toast.warning('Perfil do indicador sem UID do Firebase.')
        setLoading(false)
        return
      }

      try {
        const [candidatosData, pagamentosData] = await Promise.all([
          listarCandidatosPorIndicador(indicadorUid),
          listarPagamentosPorIndicador(indicadorUid).catch((err) => {
            console.warn('Não foi possível carregar pagamentos do indicador:', err)
            toast.warning('Não foi possível carregar o status financeiro das indicações.')
            return []
          })
        ])

        setCandidatos(candidatosData)
        setPagamentos(pagamentosData)
      } catch (err) {
        setError(err.message)
        toast.error('Não foi possível carregar seus candidatos.')
      } finally {
        setLoading(false)
      }
    }

    fetchCandidatos()
  }, [indicador, indicadorUid, toast])

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

  const pagamentosPorCandidato = useMemo(() => {
    const mapa = new Map()

    pagamentos.forEach((pagamento) => {
      if (!pagamento.candidatoId) return

      const atual = mapa.get(pagamento.candidatoId)

      if (!atual || deveUsarPagamento(pagamento, atual)) {
        mapa.set(pagamento.candidatoId, pagamento)
      }
    })

    return mapa
  }, [pagamentos])

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
          {loading && (
            <section className="candidate-grid">
              <CardEsqueleto count={6} />
            </section>
          )}
          {error && <p className="candidate-feedback error">{error}</p>}

          {!loading && !error && (
            <section className="candidate-grid">
              {candidatosFiltrados.map((candidato, index) => {
                const status = statusLabels[candidato.status] || 'Indicado'
                const cardClass = statusClass[status] || 'indicado'
                const pagamento = pagamentosPorCandidato.get(candidato.id)
                const financeiro = status === 'Contratado'
                  ? getResumoFinanceiroIndicacao(pagamento)
                  : null

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

                    <LinhaStatusCandidato status={candidato.status || 'indicado'} variant="compact" />

                    {financeiro && <ResumoFinanceiroIndicacao info={financeiro} />}

                    <div className="candidate-card-actions">
                      <button type="button" onClick={() => setSelectedCandidate(candidato)}>
                        Ver Perfil
                      </button>
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

      {selectedCandidate && (
        <ModalPerfilCandidato
          candidato={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
        />
      )}

      {/* Componente de rodapé. */}
      <Footer />
    </>
  )
}

function ResumoFinanceiroIndicacao({ info }) {
  const Icon = info.icon

  return (
    <div className={`candidate-payment-summary ${info.tone}`}>
      <div className="candidate-payment-summary-main">
        <span className="candidate-payment-summary-icon">
          <Icon />
        </span>

        <div>
          <strong>{info.title}</strong>
          <p>{info.description}</p>
        </div>
      </div>

      {(info.value || info.date) && (
        <div className="candidate-payment-summary-meta">
          {info.value && (
            <span>
              Valor
              <strong>{formatCurrency(info.value)}</strong>
            </span>
          )}

          {info.date && (
            <span>
              Aprovado em
              <strong>{formatDate(info.date)}</strong>
            </span>
          )}
        </div>
      )}

      {info.showFinanceLink && (
        <Link className="candidate-payment-link" to="/painel/indicador?secao=financeiro">
          <FaExternalLinkAlt /> Abrir financeiro
        </Link>
      )}
    </div>
  )
}

function getResumoFinanceiroIndicacao(pagamento) {
  if (!pagamento) {
    return {
      title: 'Candidato contratado',
      description: 'Recompensa aguardando pagamento da empresa.',
      tone: 'waiting',
      icon: FaWallet
    }
  }

  if (pagamento.status === 'approved') {
    const creditado = pagamento.creditado !== false

    return {
      title: 'Recompensa recebida',
      description: creditado
        ? 'Valor creditado no financeiro.'
        : 'Pagamento aprovado pelo Mercado Pago. Crédito em processamento.',
      tone: 'approved',
      icon: FaCheckCircle,
      value: pagamento.valor,
      date: pagamento.aprovadoEm || pagamento.encerradoEm || pagamento.transacaoEm,
      showFinanceLink: true
    }
  }

  const info = paymentStatusInfo[pagamento.status] || {
    title: 'Status do pagamento',
    description: 'Acompanhe a atualização da recompensa.',
    tone: 'pending',
    icon: FaClock
  }

  return info
}

function deveUsarPagamento(novo, atual) {
  if (novo.status === 'approved' && atual.status !== 'approved') return true
  if (atual.status === 'approved' && novo.status !== 'approved') return false

  const dataAtual = new Date(atual.criadoEm || atual.atualizadoEm || 0).getTime()
  const dataNova = new Date(novo.criadoEm || novo.atualizadoEm || 0).getTime()

  return dataNova >= dataAtual
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

export default Candidatos
