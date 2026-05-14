// Objetivo do arquivo: renderizar a página inicial da aplicação Selectio.
// A página apresenta vagas em destaque, chamadas para cadastro, explicação do fluxo
// da plataforma e chamada final para navegação até a listagem de vagas.

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
  // Controla o índice da vaga atualmente exibida no banner principal.
  const [currentVaga, setCurrentVaga] = useState(0)

  // Controla a direção da animação do carrossel ao trocar de vaga.
  const [direction, setDirection] = useState('next')

  // Armazena as vagas retornadas pela API de vagas em destaque.
  const [vagas, setVagas] = useState([])

  useEffect(() => {
    // Responsabilidade: buscar as vagas exibidas no banner da home.
    // Integração: consome o endpoint local GET /vagas/banner.
    const fetchVagas = async () => {
      try {
        const response = await fetch('http://localhost:3333/vagas/banner')

        // Validação: se a resposta HTTP não for bem-sucedida,
        // o fluxo cai no tratamento de erro.
        if (!response.ok) {
          throw new Error('Erro ao buscar vagas')
        }

        const data = await response.json()

        // Atualiza a lista de vagas usadas pelo carrossel.
        setVagas(data)
      } catch {
        // Regra de fallback: em caso de erro na integração,
        // a home permanece funcional usando lista vazia.
        setVagas([])
      }
    }

    // Executa a busca uma vez quando o componente é montado.
    fetchVagas()
  }, [])

  // Responsabilidade: avançar para a próxima vaga do carrossel.
  // Regra de negócio: se não houver vagas carregadas, não altera o estado.
  const proximaVaga = () => {
    if (!vagas.length) return

    setDirection('next')

    // Usa módulo para retornar ao início quando chega ao fim da lista.
    setCurrentVaga((prev) => (prev + 1) % vagas.length)
  }

  // Responsabilidade: voltar para a vaga anterior do carrossel.
  // Regra de negócio: se não houver vagas carregadas, não altera o estado.
  const vagaAnterior = () => {
    if (!vagas.length) return

    setDirection('prev')

    // Usa cálculo circular para voltar ao último item quando está no primeiro.
    setCurrentVaga((prev) => (prev - 1 + vagas.length) % vagas.length)
  }

  // Recupera a vaga atual com base no índice selecionado.
  const vaga = vagas[currentVaga]

  return (
    <div className="page">
      {/* Componente de navegação principal da aplicação. */}
      <Navbar />

      <main>
        {/* Seção principal da home com banner dinâmico de vagas em destaque. */}
        <section className="hero-modelo">
          <div className={`hero-text slide-animation slide-${direction}`}>
            <span className="tag">VAGA DO MOMENTO</span>

            <h1>
              {/* Exibe dados da vaga quando disponíveis; caso contrário, usa texto padrão. */}
              {vaga?.titulo || 'Vagas em destaque'}
              <br />
              <strong>{vaga?.area ? `(${vaga.area})` : '(Selectio)'}</strong>
            </h1>

            <p>
              {vaga?.descricaoCurta ||
                'Confira as oportunidades cadastradas no banco de dados da Selectio.'}
            </p>

            <div className="hero-actions">
              {/* Direciona o usuário para login antes da indicação da vaga atual. */}
              <Link
                className="home-button-primary hero-indication"
                to={vaga ? `/login?redirect=/vaga/${vaga.id}` : '/login'}
              >
                Fazer Indicação
              </Link>

              {/* Direciona para detalhes da vaga atual ou para a listagem geral. */}
              <Link to={vaga ? `/vaga/${vaga.id}` : '/vagas'}>Ver Detalhes da Vaga</Link>
            </div>
          </div>

          {/* Card visual da vaga atual, com imagem opcional e recompensa. */}
          <div className={`hero-card glass-effect slide-animation slide-${direction}`}>
            <div
              className="profile-photo placeholder-photo"
              style={vaga?.imagem ? { backgroundImage: `url(${vaga.imagem})` } : undefined}
            >
              {/* Fallback visual quando a vaga não possui imagem cadastrada. */}
              {!vaga?.imagem && <span>Imagem da vaga</span>}
            </div>

            <div className="info-box glass-effect">
              <strong>Recompensa</strong>
              <span>{vaga?.recompensa || 'A combinar'}</span>
            </div>
          </div>

          {/* Controles do carrossel de vagas. */}
          <button className="carousel-btn carousel-prev" onClick={vagaAnterior} aria-label="Vaga anterior">
            <FiChevronLeft />
          </button>

          <button className="carousel-btn carousel-next" onClick={proximaVaga} aria-label="Próxima vaga">
            <FiChevronRight />
          </button>

          {/* Indicadores clicáveis para navegação direta entre vagas carregadas. */}
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

        {/* Seção com caminhos de cadastro para empresas e indicadores. */}
        <section className="ecosystem">
          <span className="tag center">O ECOSSISTEMA</span>
          <h2>Soluções para os dois lados da elite.</h2>

          <div className="ecosystem-grid">
            <div className="solution-card">
              <div className="solution-icon">
                <FiBriefcase />
              </div>

              <h3>Para Empresas</h3>
              <p>Acesso a talentos qualificados fora do mercado comum.</p>
              <p>Filtragem inteligente para apoiar a tomada de decisão.</p>
              <p>Processo focado em eficiência, curadoria e resultado.</p>

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
              <p>Acompanhe suas indicações em um painel transparente.</p>
              <p>Receba recompensas por indicações bem-sucedidas.</p>

              <Link className="home-button-primary" to="/cadastro/indicador">
                Tornar-se Indicador
              </Link>
            </div>
          </div>
        </section>

        {/* Seção explicativa do funcionamento da plataforma. */}
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

            {/* Etapas descritas visualmente para explicar o fluxo da plataforma. */}
            <div className="steps">
              <div>
                <span>
                  <FiTarget />
                </span>
                <div>
                  <h3>Curadoria da Vaga</h3>
                  <p>As vagas passam por análise antes da publicação.</p>
                </div>
              </div>

              <div>
                <span>
                  <FiShare2 />
                </span>
                <div>
                  <h3>Ativação da Rede</h3>
                  <p>Indicadores recebem vagas compatíveis com sua rede.</p>
                </div>
              </div>

              <div>
                <span>
                  <FiFilter />
                </span>
                <div>
                  <h3>Filtragem de Precisão</h3>
                  <p>Dados de perfil e indicação ajudam a montar uma lista qualificada.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Card visual que representa o indicador de compatibilidade. */}
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

        {/* Chamada final para levar o usuário à busca/listagem de vagas. */}
        <section className="cta">
          <h2>Pronto para enviar ou procurar seu talento?</h2>

          <p>
            Junte-se à nossa rede de indicadores e transforme
            <br />
            o futuro da sua equipe ou a sua carreira como indicador.
          </p>

          <Link className="home-button-primary" to="/vagas">
            Procurar Vagas
          </Link>
        </section>
      </main>

      {/* Componente de rodapé da aplicação. */}
      <Footer />
    </div>
  )
}

export default Home