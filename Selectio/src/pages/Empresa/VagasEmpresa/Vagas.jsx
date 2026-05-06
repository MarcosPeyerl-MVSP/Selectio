import './Vagas.css'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Navbar from '../../../components/Navbar/Navbar/Navbar'
import Footer from '../../../components/Footer/Footer'
import { FiSearch, FiChevronDown } from 'react-icons/fi'

function VagasEmpresa() {
  const navigate = useNavigate()
  const [filtro, setFiltro] = useState({
    busca: '',
    preco: '',
    area: ''
  })
  const [vagas, setVagas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const storedEmpresa = localStorage.getItem('empresaUser')

    if (!storedEmpresa) {
      navigate('/login')
      return
    }

  }, [navigate])

  useEffect(() => {
    const fetchVagas = async () => {
      try {
        const response = await fetch('http://localhost:3333/vagas')

        if (!response.ok) {
          throw new Error('Erro ao buscar vagas')
        }

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
    const busca = filtro.busca.toLowerCase()

    return (
      vaga.titulo?.toLowerCase().includes(busca) ||
      vaga.area?.toLowerCase().includes(busca) ||
      vaga.empresa?.toLowerCase().includes(busca)
    )
  })

  return (
    <div className="page">
      <Navbar />

      <main className="vagas-page">
        <section className="vagas-header empresa-vagas-header">
          <div>
            <span className="tag">OPORTUNIDADES</span>
            <h1>Lista de Vagas</h1>
            <p>
              Consulte as vagas cadastradas no banco e crie novas oportunidades para sua empresa.
            </p>
          </div>

          <Link className="btn-criar-vaga" to="/criar-vaga/empresa">
            Nova vaga
          </Link>
        </section>

        <section className="filtros">
          <div className="filtro-input">
            <FiSearch />
            <input
              type="text"
              placeholder="Setor, Vaga"
              value={filtro.busca}
              onChange={(e) => setFiltro({ ...filtro, busca: e.target.value })}
            />
          </div>

          <div className="filtro-select">
            <span>Qualquer valor</span>
            <FiChevronDown />
          </div>

          <div className="filtro-select">
            <span>Todas as areas</span>
            <FiChevronDown />
          </div>

          <button className="btn-filtrar">Filtrar</button>
        </section>

        <section className="vagas-grid">
          {loading && <p>Carregando vagas...</p>}
          {error && <p>Erro ao carregar vagas: {error}</p>}

          {!loading && !error && vagasFiltradas.map((vaga) => (
            <Link key={vaga.id} to={`/vaga/${vaga.id}`} className="vaga-card">
              <div
                className="vaga-img"
                style={{ backgroundImage: `url(${vaga.imagem})` }}
              />

              <div className="vaga-content">
                <span className="vaga-area">{vaga.area}</span>
                <h3>{vaga.titulo}</h3>
                <span className="vaga-salario">{vaga.salario}</span>
              </div>
            </Link>
          ))}
        </section>

        {!loading && !error && vagasFiltradas.length === 0 && (
          <div className="empty-vagas">
            <h2>Nenhuma vaga encontrada</h2>
            <p>Crie uma nova vaga para ela aparecer nesta lista.</p>
            <Link to="/criar-vaga/empresa">Criar vaga</Link>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}

export default VagasEmpresa
