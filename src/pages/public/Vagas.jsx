// Objetivo do arquivo: renderizar a página de listagem de vagas.
// A página busca vagas no Firestore, aplica filtros locais, identifica o tipo de sessão
// do usuário e ajusta ações exibidas para público, indicador ou empresa.

import './Vagas.css'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Navbar from '../../components/layout/Navbar'
import Sidebar from '../../components/layout/Sidebar'
import Footer from '../../components/layout/Footer'
import CardEsqueleto from '../../components/ui/CardEsqueleto'
import EstadoDados from '../../components/ui/EstadoDados'
import Paginacao from '../../components/ui/Paginacao'
import { FiSearch } from 'react-icons/fi'
import {
  listarVagas,
  vagaAceitaIndicacoes
} from '../../services/firestoreVagas'
import { getFirebaseUid } from '../../services/identidadeFirebase'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency } from '../../i18n/formatters'
import { formatJobSalary } from '../../i18n/domainFormatters'

// Responsabilidade: formatar o valor digitado no filtro de salário como moeda brasileira.
const formatCurrencyFilter = (value) => {
  const numbers = value.replace(/\D/g, '')
  if (!numbers) return ''

  return formatCurrency(numbers, { maximumFractionDigits: 0 })
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
      const amount = Number(match[1].replace(/\D/g, ''))
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
  const { t } = useTranslation(['public', 'common'])
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
      } catch {
        setError(t('jobs.loadError'))
        toast.error(t('jobs.loadToastError'))
      } finally {
        setLoading(false)
      }
    }

    fetchVagas()
  }, [reloadKey, t, toast])

  // Aplica filtros locais por busca textual, área e salário mínimo.
  const vagasFiltradas = useMemo(() => vagas.filter((vaga) => {
    const busca = normalizeText(filtro.busca.trim())
    const salario = getCurrencyValue(filtro.salario)
    const area = normalizeText(filtro.area.trim())
    const salariosEstruturados = [vaga.salarioMinValor, vaga.salarioMaxValor]
      .map(Number)
      .filter(Boolean)
    const salariosVaga = salariosEstruturados.length
      ? salariosEstruturados
      : getSalaryValues(vaga.salario)
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
  const headerKeys = {
    publico: {
      title: 'jobs.headers.public.title',
      text: 'jobs.headers.public.description',
    },
    indicador: {
      title: 'jobs.headers.referrer.title',
      text: 'jobs.headers.referrer.description',
    },
    empresa: {
      title: 'jobs.headers.company.title',
      text: 'jobs.headers.company.description',
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
            <span className="tag">{t('jobs.opportunities')}</span>
            <h1>{t(headerKeys.title)}</h1>
            <p>{t(headerKeys.text)}</p>
          </div>
        </section>

        {/* Área de filtros da listagem de vagas. */}
        <section className="filtros">
          <div className="filtro-input">
            <FiSearch />
            <input
              type="text"
              placeholder={t('jobs.searchPlaceholder')}
              value={filtro.busca}
              onChange={(e) => atualizarFiltro('busca', e.target.value)}
            />
          </div>

          <div className="filtro-input">
            <input
              type="text"
              inputMode="numeric"
              placeholder={t('jobs.minimumSalary')}
              value={filtro.salario}
              onChange={(e) => atualizarFiltro('salario', formatCurrencyFilter(e.target.value))}
            />
          </div>

          <div className="filtro-input">
            <input
              type="text"
              placeholder={t('jobs.areaPlaceholder')}
              value={filtro.area}
              onChange={(e) => atualizarFiltro('area', e.target.value)}
            />
          </div>

          <select
            className="filtro-select"
            value={filtro.status}
            onChange={(event) => atualizarFiltro('status', event.target.value)}
            aria-label={t('jobs.filterByStatus')}
          >
            <option value="todos">{t('jobs.allStatuses')}</option>
            <option value="aberta">{t('common:statuses.jobs.aberta')}</option>
            {session.type === 'empresa' && (
              <>
                <option value="pausada">{t('common:statuses.jobs.pausada')}</option>
                <option value="encerrada">{t('common:statuses.jobs.encerrada')}</option>
                <option value="expirada">{t('common:statuses.jobs.expirada')}</option>
              </>
            )}
          </select>

          {/* Limpa todos os filtros aplicados. */}
          <button
            className="btn-filtrar"
            type="button"
            onClick={limparFiltros}
          >
            {t('jobs.clear')}
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
              ? t(`common:statuses.jobApproval.${vaga.statusAprovacao}`, { defaultValue: vaga.statusAprovacao })
              : t(`common:statuses.jobs.${vaga.status}`, { defaultValue: vaga.status })
            const empresaActionLabel = isOwnCompanyJob ? t('jobs.manageJob') : t('jobs.viewJob')

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
                    <span className="vaga-salario">{formatJobSalary(vaga, t)}</span>
                    <p>{vaga.empresa}</p>
                  </div>
                </Link>

                <div className="vaga-actions">
                  {session.type === 'indicador' && (
                    <Link to={detailPath} className="vaga-action-primary">
                      {candidatoPreSalvoId ? t('jobs.chooseJob') : t('jobs.viewJob')}
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
                      {t('jobs.loginToRefer')}
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
            title={navigator.onLine ? t('jobs.loadError') : t('jobs.offline')}
            description={t('jobs.connectionDescription')}
            actionLabel={t('jobs.retry')}
            onAction={tentarNovamente}
          />
        )}

        {!loading && !error && vagasFiltradas.length === 0 && (
          <EstadoDados
            title={vagas.length ? t('jobs.noFilterResults') : t('jobs.noPublishedJobs')}
            description={vagas.length
              ? t('jobs.adjustFilters')
              : t('jobs.futureJobs')}
            actionLabel={vagas.length ? t('jobs.clearFilters') : ''}
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
