import './Vagas.css'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../../../components/Navbar/Navbar/Navbar'
import Footer from '../../../components/Footer/Footer'
import { FiSearch, FiChevronDown } from 'react-icons/fi'

function Vagas() {
  const [filtro, setFiltro] = useState({
    busca: '',
    preco: '',
    area: ''
  })

  const [vagas, setVagas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

  if (loading) {
    return (
      <div className="page">
        <Navbar />
        <main className="vagas-page">
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p>Carregando vagas...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (error) {
    return (
      <div className="page">
        <Navbar />
        <main className="vagas-page">
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p>Erro ao carregar vagas: {error}</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="page">
      <Navbar />

      <main className="vagas-page">

        {/* HEADER */}
        <section className="vagas-header">
          <span className="tag">OPORTUNIDADES</span>
          <h1>Lista de Vagas</h1>
          <p>
            Curadoria editorial das melhores posições do mercado.
            Filtre por setor e faixa salarial para encontrar seu próximo desafio.
          </p>
        </section>

        {/* FILTROS */}
        <section className="filtros">
          <div className="filtro-input">
            <FiSearch />
            <input
              type="text"
              placeholder="Setor, Vaga"
              onChange={(e) => setFiltro({ ...filtro, busca: e.target.value })}
            />
          </div>

          <div className="filtro-select">
            <span>Qualquer valor</span>
            <FiChevronDown />
          </div>

          <div className="filtro-select">
            <span>Todas as áreas</span>
            <FiChevronDown />
          </div>

          <button className="btn-filtrar">Filtrar</button>
        </section>

        {/* LISTA */}
        <section className="vagas-grid">
          {vagas.map((vaga) => (
            <Link
              key={vaga.id}
              to={`/vaga/${vaga.id}`}
              className="vaga-card"
            >
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

      </main>

      <Footer />
    </div>
  )
}

export default Vagas
