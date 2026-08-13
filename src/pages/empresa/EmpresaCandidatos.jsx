// Objetivo do arquivo: renderizar a página de candidatos da empresa.
// A página valida a sessão da empresa, busca candidatos vinculados às vagas da empresa,
// permite filtro por status e busca textual, e atualiza o status dos candidatos no Firestore.

import './styles/EmpresaCandidatos.css'
import { Navigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FaCalendarAlt,
  FaCreditCard,
  FaEllipsisH,
  FaSearch,
  FaUser,
} from 'react-icons/fa'
import Navbar from '../../components/layout/Navbar'
import Sidebar from '../../components/layout/Sidebar'
import Footer from '../../components/layout/Footer'
import ModalPagamentoRecompensa from '../../components/pagamentos/ModalPagamentoRecompensa'
import ModalPerfilCandidato from '../../components/ui/ModalPerfilCandidato'
import LinhaStatusCandidato from '../../components/ui/LinhaStatusCandidato'
import CardEsqueleto from '../../components/ui/CardEsqueleto'
import EstadoDados from '../../components/ui/EstadoDados'
import Paginacao from '../../components/ui/Paginacao'
import { atualizarStatusCandidato, listarCandidatosPorEmpresa } from '../../services/firestoreCandidatos'
import { getFirebaseUid } from '../../services/identidadeFirebase'
import { listarPagamentosPorEmpresa } from '../../services/firestorePagamentos'
import { useToast } from '../../hooks/useToast'
import { formatDate as formatLocalizedDate } from '../../i18n/formatters'
import { isModoEmpresarial, podeGerenciarCandidatosEmpresa } from '../../utils/modoEmpresarial'

// Abas de filtro exibidas na interface.
const tabs = [
  { value: 'all', labelKey: 'candidates.tabs.all' },
  { value: 'indicado', labelKey: 'candidates.tabs.referred' },
  { value: 'entrevista', labelKey: 'candidates.tabs.interview' },
  { value: 'contratado', labelKey: 'candidates.tabs.hired' },
  { value: 'cancelado', labelKey: 'candidates.tabs.cancelled' }
]

// Lista de imagens usadas como avatares visuais dos candidatos.
const avatars = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=160&q=80',
]

const PAGE_SIZE = 6

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

function formatDate(value, fallback) {
  return formatLocalizedDate(value, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }) || fallback
}

