import './Home.css'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FiBriefcase,
  FiUsers,
  FiCpu,
  FiTarget,
  FiShare2,
  FiFilter,
  FiChevronLeft,
  FiChevronRight
} from 'react-icons/fi'
import Navbar from '../../components/Navbar/Navbar/Navbar'
import Footer from '../../components/Footer/Footer'

function Home() {
  const [currentVaga, setCurrentVaga] = useState(0)
  const [direction, setDirection] = useState('next')
  const [vagas, setVagas] = useState([])

  useEffect(() => {
    const fetchVagas = async () => {
      try {
        const response = await fetch('http://localhost:3333/vagas/banner')

        if (!response.ok) {
          throw new Error('Erro ao buscar vagas')
        }

        const data = await response.json()
        setVagas(data)
      } catch {
        setVagas([])
      }
    }

    fetchVagas()
  }, [])

  const proximaVaga = () => {
    if (!vagas.length) return

    setDirection('next')
    setCurrentVaga((prev) => (prev + 1) % vagas.length)
  }

  const vagaAnterior = () => {
    if (!vagas.length) return

    setDirection('prev')
    setCurrentVaga((prev) => (prev - 1 + vagas.length) % vagas.length)
  }

  const vaga = vagas[currentVaga]

  return (
    <div className="page">
      <Navbar />

      <main>
        <section className="hero-modelo">
          <div className={`hero-text slide-animation slide-${direction}`}>
            <span className="tag">VAGA DO MOMENTO</span>

            <h1>
              {vaga?.titulo || 'Vagas em destaque'}
              <br />
              <strong>{vaga?.area ? `(${vaga.area})` : '(Selectio)'}</strong>
            </h1>

            <p>
              {vaga?.descricaoCurta ||
                'Confira as oportunidades cadastradas no banco de dados da Selectio.'}
            </p>

            <div className="hero-actions">
              <Link
                className="home-button-primary hero-indication"
                to={vaga ? `/login?redirect=/vaga/${vaga.id}` : '/login'}
              >
                Fazer Indicacao
              </Link>
              <Link to={vaga ? `/vaga/${vaga.id}` : '/vagas'}>Ver Detalhes da Vaga</Link>
            </div>
          </div>

          <div className={`hero-card glass-effect slide-animation slide-${direction}`}>
            <div
              className="profile-photo placeholder-photo"
              style={vaga?.imagem ? { backgroundImage: `url(${vaga.imagem})` } : undefined}
            >
              {!vaga?.imagem && <span>Imagem da vaga</span>}
            </div>

            <div className="info-box glass-effect">
              <strong>Recompensa</strong>
              <span>{vaga?.recompensa || 'A combinar'}</span>
            </div>
          </div>

          <button className="carousel-btn carousel-prev" onClick={vagaAnterior} aria-label="Vaga anterior">
            <FiChevronLeft />
          </button>

          <button className="carousel-btn carousel-next" onClick={proximaVaga} aria-label="Proxima vaga">
            <FiChevronRight />
          </button>

          <div className="carousel-indicators">
            {vagas.map((_, index) => (
              <button
                key={index}
                className={`indicator ${index === currentVaga ? 'active' : ''}`}
                onClick={() => setCurrentVaga(index)}
                aria-label={`Ir para vaga ${index + 1}`}
              />
            ))}
          </div>
        </section>

        <section className="ecosystem">
          <span className="tag center">O ECOSSISTEMA</span>
          <h2>Solucoes para os dois lados da elite.</h2>

          <div className="ecosystem-grid">
            <div className="solution-card">
              <div className="solution-icon">
                <FiBriefcase />
              </div>

              <h3>Para Empresas</h3>
              <p>Acesso a talentos qualificados fora do mercado comum.</p>
              <p>Filtragem inteligente para apoiar a tomada de decisao.</p>
              <p>Processo focado em eficiencia, curadoria e resultado.</p>

              <Link className="home-button-primary" to="/cadastro/empresa">
                Cadastrar Empresa
              </Link>
            </div>

            <div className="solution-card">
              <div className="solution-icon">
                <FiUsers />
              </div>

              <h3>Para Indicadores</h3>
              <p>Transforme sua rede profissional em oportunidades reais.</p>
              <p>Acompanhe suas indicacoes em um painel transparente.</p>
              <p>Receba recompensas por indicacoes bem-sucedidas.</p>

              <Link className="home-button-primary" to="/cadastro/indicador">
                Tornar-se Indicador
              </Link>
            </div>
          </div>
        </section>

        <section className="how-it-works">
          <div>
            <span className="tag">COMO FUNCIONA</span>

            <h2>
              Como a Selectio
              <br />
              <strong>revoluciona o</strong>
              <br />
              recrutamento.
            </h2>

            <p className="section-text">
              A plataforma organiza conexoes profissionais, indicacoes e vagas
              por meio de curadoria e tecnologia.
            </p>

            <div className="steps">
              <div>
                <span>
                  <FiTarget />
                </span>
                <div>
                  <h3>Curadoria da Vaga</h3>
                  <p>As vagas passam por analise antes da publicacao.</p>
                </div>
              </div>

              <div>
                <span>
                  <FiShare2 />
                </span>
                <div>
                  <h3>Ativacao da Rede</h3>
                  <p>Indicadores recebem vagas compativeis com sua rede.</p>
                </div>
              </div>

              <div>
                <span>
                  <FiFilter />
                </span>
                <div>
                  <h3>Filtragem de Precisao</h3>
                  <p>Dados de perfil e indicacao ajudam a montar uma lista qualificada.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="matching-card">
            <div className="matching-icon">
              <FiCpu />
            </div>

            <span>ALGORITMO DE MATCHING</span>
            <div className="bar large"></div>
            <div className="bar medium"></div>
            <div className="bar small"></div>
            <strong>Indicador de compatibilidade</strong>
          </div>
        </section>

        <section className="cta">
          <h2>Pronto para enviar ou procurar seu talento?</h2>

          <p>
            Junte-se a nossa rede de indicadores transforme
            <br />
            o futuro da sua equipe ou a sua carreira como indicador.
          </p>

          <Link className="home-button-primary" to="/vagas">
            Procurar Vagas
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  )
}

export default Home
