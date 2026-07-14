// Objetivo do arquivo: renderizar a página de candidatos da empresa.
// A página valida a sessão da empresa, busca candidatos vinculados às vagas da empresa,
// permite filtro por status e busca textual, e atualiza o status dos candidatos no Firestore.

import './styles/EmpresaCandidatos.css'
import { Navigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
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
import { isModoEmpresarial, podeGerenciarCandidatosEmpresa } from '../../utils/modoEmpresarial'

// Abas de filtro exibidas na interface.
const tabs = ['Todos', 'Indicado', 'Entrevista', 'Contratado', 'Cancelado']

// Mapeia status retornados pelo Firestore para os textos exibidos na interface.
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
  const toast = useToast()
  // Mantém os dados da empresa autenticada durante a renderização da página.
  const [empresa] = useState(getEmpresa)
  const empresaUid = getFirebaseUid(empresa)

  // Armazena candidatos retornados pelo Firestore.
  const [candidatos, setCandidatos] = useState([])

  // Armazena o termo digitado no campo de busca.
  const [busca, setBusca] = useState('')

  // Controla a aba de status ativa.
  const [activeTab, setActiveTab] = useState('Todos')
  const [filtroVaga, setFiltroVaga] = useState('Todas')
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
        setError('Perfil da empresa sem UID do Firebase.')
        setLoading(false)
        return
      }

      try {
        setError('')
        const candidatosData = await listarCandidatosPorEmpresa(empresaUid)
        setCandidatos(candidatosData)
      } catch (err) {
        setError(err.message)
        toast.error('Não foi possível carregar os candidatos.')
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
  }, [empresa, empresaUid, toast, reloadKey])

  // Filtra candidatos por status selecionado e termo de busca.
  const candidatosFiltrados = useMemo(() => {
    const termo = normalizeText(busca)

    return candidatos.filter((candidato) => {
      const status = statusLabels[candidato.status] || 'Indicado'
      const matchesStatus = activeTab === 'Todos' || status === activeTab
      const matchesVaga = filtroVaga === 'Todas' || candidato.vagaTitulo === filtroVaga
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
              title="Candidatos sob responsabilidade do RH"
              description="No modo empresarial, o Setor RH administra candidatos. Este setor pode acompanhar o fluxo de aprovacao pelo painel."
              actionLabel="Voltar ao painel"
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
    setActiveTab('Todos')
    setFiltroVaga('Todas')
    setPagina(1)
  }

  // Responsabilidade: atualizar o status de um candidato no Firestore.
  const updateStatus = async (candidatoId, status) => {
    setUpdatingId(candidatoId)

    if (!empresaUid) {
      toast.warning('Perfil da empresa sem UID do Firebase.')
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
      toast.success('Status atualizado com sucesso.')
    } catch (err) {
      toast.error(err.message)
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
            <span>Gestão de talentos</span>
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
                onChange={(event) => {
                  setBusca(event.target.value)
                  setPagina(1)
                }}
                placeholder="Buscar por nome ou cargo..."
              />
            </label>

            <label className="empresa-candidate-vacancy-filter">
              <span>Vaga</span>
              <select
                value={filtroVaga}
                onChange={(event) => {
                  setFiltroVaga(event.target.value)
                  setPagina(1)
                }}
              >
                <option value="Todas">Todas as vagas</option>
                {vagasDisponiveis.map((vagaTitulo) => (
                  <option key={vagaTitulo} value={vagaTitulo}>{vagaTitulo}</option>
                ))}
              </select>
            </label>

            <div className="empresa-candidate-tabs">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={activeTab === tab ? 'active' : ''}
                  onClick={() => {
                    setActiveTab(tab)
                    setPagina(1)
                  }}
                >
                  {tab}
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
              actionLabel="Tentar novamente"
              description={error}
              onAction={tentarNovamente}
              title={navigator.onLine ? 'Não foi possível carregar os candidatos' : 'Você está sem conexão'}
              tone={navigator.onLine ? 'error' : 'offline'}
            />
          )}

          {!loading && !error && !candidatosFiltrados.length && (
            <EstadoDados
              actionLabel={candidatos.length ? 'Limpar filtros' : ''}
              description={candidatos.length
                ? 'Ajuste a busca, a vaga ou a etapa para visualizar outros resultados.'
                : 'Os candidatos indicados para suas vagas aparecerão aqui.'}
              onAction={limparFiltros}
              title={candidatos.length ? 'Nenhum candidato encontrado' : 'Ainda não há candidatos'}
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
                        {statusLabels[status] || 'Indicado'}
                      </strong>
                    </div>

                    <h2>{candidato.nome}</h2>
                    <p>{candidato.cargoAtual || candidato.vagaTitulo || 'Candidato indicado'}</p>

                    <div className="empresa-candidate-details">
                      <span><FaUser /> {candidato.indicadorNome ? `Indicação de ${candidato.indicadorNome}` : candidato.origem}</span>
                      <span><FaCalendarAlt /> Aplicado em {formatDate(candidato.aplicadoEm)}</span>
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
                        Ver Perfil
                      </button>
                      {podePagar && (
                        <button
                          type="button"
                          className={`empresa-payment-action ${recompensaPaga ? 'paid' : ''}`}
                          onClick={() => !recompensaPaga && setPaymentCandidate(candidato)}
                          disabled={recompensaPaga}
                        >
                          <FaCreditCard />
                          {recompensaPaga ? 'Recompensa paga' : pagamentoPendente ? 'Pagamento pendente' : 'Pagar recompensa'}
                        </button>
                      )}
                      <button type="button" aria-label="Mais opções">
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