function CandidatosEmpresa() {
  const { t, i18n } = useTranslation(['company', 'common'])
  const toast = useToast()
  // Mantém os dados da empresa autenticada durante a renderização da página.
  const [empresa] = useState(getEmpresa)
  const empresaUid = getFirebaseUid(empresa)

  // Armazena candidatos retornados pelo Firestore.
  const [candidatos, setCandidatos] = useState([])

  // Armazena o termo digitado no campo de busca.
  const [busca, setBusca] = useState('')

  // Controla a aba de status ativa.
  const [activeTab, setActiveTab] = useState('all')
  const [filtroVaga, setFiltroVaga] = useState('all')
  const [pagina, setPagina] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)

  // Controla o carregamento inicial da lista.
  const [loading, setLoading] = useState(true)

  // Armazena mensagens de erro de busca ou atualização.
  const [error, setError] = useState('')

  // Controla qual candidato está com status em atualização.
  const [updatingId, setUpdatingId] = useState(null)

  // Controla o candidato exibido no painel de perfil.
  const [selectedCandidate, setSelectedCandidate] = useState(null)

  // Armazena pagamentos de recompensas da empresa.
  const [pagamentos, setPagamentos] = useState([])

  // Controla o candidato escolhido para pagamento de recompensa.
  const [paymentCandidate, setPaymentCandidate] = useState(null)

  useEffect(() => {
    // Responsabilidade: buscar candidatos vinculados às vagas da empresa autenticada.
    const fetchCandidatos = async () => {
      if (!empresa) {
        setLoading(false)
        return
      }

      if (!empresaUid) {
        setCandidatos([])
        setError(t('candidates.missingUid'))
        setLoading(false)
        return
      }

      try {
        setError('')
        const candidatosData = await listarCandidatosPorEmpresa(empresaUid)
        setCandidatos(candidatosData)
      } catch {
        setError(t('candidates.loadError'))
        toast.error(t('candidates.loadError'))
      } finally {
        setLoading(false)
      }

      try {
        const pagamentosData = await listarPagamentosPorEmpresa(empresaUid)
        setPagamentos(pagamentosData)
      } catch (err) {
        console.warn('Não foi possível carregar pagamentos da empresa:', err)
        setPagamentos([])
      }
    }

    fetchCandidatos()
  }, [empresa, empresaUid, reloadKey, t, toast])

  // Filtra candidatos por status selecionado e termo de busca.
  const candidatosFiltrados = useMemo(() => {
    const termo = normalizeText(busca)

    return candidatos.filter((candidato) => {
      const status = normalizeCandidateStatus(candidato.status)
      const matchesStatus = activeTab === 'all' || status === activeTab
      const matchesVaga = filtroVaga === 'all' || candidato.vagaTitulo === filtroVaga
      const matchesBusca = !termo || [
        candidato.nome,
        candidato.cargoAtual,
        candidato.vagaTitulo,
        candidato.indicadorNome,
      ].some((value) => normalizeText(value).includes(termo))

      return matchesStatus && matchesVaga && matchesBusca
    })
  }, [activeTab, busca, candidatos, filtroVaga])

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
      const atual = mapa.get(pagamento.candidatoId)
      const dataAtual = new Date(atual?.criadoEm || 0).getTime()
      const dataNova = new Date(pagamento.criadoEm || 0).getTime()

      if (!atual || dataNova >= dataAtual) {
        mapa.set(pagamento.candidatoId, pagamento)
      }
    })

    return mapa
  }, [pagamentos])

  // Regra de acesso: sem empresa autenticada, redireciona para login.
  if (!empresa) {
    return <Navigate to="/login?redirect=/candidatos/empresa" replace />
  }

  if (isModoEmpresarial(empresa) && !podeGerenciarCandidatosEmpresa(empresa)) {
    return (
      <>
        <Navbar />

        <div className="empresa-candidatos-layout">
          <Sidebar type="empresa" user={empresa} />
          <main className="empresa-candidatos-page">
            <EstadoDados
              title={t('candidates.restrictedTitle')}
              description={t('candidates.restrictedDescription')}
              actionLabel={t('candidates.backPanel')}
              onAction={() => window.location.assign('/painel/empresa')}
            />
          </main>
        </div>

        <Footer />
      </>
    )
  }

  const tentarNovamente = () => {
    setLoading(true)
    setReloadKey((value) => value + 1)
  }

  const limparFiltros = () => {
    setBusca('')
    setActiveTab('all')
    setFiltroVaga('all')
    setPagina(1)
  }

  // Responsabilidade: atualizar o status de um candidato no Firestore.
  const updateStatus = async (candidatoId, status) => {
    setUpdatingId(candidatoId)

    if (!empresaUid) {
      toast.warning(t('candidates.missingUid'))
      setUpdatingId(null)
      return
    }

    try {
      await atualizarStatusCandidato({ candidatoId, status, empresaId: empresaUid })

      // Atualiza localmente o status do candidato alterado.
      setCandidatos((current) => current.map((candidato) => (
        candidato.id === candidatoId ? { ...candidato, status } : candidato
      )))
      setSelectedCandidate((current) => (
        current?.id === candidatoId ? { ...current, status } : current
      ))
      toast.success(t('candidates.statusUpdated'))
    } catch (error) {
      console.error('Falha ao atualizar o status do candidato:', error)
      toast.error(error?.message || t('candidates.statusUpdateError'))
    } finally {
      setUpdatingId(null)
    }
  }

  const handleTimelineChange = (candidato, status) => {
    updateStatus(candidato.id, status)
  }

  const handlePaymentCreated = (pagamento) => {
    if (!paymentCandidate) return

    setPagamentos((current) => [
      {
        id: pagamento.pagamentoId,
        mercadoPagoPreferenceId: pagamento.preferenceId,
        status: pagamento.status || 'pending',
        valor: pagamento.valor || paymentCandidate.recompensaValorFixo || paymentCandidate.recompensaValor || 0,
        candidatoId: paymentCandidate.id,
        candidatoNome: paymentCandidate.nome,
        empresaId: empresaUid,
        indicadorId: paymentCandidate.indicadorId || paymentCandidate.indicadorUid || '',
        vagaTitulo: paymentCandidate.vagaTitulo,
        indicadorNome: paymentCandidate.indicadorNome,
        checkoutUrl: pagamento.sandboxInitPoint || pagamento.checkoutUrl || pagamento.initPoint,
        sandboxCheckoutUrl: pagamento.sandboxInitPoint || '',
        criadoEm: new Date().toISOString()
      },
      ...current
    ])
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
            <span>{t('candidates.eyebrow')}</span>
            <h1>{t('candidates.title')}</h1>
            <p>{t('candidates.description')}</p>
            <a href="/vagas">{t('candidates.backJobs')}</a>
          </header>

          {/* Barra de busca e filtros por status. */}
          <section className="empresa-candidatos-toolbar">
            <label className="empresa-candidate-search">
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

            <label className="empresa-candidate-vacancy-filter">
              <span>{t('candidates.job')}</span>
              <select
                value={filtroVaga}
                onChange={(event) => {
                  setFiltroVaga(event.target.value)
                  setPagina(1)
                }}
              >
                <option value="all">{t('candidates.allJobs')}</option>
                {vagasDisponiveis.map((vagaTitulo) => (
                  <option key={vagaTitulo} value={vagaTitulo}>{vagaTitulo}</option>
                ))}
              </select>
            </label>

            <div className="empresa-candidate-tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  className={activeTab === tab.value ? 'active' : ''}
                  onClick={() => {
                    setActiveTab(tab.value)
                    setPagina(1)
                  }}
                >
                  {t(tab.labelKey)}
                </button>
              ))}
            </div>
          </section>

          {/* Mensagens de carregamento e erro. */}
          {loading && (
            <section className="empresa-candidate-grid">
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

          {!loading && !error && !candidatosFiltrados.length && (
            <EstadoDados
              actionLabel={candidatos.length ? t('candidates.clearFilters') : ''}
              description={candidatos.length
                ? t('candidates.filterDescription')
                : t('candidates.emptyDescription')}
              onAction={limparFiltros}
              title={candidatos.length ? t('candidates.noResults') : t('candidates.emptyTitle')}
            />
          )}

          {!loading && !error && candidatosFiltrados.length > 0 && (
            <>
              <section className="empresa-candidate-grid">
              {candidatosPaginados.map((candidato, index) => {
                // Regra de normalização: status "recusado" é tratado visualmente como "cancelado".
                const status = candidato.status === 'recusado' ? 'cancelado' : candidato.status || 'indicado'
                const pagamento = pagamentosPorCandidato.get(candidato.id)
                const temIndicador = Boolean(candidato.indicadorId || candidato.indicadorUid)
                const podePagar = status === 'contratado' && temIndicador
                const recompensaPaga = pagamento?.status === 'approved'
                const pagamentoPendente = pagamento?.status === 'pending'

                return (
                  <article className="empresa-candidate-card" key={candidato.id}>
                    <div className="empresa-candidate-top">
                      <img src={avatars[index % avatars.length]} alt={candidato.nome} />

                      <strong className={`empresa-status-badge ${status}`}>
                        {t(`common:statuses.candidates.${status}`, { defaultValue: status })}
                      </strong>
                    </div>

                    <h2>{candidato.nome}</h2>
                    <p>{candidato.cargoAtual || candidato.vagaTitulo || t('candidates.referredCandidate')}</p>

                    <div className="empresa-candidate-details">
                      <span><FaUser /> {candidato.indicadorNome ? t('candidates.referredBy', { name: candidato.indicadorNome }) : candidato.origem}</span>
                      <span><FaCalendarAlt /> {t('candidates.appliedAt', { date: formatDate(candidato.aplicadoEm, t('candidates.notProvided')) })}</span>
                    </div>

                    <LinhaStatusCandidato
                      status={status}
                      editable
                      loading={updatingId === candidato.id}
                      onChangeStatus={(nextStatus) => handleTimelineChange(candidato, nextStatus)}
                      variant="compact"
                    />

                    <div className="empresa-candidate-actions">
                      <button type="button" onClick={() => setSelectedCandidate(candidato)}>
                        {t('candidates.viewProfile')}
                      </button>
                      {podePagar && (
                        <button
                          type="button"
                          className={`empresa-payment-action ${recompensaPaga ? 'paid' : ''}`}
                          onClick={() => !recompensaPaga && setPaymentCandidate(candidato)}
                          disabled={recompensaPaga}
                        >
                          <FaCreditCard />
                          {recompensaPaga ? t('candidates.rewardPaid') : pagamentoPendente ? t('candidates.paymentPending') : t('candidates.payReward')}
                        </button>
                      )}
                      <button type="button" aria-label={t('candidates.moreOptions')}>
                        <FaEllipsisH />
                      </button>
                    </div>
                  </article>
                )
              })}

              </section>
              <Paginacao
                page={paginaAtual}
                pageSize={PAGE_SIZE}
                total={candidatosFiltrados.length}
                onPageChange={setPagina}
              />
            </>
          )}
        </main>
      </div>

      {selectedCandidate && (
        <ModalPerfilCandidato
          key={selectedCandidate.id}
          candidato={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          editableStatus
          loadingStatus={updatingId === selectedCandidate.id}
          onChangeStatus={(nextStatus) => handleTimelineChange(selectedCandidate, nextStatus)}
        />
      )}

      {/* Componente de rodapé. */}
      {paymentCandidate && (
        <ModalPagamentoRecompensa
          candidato={paymentCandidate}
          empresa={empresa}
          pagamentoExistente={pagamentosPorCandidato.get(paymentCandidate.id)}
          onClose={() => setPaymentCandidate(null)}
          onCreated={handlePaymentCreated}
        />
      )}

      <Footer />
    </>
  )
}

export default CandidatosEmpresa

function normalizeCandidateStatus(status) {
  if (status === 'recusado') return 'cancelado'
  return status || 'indicado'
}
