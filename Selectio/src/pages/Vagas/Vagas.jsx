import './Vagas.css'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../../components/Navbar/Navbar/Navbar'
import Sidebar from '../../components/Sidebar/Sidebar'
import Footer from '../../components/Footer/Footer'
import { FiSearch } from 'react-icons/fi'

const formatCurrencyFilter = (value) => {
  const numbers = value.replace(/\D/g, '')
  if (!numbers) return ''

  return Number(numbers).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

const getCurrencyValue = (value) => Number(value.replace(/\D/g, ''))

const normalizeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()

const getSalaryValues = (value) => {
  const matches = [...String(value || '').matchAll(/(\d[\d.,]*)\s*k?/gi)]

  return matches
    .map((match) => {
      const amount = Number(match[1].replace(/\./g, '').replace(',', '.'))
      if (!amount) return null
      return /k/i.test(match[0]) ? amount * 1000 : amount
    })
    .filter(Boolean)
}

const getSession = () => {
  const indicador = getStoredUser('indicadorUser')
  const empresa = getStoredUser('empresaUser')

  if (empresa) return { type: 'empresa', user: empresa }
  if (indicador) return { type: 'indicador', user: indicador }
  return { type: 'publico', user: null }
}

const getStoredUser = (key) => {
  const stored = localStorage.getItem(key)
  if (!stored) return null

  try {
    return JSON.parse(stored)
  } catch {
    localStorage.removeItem(key)
    return null
  }
}

function Vagas() {
  const [filtro, setFiltro] = useState({ busca: '', salario: '', area: '' })
  const [vagas, setVagas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const session = getSession()

  useEffect(() => {
    const fetchVagas = async () => {
      try {
        const response = await fetch('http://localhost:3333/vagas')
        if (!response.ok) throw new Error('Erro ao buscar vagas')

        const data = await response.json()
        setVagas(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchVagas()
  }, [])

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

  const headerCopy = {
    publico: {
      title: 'Lista de Vagas',
      text: 'Visualize oportunidades e entre para indicar talentos ou gerenciar suas vagas.',
    },
    indicador: {
      title: 'Vagas para indicar',
      text: 'Encontre oportunidades alinhadas a sua rede e indique candidatos qualificados.',
    },
    empresa: {
      title: 'Gerenciamento de vagas',
      text: 'Consulte todas as oportunidades cadastradas e publique novas vagas para sua empresa.',
    },
  }[session.type]

  return (
    <div className="page">
      <Navbar />

      <div className={`vagas-layout ${session.type === 'publico' ? 'public-layout' : ''}`}>
        {session.type !== 'publico' && <Sidebar type={session.type} user={session.user} />}

        <main className="vagas-page">
        <section className="vagas-header empresa-vagas-header">
          <div>
            <span className="tag">OPORTUNIDADES</span>
            <h1>{headerCopy.title}</h1>
            <p>{headerCopy.text}</p>
          </div>
        </section>

        <section className="filtros">
          <div className="filtro-input">
            <FiSearch />
            <input
              type="text"
              placeholder="Cargo, empresa, area ou local"
              value={filtro.busca}
              onChange={(e) => setFiltro({ ...filtro, busca: e.target.value })}
            />
          </div>

          <div className="filtro-input">
            <input
              type="text"
              inputMode="numeric"
              placeholder="Salario minimo"
              value={filtro.salario}
              onChange={(e) => setFiltro({ ...filtro, salario: formatCurrencyFilter(e.target.value) })}
            />
          </div>

          <div className="filtro-input">
            <input
              type="text"
              placeholder="Filtrar por area"
              value={filtro.area}
              onChange={(e) => setFiltro({ ...filtro, area: e.target.value })}
            />
          </div>

          <button
            className="btn-filtrar"
            type="button"
            onClick={() => setFiltro({ busca: '', salario: '', area: '' })}
          >
            Limpar
          </button>
        </section>

        <section className="vagas-grid">
          {loading && <p>Carregando vagas...</p>}
          {error && <p>Erro ao carregar vagas: {error}</p>}

          {!loading && !error && vagasFiltradas.map((vaga) => {
            const isOwnCompanyJob = session.type === 'empresa'
              && Number(vaga.empresaId) === Number(session.user?.id)
            const empresaActionLabel = isOwnCompanyJob ? 'Gerenciar vaga' : 'Ver vaga'
            const detailPath = session.type === 'publico'
              ? `/login?redirect=/vaga/${vaga.id}`
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
                      Fazer indicacao
                    </Link>
                  )}

                  {session.type === 'empresa' && (
                    <Link to={`/vaga/${vaga.id}`} className="vaga-action-primary">
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

        {!loading && !error && vagasFiltradas.length === 0 && (
          <div className="empty-vagas">
            <h2>Nenhuma vaga encontrada</h2>
            <p>Ajuste os filtros para visualizar outras oportunidades.</p>
          </div>
        )}
        </main>
      </div>

      <Footer />
    </div>
  )
}

export default Vagas
