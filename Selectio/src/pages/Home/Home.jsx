import './Home.css'
import { useState } from 'react'

import Navbar from '../../components/Navbar/Navbar'
import Footer from '../../components/Footer/Footer'

function Home() {
  const [currentVaga, setCurrentVaga] = useState(0)
  const [direction, setDirection] = useState('next')

  const vagas = [
    {
      id: 1,
      titulo: 'Cargo em Destaque',
      area: '(Área Estratégica)',
      descricao: 'Descrição breve da vaga em destaque. Aqui ficará o resumo da vaga e a recompensa oferecida por uma indicação bem-sucedida.',
      taxa: '85%'
    },
    {
      id: 2,
      titulo: 'Desenvolvedor Senior',
      area: '(Tecnologia)',
      descricao: 'Procuramos um desenvolvedor experiente para liderar nossos projetos inovadores. Oferecemos benefícios competitivos e oportunidades de crescimento.',
      taxa: '92%'
    },
    {
      id: 3,
      titulo: 'Analista de Dados',
      area: '(Análise)',
      descricao: 'Buscamos um profissional com experiência em análise de dados e business intelligence. Será responsável por insights estratégicos.',
      taxa: '78%'
    },
    {
      id: 4,
      titulo: 'Gerente de Projetos',
      area: '(Gestão)',
      descricao: 'Oportunidade para gerenciar projetos estratégicos. Experiência em metodologias ágeis é essencial.',
      taxa: '88%'
    }
  ]

  const proximaVaga = () => {
    setDirection('next')
    setCurrentVaga((prev) => (prev + 1) % vagas.length)
  }

  const vagaAnterior = () => {
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
              {vaga.titulo}
              <br />
              <strong>{vaga.area}</strong>
            </h1>

            <p>{vaga.descricao}</p>

            <div className="hero-actions">
              <button>Fazer Indicação</button>
              <a href="#">Ver Detalhes da Vaga</a>
            </div>
          </div>

          <div className={`hero-card glass-effect slide-animation slide-${direction}`}>
            <div className="profile-photo placeholder-photo">
              <span>Imagem da vaga</span>
            </div>

            <div className="info-box glass-effect">
              <strong>Taxa de assertividade</strong>
              <span>{vaga.taxa}</span>
            </div>
          </div>

          <button className="carousel-btn carousel-prev" onClick={vagaAnterior} aria-label="Vaga anterior">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <button className="carousel-btn carousel-next" onClick={proximaVaga} aria-label="Próxima vaga">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
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
          <h2>Soluções para os dois lados da elite.</h2>

          <div className="ecosystem-grid">
            <div className="solution-card">
              <h3>Para Empresas</h3>
              <p>Acesso a talentos qualificados fora do mercado comum.</p>
              <p>Filtragem inteligente para apoiar a tomada de decisão.</p>
              <p>Processo focado em eficiência, curadoria e resultado.</p>
              <button>Cadastrar Empresa</button>
            </div>

            <div className="solution-card">
              <h3>Para Indicadores</h3>
              <p>Transforme sua rede profissional em oportunidades reais.</p>
              <p>Acompanhe suas indicações em um painel transparente.</p>
              <p>Receba recompensas por indicações bem-sucedidas.</p>
              <button>Tornar-se Indicador</button>
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
              A plataforma organiza conexões profissionais, indicações e vagas
              por meio de curadoria e tecnologia.
            </p>

            <div className="steps">
              <div>
                <span>1</span>
                <div>
                  <h3>Curadoria da Vaga</h3>
                  <p>As vaga passam por análise antes da publicação.</p>
                </div>
              </div>

              <div>
                <span>2</span>
                <div>
                  <h3>Ativação da Rede</h3>
                  <p>Indicadores recebem vaga compatíveis com sua rede.</p>
                </div>
              </div>

              <div>
                <span>3</span>
                <div>
                  <h3>Filtragem de Precisão</h3>
                  <p>Dados de perfil e indicação ajudam a montar uma lista qualificada.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="matching-card">
            <span>ALGORITMO DE MATCHING</span>
            <div className="bar large"></div>
            <div className="bar medium"></div>
            <div className="bar small"></div>
            <strong>Indicador de compatibilidade</strong>
          </div>
        </section>

        <section className="cta">
          <h2>
            Pronto para enviar ou procurar seu talento?
          </h2>
        
          <p>
            Junte-se à nossa rede de indicadores transforme
            <br />
            o futuro da sua equipe ou a sua carreira como indicador.
          </p>
        
          <button>Procurar Vagas</button>
        </section>
      </main>

      <Footer />
    </div>
  )
}

export default Home