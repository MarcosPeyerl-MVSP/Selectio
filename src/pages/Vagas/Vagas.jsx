// Objetivo do arquivo: renderizar a página de listagem de vagas.
// A página busca vagas no Firestore, aplica filtros locais, identifica o tipo de sessão
// do usuário e ajusta ações exibidas para público, indicador ou empresa.

import './Vagas.css'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../../components/Navbar/Navbar/Navbar'
import Sidebar from '../../components/Sidebar/Sidebar'
import Footer from '../../components/Footer/Footer'
import { FiSearch } from 'react-icons/fi'
import { listarVagas } from '../../services/firestoreVagas'
import { getFirebaseUid } from '../../services/firebaseIdentity'

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
const getSession = () => {
  const indicador = getStoredUser('indicadorUser')
  const empresa = getStoredUser('empresaUser')

  if (empresa) return { type: 'empresa', user: empresa }
  if (indicador) return { type: 'indicador', user: indicador }
  return { type: 'publico', user: null }
}

// Responsabilidade: recuperar e validar um usuário salvo no localStorage.
const getStoredUser = (key) => {
  const stored = localStorage.getItem(key)
  if (!stored) return null

  try {
    return JSON.parse(stored)
  } catch {
    // Fluxo de segurança: remove o item caso o JSON armazenado esteja inválido.
    localStorage.removeItem(key)
    return null
  }
}

function Vagas() {
  // Estado dos filtros aplicados à listagem.
  const [filtro, setFiltro] = useState({ busca: '', salario: '', area: '' })

  // Estado com as vagas retornadas pelo Firestore.
  const [vagas, setVagas] = useState([])

  // Controla o carregamento inicial da listagem.
  const [loading, setLoading] = useState(true)

  // Armazena mensagem de erro em caso de falha na busca.
  const [error, setError] = useState(null)

  // Define o tipo de usuário atual para ajustar layout e ações.
  const session = getSession()

  useEffect(() => {
    // Responsabilidade: buscar a lista de vagas cadastradas.
    const fetchVagas = async () => {
      try {
        const data = await listarVagas()
        setVagas(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchVagas()
  }, [])

  // Aplica filtros locais por busca textual, área e salário mínimo.
  const vagasFiltradas = vagas.filter((vaga) => {
    const busca = normalizeText(filtro.busca.trim())
    const salario = getCurrencyValue(filtro.salario)
    const area = normalizeText(filtro.area.trim())
    const salariosVaga = getSalaryValues(vaga.salario)

    const matchesBusca = !busca || [
      vaga.titulo,
      vaga.area,
      vaga.empresa,
      vaga.localizacao,
    ].some((value) => normalizeText(value).includes(busca))

    const matchesArea = !area || normalizeText(vaga.area).includes(area)
    const matchesSalario = !salario || salariosVaga.some((value) => value >= salario)

    return matchesBusca && matchesArea && matchesSalario
  })

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
              onChange={(e) => setFiltro({ ...filtro, busca: e.target.value })}
            />
          </div>

          <div className="filtro-input">
            <input
              type="text"
              inputMode="numeric"
              placeholder="Salário mínimo"
              value={filtro.salario}
              onChange={(e) => setFiltro({ ...filtro, salario: formatCurrencyFilter(e.target.value) })}
            />
          </div>

          <div className="filtro-input">
            <input
              type="text"
              placeholder="Filtrar por área"
              value={filtro.area}
              onChange={(e) => setFiltro({ ...filtro, area: e.target.value })}
            />
          </div>

          {/* Limpa todos os filtros aplicados. */}
          <button
            className="btn-filtrar"
            type="button"
            onClick={() => setFiltro({ busca: '', salario: '', area: '' })}
          >
            Limpar
          </button>
        </section>

        {/* Grade com os cards das vagas filtradas. */}
        <section className="vagas-grid">
          {loading && <p>Carregando vagas...</p>}
          {error && <p>Erro ao carregar vagas: {error}</p>}

          {!loading && !error && vagasFiltradas.map((vaga) => {
            // Regra: empresa proprietária da vaga recebe ação de gerenciamento.
            const isOwnCompanyJob = session.type === 'empresa'
              && String(vaga.empresaId || vaga.empresaUid || '') === String(getFirebaseUid(session.user))
            const empresaActionLabel = isOwnCompanyJob ? 'Gerenciar vaga' : 'Ver vaga'

            // Fluxo: usuários públicos são direcionados ao login antes de ver detalhes.
            const detailPath = session.type === 'publico'
              ? `/login?redirect=/vaga/${vaga.id}`
              : `/vaga/${vaga.id}`
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
                    <span className="vaga-area">{vaga.area}</span>
                    <h3>{vaga.titulo}</h3>
                    <span className="vaga-salario">{vaga.salario}</span>
                    <p>{vaga.empresa}</p>
                  </div>
                </Link>

                <div className="vaga-actions">
                  {session.type === 'indicador' && (
                    <Link to={`/vaga/${vaga.id}`} className="vaga-action-primary">
                      Fazer indicação
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

        {/* Mensagem exibida quando nenhum resultado atende aos filtros. */}
        {!loading && !error && vagasFiltradas.length === 0 && (
          <div className="empty-vagas">
            <h2>Nenhuma vaga encontrada</h2>
            <p>Ajuste os filtros para visualizar outras oportunidades.</p>
          </div>
        )}
        </main>
      </div>

      {/* Componente de rodapé da aplicação. */}
      <Footer />
    </div>
  )
}

export default Vagas
