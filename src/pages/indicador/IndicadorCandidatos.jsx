// Objetivo do arquivo: renderizar a página de candidatos do indicador.
// A página valida a sessão do indicador, busca candidatos no Firestore, aplica filtros
// por status e busca textual, e exibe os candidatos em cards.

import './styles/IndicadorCandidatos.css'
import { Link, Navigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import {
  FaCheckCircle,
  FaClock,
  FaEdit,
  FaExclamationTriangle,
  FaExternalLinkAlt,
  FaPaperPlane,
  FaPlus,
  FaSearch,
  FaTrashAlt,
  FaWallet,
} from 'react-icons/fa'
import Navbar from '../../components/layout/Navbar'
import Sidebar from '../../components/layout/Sidebar'
import Footer from '../../components/layout/Footer'
import ModalPerfilCandidato from '../../components/ui/ModalPerfilCandidato'
import LinhaStatusCandidato from '../../components/ui/LinhaStatusCandidato'
import CardEsqueleto from '../../components/ui/CardEsqueleto'
import EstadoDados from '../../components/ui/EstadoDados'
import Paginacao from '../../components/ui/Paginacao'
import { listarCandidatosPorIndicador } from '../../services/firestoreCandidatos'
import {
  excluirCandidatoPreSalvo,
  listarCandidatosPreSalvos
} from '../../services/firestoreCandidatosPreSalvos'
import { listarPagamentosPorIndicador } from '../../services/firestorePagamentos'
import { getFirebaseUid } from '../../services/identidadeFirebase'
import { useAuth } from '../../hooks/useAuth'
import { useConfirmacao } from '../../hooks/useConfirmacao'
import { useToast } from '../../hooks/useToast'

// Status disponíveis para filtro na interface.
const statusTabs = ['Todos', 'Pré-salvo', 'Indicado', 'Entrevista', 'Contratado', 'Cancelado']

// Mapeia os status recebidos do Firestore para os textos exibidos ao usuário.
const statusLabels = {
  pre_salvo: 'Pré-salvo',
  indicado: 'Indicado',
  entrevista: 'Entrevista',
  contratado: 'Contratado',
  cancelado: 'Cancelado',
  recusado: 'Cancelado',
}

// Mapeia os status exibidos para classes CSS usadas nos cards.
const statusClass = {
  'Pré-salvo': 'pre-salvo',
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

const PAGE_SIZE = 6

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
  const confirm = useConfirmacao()
  const { perfil: indicador } = useAuth()
  const indicadorUid = getFirebaseUid(indicador)

  // Armazena candidatos retornados pelo Firestore.
  const [candidatos, setCandidatos] = useState([])
  const [candidatosPreSalvos, setCandidatosPreSalvos] = useState([])

  // Armazena pagamentos de recompensa vinculados ao indicador.
  const [pagamentos, setPagamentos] = useState([])

  // Armazena o termo digitado no campo de busca.
  const [busca, setBusca] = useState('')

  // Controla o status ativo nos filtros.
  const [activeStatus, setActiveStatus] = useState('Todos')
  const [filtroVaga, setFiltroVaga] = useState('Todas')
  const [pagina, setPagina] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)

  // Controla o estado de carregamento da busca inicial.
  const [loading, setLoading] = useState(true)

  // Armazena mensagem de erro caso a busca de candidatos falhe.
  const [error, setError] = useState('')

  // Controla o candidato exibido no painel de perfil.
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [excluindoId, setExcluindoId] = useState('')

  useEffect(() => {
    // Responsabilidade: buscar candidatos vinculados ao indicador autenticado.
    const fetchCandidatos = async () => {
      if (!indicador) {
        setLoading(false)
        return
      }

      if (!indicadorUid) {
        setCandidatos([])
        setCandidatosPreSalvos([])
        setPagamentos([])
        setError('Perfil do indicador sem UID do Firebase.')
        toast.warning('Perfil do indicador sem UID do Firebase.')
        setLoading(false)
        return
      }

      try {
        setError('')
        const [candidatosData, preSalvosData, pagamentosData] = await Promise.all([
          listarCandidatosPorIndicador(indicadorUid),
          listarCandidatosPreSalvos(indicadorUid),
          listarPagamentosPorIndicador(indicadorUid).catch((err) => {
            console.warn('Não foi possível carregar pagamentos do indicador:', err)
            toast.warning('Não foi possível carregar o status financeiro das indicações.')
            return []
          })
        ])

        setCandidatos(candidatosData)
        setCandidatosPreSalvos(preSalvosData)
        setPagamentos(pagamentosData)
      } catch (err) {
        setError(err.message)
        toast.error('Não foi possível carregar seus candidatos.')
      } finally {
        setLoading(false)
      }
    }

    fetchCandidatos()
  }, [indicador, indicadorUid, toast, reloadKey])

  const registros = useMemo(() => ([
    ...candidatos.map((candidato) => ({
      ...candidato,
      tipoRegistro: 'indicacao',
      registroKey: `indicacao-${candidato.id}`
    })),
    ...candidatosPreSalvos.map((candidato) => ({
      ...candidato,
      status: 'pre_salvo',
      tipoRegistro: 'pre_salvo',
      registroKey: `pre-salvo-${candidato.id}`
    }))
  ].sort((a, b) => {
    const dataA = new Date(a.atualizadoEm || a.updatedAt || a.criadoEm || a.createdAt || a.aplicadoEm || 0).getTime()
    const dataB = new Date(b.atualizadoEm || b.updatedAt || b.criadoEm || b.createdAt || b.aplicadoEm || 0).getTime()
    return dataB - dataA
  })), [candidatos, candidatosPreSalvos])

  // Filtra candidatos por status selecionado e termo de busca.
  const candidatosFiltrados = useMemo(() => {
    const termo = normalizeText(busca)

    return registros.filter((candidato) => {
      const status = statusLabels[candidato.status] || 'Indicado'
      const matchesStatus = activeStatus === 'Todos' || status === activeStatus
      const matchesVaga = filtroVaga === 'Todas'
        || (filtroVaga === 'Sem vaga' && candidato.tipoRegistro === 'pre_salvo')
        || candidato.vagaTitulo === filtroVaga
      const matchesBusca = !termo || [
        candidato.nome,
        candidato.email,
        candidato.cargoAtual,
        candidato.vagaTitulo,
        candidato.vagaEmpresa,
      ].some((value) => normalizeText(value).includes(termo))

      return matchesStatus && matchesVaga && matchesBusca
    })
  }, [activeStatus, busca, filtroVaga, registros])

  const vagasDisponiveis = useMemo(() => (
    [...new Set(candidatos.map((candidato) => candidato.vagaTitulo).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
  ), [candidatos])

  const totalPaginas = Math.max(1, Math.ceil(candidatosFiltrados.length / PAGE_SIZE))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const candidatosPaginados = candidatosFiltrados.slice(
    (paginaAtual - 1) * PAGE_SIZE,
    paginaAtual * PAGE_SIZE
  )

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

  const tentarNovamente = () => {
    setLoading(true)
    setReloadKey((value) => value + 1)
  }

  const limparFiltros = () => {
    setBusca('')
    setActiveStatus('Todos')
    setFiltroVaga('Todas')
    setPagina(1)
  }

  const excluirPreSalvo = async (candidato) => {
    const confirmado = await confirm({
      title: 'Excluir candidato pré-salvo?',
      description: `${candidato.nome || 'Este candidato'} será removido da sua base privada. Indicações já enviadas não serão alteradas.`,
      confirmLabel: 'Excluir'
    })

    if (!confirmado) return

    setExcluindoId(candidato.id)

    try {
      await excluirCandidatoPreSalvo({
        candidatoId: candidato.id,
        indicadorId: indicadorUid
      })
      setCandidatosPreSalvos((atuais) => atuais.filter((item) => item.id !== candidato.id))
      setSelectedCandidate((atual) => atual?.id === candidato.id ? null : atual)
      toast.success('Candidato pré-salvo excluído.')
    } catch (err) {
      toast.error(err.message || 'Não foi possível excluir o candidato.')
    } finally {
      setExcluindoId('')
    }
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
            <span>Recrutamento ativo</span>
            <h1>Candidatos</h1>
            <p>Gerencie o fluxo de talentos e acompanhe o progresso das suas vagas abertas com precisão editorial.</p>
          </header>

          {/* Barra de busca e filtros por status. */}
          <section className="candidatos-toolbar">
            <label className="candidate-search">
              <FaSearch />
              <input
                value={busca}
                onChange={(event) => {
                  setBusca(event.target.value)
                  setPagina(1)
                }}
                placeholder="Buscar por nome, cargo ou palavra-chave..."
              />
            </label>

            <label className="candidate-vacancy-filter">
              <span>Vaga</span>
              <select
                value={filtroVaga}
                onChange={(event) => {
                  setFiltroVaga(event.target.value)
                  setPagina(1)
                }}
              >
                <option value="Todas">Todas as vagas</option>
                {candidatosPreSalvos.length > 0 && <option value="Sem vaga">Sem vaga (pré-salvos)</option>}
                {vagasDisponiveis.map((vagaTitulo) => (
                  <option key={vagaTitulo} value={vagaTitulo}>{vagaTitulo}</option>
                ))}
              </select>
            </label>

            <div className="candidate-tabs">
              {statusTabs.map((status) => (
                <button
                  key={status}
                  className={activeStatus === status ? 'active' : ''}
                  onClick={() => {
                    setActiveStatus(status)
                    setPagina(1)
                  }}
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
          {!loading && error && (
            <EstadoDados
              actionLabel="Tentar novamente"
              description={error}
              onAction={tentarNovamente}
              title={navigator.onLine ? 'Não foi possível carregar seus candidatos' : 'Você está sem conexão'}
              tone={navigator.onLine ? 'error' : 'offline'}
            />
          )}

          {!loading && !error && (
            <>
              {!candidatosFiltrados.length && (
                <EstadoDados
                  actionLabel={registros.length ? 'Limpar filtros' : ''}
                  description={registros.length
                    ? 'Ajuste a busca, a vaga ou a etapa para visualizar outros resultados.'
                    : 'Cadastre um talento para mantê-lo na sua base ou escolha uma vaga para fazer uma indicação.'}
                  onAction={registros.length ? limparFiltros : undefined}
                  title={registros.length ? 'Nenhum candidato encontrado' : 'Sua base de candidatos ainda está vazia'}
                />
              )}

              <section className="candidate-grid">
              {candidatosPaginados.map((candidato, index) => {
                const status = statusLabels[candidato.status] || 'Indicado'
                const cardClass = statusClass[status] || 'indicado'
                const isPreSalvo = candidato.tipoRegistro === 'pre_salvo'
                const pagamento = pagamentosPorCandidato.get(candidato.id)
                const financeiro = status === 'Contratado'
                  ? getResumoFinanceiroIndicacao(pagamento)
                  : null

                return (
                  <article className={`candidate-card ${cardClass}`} key={candidato.registroKey}>
                    <div className="candidate-card-top">
                      <div className="candidate-avatar-wrap">
                        <img src={avatars[index % avatars.length]} alt={candidato.nome} />
                        <span />
                      </div>
                      <strong className="candidate-status">{status}</strong>
                    </div>

                    <h2>{candidato.nome}</h2>
                    <p>{candidato.cargoAtual || candidato.vagaTitulo || (isPreSalvo ? 'Talento pré-salvo' : 'Candidato indicado')}</p>
                    {isPreSalvo && candidato.email && <small className="candidate-card-email">{candidato.email}</small>}

                    <div className="candidate-meta">
                      <div>
                        <span>Origem</span>
                        <strong>{candidato.origem === 'csv' ? 'CSV' : candidato.origem === 'manual' ? 'Manual' : candidato.origem}</strong>
                      </div>
                      <div>
                        <span>{isPreSalvo ? 'Salvo em' : status === 'Contratado' ? 'Contratado em' : 'Aplicado em'}</span>
                        <strong>{formatDate(candidato.aplicadoEm || candidato.criadoEm || candidato.createdAt)}</strong>
                      </div>
                    </div>

                    {!isPreSalvo && <LinhaStatusCandidato status={candidato.status || 'indicado'} variant="compact" />}

                    {financeiro && <ResumoFinanceiroIndicacao info={financeiro} />}

                    <div className="candidate-card-actions">
                      <button className="candidate-action-secondary" type="button" onClick={() => setSelectedCandidate(candidato)}>
                        Ver perfil
                      </button>
                      {isPreSalvo && (
                        <>
                          <Link className="candidate-action-secondary" to={`/candidatos/indicador/${candidato.id}/editar`}>
                            <FaEdit /> Editar
                          </Link>
                          <Link className="candidate-action-primary" to={`/vagas?candidatoPreSalvoId=${encodeURIComponent(candidato.id)}`}>
                            <FaPaperPlane /> Indicar
                          </Link>
                          <button
                            aria-label={`Excluir ${candidato.nome}`}
                            className="candidate-action-danger"
                            disabled={excluindoId === candidato.id}
                            onClick={() => excluirPreSalvo(candidato)}
                            type="button"
                          >
                            <FaTrashAlt /> {excluindoId === candidato.id ? 'Excluindo...' : 'Excluir'}
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                )
              })}

              <Link className="candidate-add-card" to="/candidatos/indicador/novo">
                <span>
                  <FaPlus />
                </span>
                <strong>Adicionar candidato</strong>
                <small>Manualmente ou via CSV</small>
              </Link>
              </section>
              {candidatosFiltrados.length > 0 && (
                <Paginacao
                  page={paginaAtual}
                  pageSize={PAGE_SIZE}
                  total={candidatosFiltrados.length}
                  onPageChange={setPagina}
                />
              )}
            </>
          )}
        </main>
      </div>

      {selectedCandidate && (
        <ModalPerfilCandidato
          key={selectedCandidate.id}
          candidato={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          variant={selectedCandidate.tipoRegistro === 'pre_salvo' ? 'preSalvo' : 'processo'}
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
