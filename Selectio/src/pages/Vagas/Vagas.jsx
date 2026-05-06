import './Vagas.css'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import NavbarPublic from '../../components/Navbar/Navbar/Navbar'
import NavbarIndicador from '../../components/Navbar/NavbarIndicador/Navbar'
import NavbarEmpresa from '../../components/Navbar/NavbarEmpresa/Navbar'
import Footer from '../../components/Footer/Footer'
import { FiSearch } from 'react-icons/fi'

const getSession = () => {
  const indicador = localStorage.getItem('indicadorUser')
  const empresa = localStorage.getItem('empresaUser')

  if (empresa) return { type: 'empresa', user: JSON.parse(empresa) }
  if (indicador) return { type: 'indicador', user: JSON.parse(indicador) }
  return { type: 'publico', user: null }
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

  const areas = useMemo(
    () => [...new Set(vagas.map((vaga) => vaga.area).filter(Boolean))].sort(),
    [vagas]
  )

  const vagasFiltradas = vagas.filter((vaga) => {
    const busca = filtro.busca.trim().toLowerCase()
    const salario = filtro.salario.trim().toLowerCase()

    const matchesBusca = !busca || [
      vaga.titulo,
      vaga.area,
      vaga.empresa,
      vaga.localizacao,
    ].some((value) => value?.toLowerCase().includes(busca))

    const matchesArea = !filtro.area || vaga.area === filtro.area
    const matchesSalario = !salario || vaga.salario?.toLowerCase().includes(salario)

    return matchesBusca && matchesArea && matchesSalario
  })

  const Navbar = session.type === 'empresa'
    ? NavbarEmpresa
    : session.type === 'indicador'
      ? NavbarIndicador
      : NavbarPublic

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

      <main className="vagas-page">
        <section className="vagas-header empresa-vagas-header">
          <div>
            <span className="tag">OPORTUNIDADES</span>
            <h1>{headerCopy.title}</h1>
            <p>{headerCopy.text}</p>
          </div>

          {session.type === 'empresa' && (
            <Link className="btn-criar-vaga" to="/criar-vaga/empresa">
              Nova vaga
            </Link>
          )}
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
              placeholder="Faixa salarial"
              value={filtro.salario}
              onChange={(e) => setFiltro({ ...filtro, salario: e.target.value })}
            />
          </div>

          <select
            className="filtro-select"
            value={filtro.area}
            onChange={(e) => setFiltro({ ...filtro, area: e.target.value })}
          >
            <option value="">Todas as areas</option>
            {areas.map((area) => (
              <option key={area} value={area}>{area}</option>
            ))}
          </select>

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

          {!loading && !error && vagasFiltradas.map((vaga) => (
            <article key={vaga.id} className="vaga-card">
              <Link to={`/vaga/${vaga.id}`}>
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
                    Gerenciar
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
          ))}
        </section>

        {!loading && !error && vagasFiltradas.length === 0 && (
          <div className="empty-vagas">
            <h2>Nenhuma vaga encontrada</h2>
            <p>Ajuste os filtros para visualizar outras oportunidades.</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}

export default Vagas
