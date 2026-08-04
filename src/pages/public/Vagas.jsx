// Objetivo do arquivo: renderizar a página de listagem de vagas.
// A página busca vagas no Firestore, aplica filtros locais, identifica o tipo de sessão
// do usuário e ajusta ações exibidas para público, indicador ou empresa.

import './Vagas.css'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import Sidebar from '../../components/layout/Sidebar'
import Footer from '../../components/layout/Footer'
import CardEsqueleto from '../../components/ui/CardEsqueleto'
import EstadoDados from '../../components/ui/EstadoDados'
import Paginacao from '../../components/ui/Paginacao'
import { FiSearch } from 'react-icons/fi'
import {
  listarVagas,
  statusAprovacaoVagaLabels,
  statusVagaLabels,
  vagaAceitaIndicacoes
} from '../../services/firestoreVagas'
import { getFirebaseUid } from '../../services/identidadeFirebase'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../hooks/useAuth'

// Responsabilidade: formatar o valor digitado no filtro de salário como moeda brasileira.
const formatCurrencyFilter = (value) => {
  const numbers = value.replace(/\D/g, '')
  if (!numbers) return ''

  return Number(numbers).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

// Responsabilidade: obter apenas o valor numérico de um texto monetário.
const getCurrencyValue = (value) => Number(value.replace(/\D/g, ''))

// Responsabilidade: normalizar textos para busca sem diferenciar acentos e maiúsculas.
const normalizeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()

// Responsabilidade: extrair valores numéricos de salário a partir do texto da vaga.
const getSalaryValues = (value) => {
  const matches = [...String(value || '').matchAll(/(\d[\d.,]*)\s*k?/gi)]

  return matches
    .map((match) => {
      const amount = Number(match[1].replace(/\./g, '').replace(',', '.'))
      if (!amount) return null

      // Regra: valores acompanhados de "k" são tratados como milhares.
      return /k/i.test(match[0]) ? amount * 1000 : amount
    })
    .filter(Boolean)
}

// Responsabilidade: identificar a sessão ativa com base nos dados salvos no localStorage.
const getSession = (perfil) => {
  if (perfil?.tipo === 'empresa') return { type: 'empresa', user: perfil }
  if (perfil?.tipo === 'indicador') return { type: 'indicador', user: perfil }
  return { type: 'publico', user: null }
}

function Vagas() {
  const toast = useToast()
  const { perfil } = useAuth()
  const [searchParams] = useSearchParams()
  // Estado dos filtros aplicados à listagem.
  const [filtro, setFiltro] = useState({ busca: '', salario: '', area: '', status: 'todos' })

  // Estado com as vagas retornadas pelo Firestore.
  const [vagas, setVagas] = useState([])

  // Controla o carregamento inicial da listagem.
  const [loading, setLoading] = useState(true)

  // Armazena mensagem de erro em caso de falha na busca.
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [pagina, setPagina] = useState(1)
  const itensPorPagina = 9

  // Define o tipo de usuário atual para ajustar layout e ações.
  const session = getSession(perfil)
  const candidatoPreSalvoId = session.type === 'indicador'
    ? searchParams.get('candidatoPreSalvoId') || ''
    : ''

  useEffect(() => {
    // Responsabilidade: buscar a lista de vagas cadastradas.
    const fetchVagas = async () => {
      try {
        setError(null)
        const data = await listarVagas()
        setVagas(data)
      } catch (err) {
        setError(err.message)
        toast.error('Não foi possível carregar as vagas.')
      } finally {
        setLoading(false)
      }
    }

    fetchVagas()
  }, [reloadKey, toast])

  // Aplica filtros locais por busca textual, área e salário mínimo.
  const vagasFiltradas = useMemo(() => vagas.filter((vaga) => {
    const busca = normalizeText(filtro.busca.trim())
    const salario = getCurrencyValue(filtro.salario)
    const area = normalizeText(filtro.area.trim())
    const salariosVaga = getSalaryValues(vaga.salario)
    const isOwnCompanyJob = session.type === 'empresa'
      && String(vaga.empresaId || vaga.empresaUid || '') === String(getFirebaseUid(session.user))
    const visivelParaSessao = isOwnCompanyJob || vagaAceitaIndicacoes(vaga)

    const matchesBusca = !busca || [
      vaga.titulo,
      vaga.area,
      vaga.empresa,
      vaga.localizacao,
    ].some((value) => normalizeText(value).includes(busca))

    const matchesArea = !area || normalizeText(vaga.area).includes(area)
    const matchesSalario = !salario || salariosVaga.some((value) => value >= salario)
    const matchesStatus = filtro.status === 'todos' || vaga.status === filtro.status

    return visivelParaSessao && matchesBusca && matchesArea && matchesSalario && matchesStatus
  }), [filtro, session.type, session.user, vagas])

  const totalPaginas = Math.max(1, Math.ceil(vagasFiltradas.length / itensPorPagina))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const vagasPaginadas = vagasFiltradas.slice(
    (paginaAtual - 1) * itensPorPagina,
    paginaAtual * itensPorPagina
  )

  const atualizarFiltro = (campo, valor) => {
    setFiltro((atual) => ({ ...atual, [campo]: valor }))
    setPagina(1)
  }

  const limparFiltros = () => {
    setFiltro({ busca: '', salario: '', area: '', status: 'todos' })
    setPagina(1)
  }

  const tentarNovamente = () => {
    setLoading(true)
    setError(null)
    setReloadKey((atual) => atual + 1)
  }

  // Textos do cabeçalho variam conforme o tipo de sessão.
  const headerCopy = {
    publico: {
      title: 'Lista de Vagas',
      text: 'Visualize oportunidades e entre para indicar talentos ou gerenciar suas vagas.',
    },
    indicador: {
      title: 'Vagas para indicar',
      text: 'Encontre oportunidades alinhadas à sua rede e indique candidatos qualificados.',
    },
    empresa: {
      title: 'Gerenciamento de vagas',
      text: 'Consulte todas as oportunidades cadastradas e publique novas vagas para sua empresa.',
    },
  }[session.type]

  return (
    <div className="page">
      {/* Componente de navegação principal da aplicação. */}
      <Navbar />

      <div className={`vagas-layout ${session.type === 'publico' ? 'public-layout' : ''}`}>
        {/* Sidebar é exibida apenas para usuários autenticados como indicador ou empresa. */}
        {session.type !== 'publico' && <Sidebar type={session.type} user={session.user} />}

        <main className="vagas-page">
        {/* Cabeçalho da listagem, com texto adaptado ao tipo de usuário. */}
        <section className="vagas-header empresa-vagas-header">
          <div>
            <span className="tag">OPORTUNIDADES</span>
            <h1>{headerCopy.title}</h1>
            <p>{headerCopy.text}</p>
          </div>
        </section>

        {/* Área de filtros da listagem de vagas. */}
        <section className="filtros">
          <div className="filtro-input">
            <FiSearch />
            <input
              type="text"
              placeholder="Cargo, empresa, área ou local"
              value={filtro.busca}
              onChange={(e) => atualizarFiltro('busca', e.target.value)}
            />
          </div>

          <div className="filtro-input">
            <input
              type="text"
              inputMode="numeric"
              placeholder="Salário mínimo"
              value={filtro.salario}
              onChange={(e) => atualizarFiltro('salario', formatCurrencyFilter(e.target.value))}
            />
          </div>

          <div className="filtro-input">
            <input
              type="text"
              placeholder="Filtrar por área"
              value={filtro.area}
              onChange={(e) => atualizarFiltro('area', e.target.value)}
            />
          </div>

          <select
            className="filtro-select"
            value={filtro.status}
            onChange={(event) => atualizarFiltro('status', event.target.value)}
            aria-label="Filtrar por status"
          >
            <option value="todos">Todos os status</option>
            <option value="aberta">Abertas</option>
            {session.type === 'empresa' && (
              <>
                <option value="pausada">Pausadas</option>
                <option value="encerrada">Encerradas</option>
                <option value="expirada">Expiradas</option>
              </>
            )}
          </select>

          {/* Limpa todos os filtros aplicados. */}
          <button
            className="btn-filtrar"
            type="button"
            onClick={limparFiltros}
          >
            Limpar
          </button>
        </section>

        {/* Grade com os cards das vagas filtradas. */}
        <section className="vagas-grid">
          {loading && <CardEsqueleto count={6} />}
          {!loading && !error && vagasPaginadas.map((vaga) => {
            // Regra: empresa proprietária da vaga recebe ação de gerenciamento.
            const isOwnCompanyJob = session.type === 'empresa'
              && String(vaga.empresaId || vaga.empresaUid || '') === String(getFirebaseUid(session.user))
            const statusLabel = isOwnCompanyJob && vaga.statusAprovacao
              ? statusAprovacaoVagaLabels[vaga.statusAprovacao] || vaga.statusAprovacao
              : statusVagaLabels[vaga.status] || vaga.status
            const empresaActionLabel = isOwnCompanyJob ? 'Gerenciar vaga' : 'Ver vaga'

            // Fluxo: usuários públicos são direcionados ao login antes de ver detalhes.
            const candidatoQuery = candidatoPreSalvoId
              ? `?candidatoPreSalvoId=${encodeURIComponent(candidatoPreSalvoId)}`
              : ''
            const detailPath = session.type === 'publico'
              ? `/login?redirect=/vaga/${vaga.id}`
              : `/vaga/${vaga.id}${candidatoQuery}`
            const empresaActionPath = isOwnCompanyJob
              ? `/editar-vaga/empresa/${vaga.id}`
              : `/vaga/${vaga.id}`

            return (
              <article key={vaga.id} className="vaga-card">
                <Link to={detailPath}>
                  <div
                    className="vaga-img"
                    style={vaga.imagem ? { backgroundImage: `url(${vaga.imagem})` } : undefined}
                  />

                  <div className="vaga-content">
                    <div className="vaga-card-labels">
                      <span className="vaga-area">{vaga.area}</span>
                      <span className={`vaga-status-badge ${vaga.status}`}>
                        {statusLabel}
                      </span>
                    </div>
                    <h3>{vaga.titulo}</h3>
                    <span className="vaga-salario">{vaga.salario}</span>
                    <p>{vaga.empresa}</p>
                  </div>
                </Link>

                <div className="vaga-actions">
                  {session.type === 'indicador' && (
                    <Link to={detailPath} className="vaga-action-primary">
                      {candidatoPreSalvoId ? 'Escolher esta vaga' : 'Ver vaga'}
                    </Link>
                  )}

                  {session.type === 'empresa' && (
                    <Link to={empresaActionPath} className="vaga-action-primary">
                      {empresaActionLabel}
                    </Link>
                  )}

                  {session.type === 'publico' && (
                    <Link
                      to={`/login?redirect=/vaga/${vaga.id}`}
                      className="vaga-action-primary"
                    >
                      Entrar para indicar
                    </Link>
                  )}
                </div>
              </article>
            )
          })}
        </section>

        {error && (
          <EstadoDados
            tone={navigator.onLine ? 'error' : 'offline'}
            title={navigator.onLine ? 'Não foi possível carregar as vagas' : 'Sem conexão'}
            description={error || 'Verifique sua conexão e tente novamente.'}
            actionLabel="Tentar novamente"
            onAction={tentarNovamente}
          />
        )}

        {!loading && !error && vagasFiltradas.length === 0 && (
          <EstadoDados
            title={vagas.length ? 'Nenhuma vaga corresponde aos filtros' : 'Nenhuma vaga publicada'}
            description={vagas.length
              ? 'Ajuste ou limpe os filtros para encontrar outras oportunidades.'
              : 'Quando uma empresa publicar uma oportunidade, ela aparecerá aqui.'}
            actionLabel={vagas.length ? 'Limpar filtros' : ''}
            onAction={vagas.length ? limparFiltros : undefined}
          />
        )}

        {!loading && !error && (
          <Paginacao
            page={paginaAtual}
            pageSize={itensPorPagina}
            total={vagasFiltradas.length}
            onPageChange={setPagina}
          />
        )}
        </main>
      </div>

      {/* Componente de rodapé da aplicação. */}
      <Footer />
    </div>
  )
}

export default Vagas
