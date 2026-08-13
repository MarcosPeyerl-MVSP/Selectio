// Objetivo do arquivo: renderizar a página de candidatos do indicador.
// A página valida a sessão do indicador, busca candidatos no Firestore, aplica filtros
// por status e busca textual, e exibe os candidatos em cards.

import './styles/IndicadorCandidatos.css'
import { Link, Navigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { formatCurrency, formatDate as formatLocalizedDate } from '../../i18n/formatters'

// Status disponíveis para filtro na interface.
const statusTabs = [
  { value: 'all', labelKey: 'candidates.tabs.all' },
  { value: 'pre_salvo', labelKey: 'candidates.tabs.preSaved' },
  { value: 'indicado', labelKey: 'candidates.tabs.referred' },
  { value: 'entrevista', labelKey: 'candidates.tabs.interview' },
  { value: 'contratado', labelKey: 'candidates.tabs.hired' },
  { value: 'cancelado', labelKey: 'candidates.tabs.cancelled' }
]

const originLabelKeys = {
  csv: 'candidates.origins.csv',
  manual: 'candidates.origins.manual',
  Indicação: 'candidates.origins.referral',
  LinkedIn: 'candidates.origins.linkedin',
  Portfolio: 'candidates.origins.portfolio',
  GitHub: 'candidates.origins.github'
}

const paymentStatusInfo = {
  created: {
    titleKey: 'candidates.financial.pendingTitle',
    descriptionKey: 'candidates.financial.pendingDescription',
    tone: 'pending',
    icon: FaClock
  },
  pending: {
    titleKey: 'candidates.financial.pendingTitle',
    descriptionKey: 'candidates.financial.pendingDescription',
    tone: 'pending',
    icon: FaClock
  },
  in_process: {
    titleKey: 'candidates.financial.pendingTitle',
    descriptionKey: 'candidates.financial.pendingDescription',
    tone: 'pending',
    icon: FaClock
  },
  authorized: {
    titleKey: 'candidates.financial.pendingTitle',
    descriptionKey: 'candidates.financial.pendingDescription',
    tone: 'pending',
    icon: FaClock
  },
  rejected: {
    titleKey: 'candidates.financial.rejectedTitle',
    descriptionKey: 'candidates.financial.rejectedDescription',
    tone: 'danger',
    icon: FaExclamationTriangle
  },
  cancelled: {
    titleKey: 'candidates.financial.cancelledTitle',
    descriptionKey: 'candidates.financial.cancelledDescription',
    tone: 'danger',
    icon: FaExclamationTriangle
  },
  refunded: {
    titleKey: 'candidates.financial.refundedTitle',
    descriptionKey: 'candidates.financial.refundedDescription',
    tone: 'danger',
    icon: FaExclamationTriangle
  },
  failed: {
    titleKey: 'candidates.financial.failedTitle',
    descriptionKey: 'candidates.financial.failedDescription',
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

function formatDate(value, fallback) {
  return formatLocalizedDate(value, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }) || fallback
}

// Responsabilidade: normalizar textos para busca sem considerar acentos ou maiúsculas.
function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function Candidatos() {
  const { t, i18n } = useTranslation(['referrer', 'common'])
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
  const [activeStatus, setActiveStatus] = useState('all')
  const [filtroVaga, setFiltroVaga] = useState('all')
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
        setError(t('candidates.missingUid'))
        toast.warning(t('candidates.missingUid'))
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
            toast.warning(t('candidates.paymentStatusLoadError'))
            return []
          })
        ])

        setCandidatos(candidatosData)
        setCandidatosPreSalvos(preSalvosData)
        setPagamentos(pagamentosData)
      } catch {
        setError(t('candidates.loadError'))
        toast.error(t('candidates.loadError'))
      } finally {
        setLoading(false)
      }
    }

    fetchCandidatos()
  }, [indicador, indicadorUid, reloadKey, t, toast])

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
      const status = normalizeCandidateStatus(candidato.status)
      const matchesStatus = activeStatus === 'all' || status === activeStatus
      const matchesVaga = filtroVaga === 'all'
        || (filtroVaga === 'no_job' && candidato.tipoRegistro === 'pre_salvo')
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
      .sort((a, b) => a.localeCompare(b, i18n.resolvedLanguage || i18n.language))
  ), [candidatos, i18n.language, i18n.resolvedLanguage])

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
    setActiveStatus('all')
    setFiltroVaga('all')
    setPagina(1)
  }

  const excluirPreSalvo = async (candidato) => {
    const confirmado = await confirm({
      title: t('candidates.deleteConfirmTitle'),
      description: t('candidates.deleteConfirmDescription', { name: candidato.nome || t('candidates.thisCandidate') }),
      confirmLabel: t('candidates.delete')
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
      toast.success(t('candidates.deleted'))
    } catch {
      toast.error(t('candidates.deleteError'))
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
            <span>{t('candidates.eyebrow')}</span>
            <h1>{t('candidates.title')}</h1>
            <p>{t('candidates.description')}</p>
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
                placeholder={t('candidates.searchPlaceholder')}
              />
            </label>

            <label className="candidate-vacancy-filter">
              <span>{t('candidates.job')}</span>
              <select
                value={filtroVaga}
                onChange={(event) => {
                  setFiltroVaga(event.target.value)
                  setPagina(1)
                }}
              >
                <option value="all">{t('candidates.allJobs')}</option>
                {candidatosPreSalvos.length > 0 && <option value="no_job">{t('candidates.noJobSaved')}</option>}
                {vagasDisponiveis.map((vagaTitulo) => (
                  <option key={vagaTitulo} value={vagaTitulo}>{vagaTitulo}</option>
                ))}
              </select>
            </label>

            <div className="candidate-tabs">
              {statusTabs.map((status) => (
                <button
                  key={status.value}
                  className={activeStatus === status.value ? 'active' : ''}
                  onClick={() => {
                    setActiveStatus(status.value)
                    setPagina(1)
                  }}
                  type="button"
                >
                  {t(status.labelKey)}
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
              actionLabel={t('candidates.retry')}
              description={error}
              onAction={tentarNovamente}
              title={navigator.onLine ? t('candidates.loadTitle') : t('candidates.offline')}
              tone={navigator.onLine ? 'error' : 'offline'}
            />
          )}

          {!loading && !error && (
            <>
              {!candidatosFiltrados.length && (
                <EstadoDados
                  actionLabel={registros.length ? t('candidates.clearFilters') : ''}
                  description={registros.length
                    ? t('candidates.filterDescription')
                    : t('candidates.emptyDescription')}
                  onAction={registros.length ? limparFiltros : undefined}
                  title={registros.length ? t('candidates.noResults') : t('candidates.emptyTitle')}
                />
              )}

              <section className="candidate-grid">
              {candidatosPaginados.map((candidato, index) => {
                const normalizedStatus = normalizeCandidateStatus(candidato.status)
                const status = getCandidateStatusLabel(t, normalizedStatus)
                const cardClass = normalizedStatus === 'pre_salvo' ? 'pre-salvo' : normalizedStatus
                const isPreSalvo = candidato.tipoRegistro === 'pre_salvo'
                const pagamento = pagamentosPorCandidato.get(candidato.id)
                const financeiro = normalizedStatus === 'contratado'
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
                    <p>{candidato.cargoAtual || candidato.vagaTitulo || (isPreSalvo ? t('candidates.talentPreSaved') : t('candidates.candidateReferred'))}</p>
                    {isPreSalvo && candidato.email && <small className="candidate-card-email">{candidato.email}</small>}

                    <div className="candidate-meta">
                      <div>
                        <span>{t('candidates.origin')}</span>
                        <strong>{originLabelKeys[candidato.origem]
                          ? t(originLabelKeys[candidato.origem])
                          : candidato.origem || t('candidates.notProvided')}</strong>
                      </div>
                      <div>
                        <span>{isPreSalvo ? t('candidates.savedAt') : normalizedStatus === 'contratado' ? t('candidates.hiredAt') : t('candidates.appliedAt')}</span>
                        <strong>{formatDate(candidato.aplicadoEm || candidato.criadoEm || candidato.createdAt, t('candidates.notProvided'))}</strong>
                      </div>
                    </div>

                    {!isPreSalvo && <LinhaStatusCandidato status={candidato.status || 'indicado'} variant="compact" />}

                    {financeiro && <ResumoFinanceiroIndicacao info={financeiro} />}

                    <div className="candidate-card-actions">
                      <button className="candidate-action-secondary" type="button" onClick={() => setSelectedCandidate(candidato)}>
                        {t('candidates.viewProfile')}
                      </button>
                      {isPreSalvo && (
                        <>
                          <Link className="candidate-action-secondary" to={`/candidatos/indicador/${candidato.id}/editar`}>
                            <FaEdit /> {t('candidates.edit')}
                          </Link>
                          <Link className="candidate-action-primary" to={`/vagas?candidatoPreSalvoId=${encodeURIComponent(candidato.id)}`}>
                            <FaPaperPlane /> {t('candidates.refer')}
                          </Link>
                          <button
                            aria-label={t('candidates.deleteAria', { name: candidato.nome })}
                            className="candidate-action-danger"
                            disabled={excluindoId === candidato.id}
                            onClick={() => excluirPreSalvo(candidato)}
                            type="button"
                          >
                            <FaTrashAlt /> {excluindoId === candidato.id ? t('candidates.excluding') : t('candidates.delete')}
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
                <strong>{t('candidates.addCandidate')}</strong>
                <small>{t('candidates.addMethods')}</small>
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
  const { t } = useTranslation('referrer')
  const Icon = info.icon

  return (
    <div className={`candidate-payment-summary ${info.tone}`}>
      <div className="candidate-payment-summary-main">
        <span className="candidate-payment-summary-icon">
          <Icon />
        </span>

        <div>
          <strong>{t(info.titleKey)}</strong>
          <p>{t(info.descriptionKey)}</p>
        </div>
      </div>

      {(info.value || info.date) && (
        <div className="candidate-payment-summary-meta">
          {info.value && (
            <span>
              {t('candidates.value')}
              <strong>{formatCurrency(info.value)}</strong>
            </span>
          )}

          {info.date && (
            <span>
              {t('candidates.approvedAt')}
              <strong>{formatDate(info.date, t('candidates.notProvided'))}</strong>
            </span>
          )}
        </div>
      )}

      {info.showFinanceLink && (
        <Link className="candidate-payment-link" to="/painel/indicador/dashboard?secao=financeiro">
          <FaExternalLinkAlt /> {t('candidates.openFinance')}
        </Link>
      )}
    </div>
  )
}

function getResumoFinanceiroIndicacao(pagamento) {
  if (!pagamento) {
    return {
      titleKey: 'candidates.financial.hiredTitle',
      descriptionKey: 'candidates.financial.hiredDescription',
      tone: 'waiting',
      icon: FaWallet
    }
  }

  if (pagamento.status === 'approved') {
    const creditado = pagamento.creditado !== false

    return {
      titleKey: 'candidates.financial.receivedTitle',
      descriptionKey: creditado
        ? 'candidates.financial.creditedDescription'
        : 'candidates.financial.processingDescription',
      tone: 'approved',
      icon: FaCheckCircle,
      value: pagamento.valor,
      date: pagamento.aprovadoEm || pagamento.encerradoEm || pagamento.transacaoEm,
      showFinanceLink: true
    }
  }

  const info = paymentStatusInfo[pagamento.status] || {
    titleKey: 'candidates.financial.fallbackTitle',
    descriptionKey: 'candidates.financial.fallbackDescription',
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

function normalizeCandidateStatus(status) {
  if (status === 'recusado') return 'cancelado'
  return status || 'indicado'
}

function getCandidateStatusLabel(t, status) {
  if (status === 'pre_salvo') return t('candidates.tabs.preSaved')
  return t(`common:statuses.candidates.${status}`, { defaultValue: status })
}

export default Candidatos
