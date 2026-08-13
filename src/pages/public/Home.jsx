// Objetivo do arquivo: renderizar a página inicial da aplicação Selectio.
// A página apresenta vagas em destaque, chamadas para cadastro, explicação do fluxo
// da plataforma e chamada final para navegação até a listagem de vagas.

import './Home.css'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
import Navbar from '../../components/layout/Navbar'
import Footer from '../../components/layout/Footer'
import { listarVagasBanner } from '../../services/firestoreVagas'
import { formatJobReward } from '../../i18n/domainFormatters'

function Home() {
  const { t } = useTranslation('public')

  // Controla o índice da vaga atualmente exibida no banner principal.
  const [currentVaga, setCurrentVaga] = useState(0)

  // Controla a direção da animação do carrossel ao trocar de vaga.
  const [direction, setDirection] = useState('next')

  // Armazena as vagas em destaque retornadas pelo Firestore.
  const [vagas, setVagas] = useState([])

  useEffect(() => {
    // Responsabilidade: buscar as vagas exibidas no banner da home.
    // Integração: consome o endpoint local GET /vagas/banner.
    const fetchVagas = async () => {
      try {
        const data = await listarVagasBanner()

        // Validação: se a resposta HTTP não for bem-sucedida,
        // o fluxo cai no tratamento de erro.
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
            <span className="tag">{t('home.featuredJob')}</span>

            <h1>
              {/* Exibe dados da vaga quando disponíveis; caso contrário, usa texto padrão. */}
              {vaga?.titulo || t('home.featuredJobs')}
              <br />
              <strong>{vaga?.area ? `(${vaga.area})` : '(Selectio)'}</strong>
            </h1>

            <p>
              {vaga?.descricaoCurta || t('home.featuredDescription')}
            </p>

            <div className="hero-actions">
              {/* Direciona o usuário para login antes da indicação da vaga atual. */}
              <Link
                className="home-button-primary hero-indication"
                to={vaga ? `/login?redirect=/vaga/${vaga.id}` : '/login'}
              >
                {t('home.refer')}
              </Link>

              {/* Direciona para detalhes da vaga atual ou para a listagem geral. */}
              <Link to={vaga ? `/vaga/${vaga.id}` : '/vagas'}>{t('home.viewJob')}</Link>
            </div>
          </div>

          {/* Card visual da vaga atual, com imagem opcional e recompensa. */}
          <div className={`hero-card glass-effect slide-animation slide-${direction}`}>
            <div
              className={`profile-photo ${vaga?.imagem ? '' : 'placeholder-photo'}`}
              style={vaga?.imagem ? { backgroundImage: `url(${vaga.imagem})` } : undefined}
            >
              {/* Fallback visual quando a vaga não possui imagem cadastrada. */}
              {!vaga?.imagem && <span>{t('home.jobImage')}</span>}
            </div>

            <div className="info-box glass-effect">
              <strong>{t('home.reward')}</strong>
              <span>{vaga?.recompensa || vaga?.recompensaValorFixo
                ? formatJobReward(vaga, t)
                : t('home.negotiable')}</span>
            </div>
          </div>

          {/* Controles do carrossel de vagas. */}
          <button className="carousel-btn carousel-prev" onClick={vagaAnterior} aria-label={t('home.previousJob')}>
            <FiChevronLeft />
          </button>

          <button className="carousel-btn carousel-next" onClick={proximaVaga} aria-label={t('home.nextJob')}>
            <FiChevronRight />
          </button>

          {/* Indicadores clicáveis para navegação direta entre vagas carregadas. */}
          <div className="carousel-indicators">
            {vagas.map((_, index) => (
              <button
                key={index}
                className={`indicator ${index === currentVaga ? 'active' : ''}`}
                onClick={() => setCurrentVaga(index)}
                aria-label={t('home.goToJob', { number: index + 1 })}
              />
            ))}
          </div>
        </section>

        {/* Seção com caminhos de cadastro para empresas e indicadores. */}
        <section className="ecosystem">
          <span className="tag center">{t('home.ecosystem')}</span>
          <h2>{t('home.ecosystemTitle')}</h2>

          <div className="ecosystem-grid">
            <div className="solution-card">
              <div className="solution-icon">
                <FiBriefcase />
              </div>

              <h3>{t('home.forCompanies')}</h3>
              <p>{t('home.companyBenefitOne')}</p>
              <p>{t('home.companyBenefitTwo')}</p>
              <p>{t('home.companyBenefitThree')}</p>

              <Link className="home-button-primary" to="/cadastro/empresa">
                {t('home.registerCompany')}
              </Link>
            </div>

            <div className="solution-card">
              <div className="solution-icon">
                <FiUsers />
              </div>

              <h3>{t('home.forReferrers')}</h3>
              <p>{t('home.referrerBenefitOne')}</p>
              <p>{t('home.referrerBenefitTwo')}</p>
              <p>{t('home.referrerBenefitThree')}</p>

              <Link className="home-button-primary" to="/cadastro/indicador">
                {t('home.becomeReferrer')}
              </Link>
            </div>
          </div>
        </section>

        {/* Seção explicativa do funcionamento da plataforma. */}
        <section className="how-it-works">
          <div>
            <span className="tag">{t('home.howItWorks')}</span>

            <h2>
              {t('home.howTitleStart')}
              <br />
              <strong>{t('home.howTitleStrong')}</strong>
              <br />
              {t('home.howTitleEnd')}
            </h2>

            <p className="section-text">
              {t('home.howDescription')}
            </p>

            {/* Etapas descritas visualmente para explicar o fluxo da plataforma. */}
            <div className="steps">
              <div>
                <span>
                  <FiTarget />
                </span>
                <div>
                  <h3>{t('home.stepOneTitle')}</h3>
                  <p>{t('home.stepOneDescription')}</p>
                </div>
              </div>

              <div>
                <span>
                  <FiShare2 />
                </span>
                <div>
                  <h3>{t('home.stepTwoTitle')}</h3>
                  <p>{t('home.stepTwoDescription')}</p>
                </div>
              </div>

              <div>
                <span>
                  <FiFilter />
                </span>
                <div>
                  <h3>{t('home.stepThreeTitle')}</h3>
                  <p>{t('home.stepThreeDescription')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Card visual que representa o indicador de compatibilidade. */}
          <div className="matching-card">
            <div className="matching-icon">
              <FiCpu />
            </div>

            <span>{t('home.matchingAlgorithm')}</span>
            <div className="bar large"></div>
            <div className="bar medium"></div>
            <div className="bar small"></div>
            <strong>{t('home.compatibilityIndicator')}</strong>
          </div>
        </section>

        {/* Chamada final para levar o usuário à busca/listagem de vagas. */}
        <section className="cta">
          <h2>{t('home.ctaTitle')}</h2>

          <p>{t('home.ctaDescription')}</p>

          <Link className="home-button-primary" to="/vagas">
            {t('home.browseJobs')}
          </Link>
        </section>
      </main>

      {/* Componente de rodapé da aplicação. */}
      <Footer />
    </div>
  )
}

export default Home
