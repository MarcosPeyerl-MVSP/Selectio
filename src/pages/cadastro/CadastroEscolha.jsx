// Objetivo do arquivo: renderizar a página de escolha do tipo de cadastro.
// A página permite que o usuário selecione entre cadastro de empresa ou cadastro de indicador.

import './CadastroEscolha.css'
import Navbar from '../../components/layout/Navbar'
import Footer from '../../components/layout/Footer'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

function Cadastro() {
  const { t } = useTranslation('auth')

  return (
    <>
      {/* Componente de navegação principal da aplicação. */}
      <Navbar />

      {/* Container principal da página de seleção de cadastro. */}
      <main className="cadastro-container">
        {/* Cabeçalho com título e descrição da finalidade da página. */}
        <div className="cadastro-header">
          <span className="tag center">{t('registrationChoice.eyebrow')}</span>
          <h1>{t('registrationChoice.title')}</h1>
          <p>{t('registrationChoice.description')}</p>
        </div>

        {/* Área com os dois tipos de cadastro disponíveis. */}
        <div className="cadastro-cards">
          {/* Card que direciona para o cadastro de empresa. */}
          <div className="cadastro-card">
            <h2>{t('registrationChoice.companyTitle')}</h2>
            <p>{t('registrationChoice.companyDescription')}</p>

            <ul>
              <li>{t('registrationChoice.companyBenefitOne')}</li>
              <li>{t('registrationChoice.companyBenefitTwo')}</li>
            </ul>

            {/* Rota interna para o formulário de cadastro de empresa. */}
            <Link className="btn-primary" to="/cadastro/empresa">{t('registrationChoice.start')}</Link>
          </div>

          {/* Card que direciona para o cadastro de indicador. */}
          <div className="cadastro-card">
            <h2>{t('registrationChoice.referrerTitle')}</h2>
            <p>{t('registrationChoice.referrerDescription')}</p>

            <ul>
              <li>{t('registrationChoice.referrerBenefitOne')}</li>
              <li>{t('registrationChoice.referrerBenefitTwo')}</li>
            </ul>

            {/* Rota interna para o formulário de cadastro de indicador. */}
            <Link className="btn-primary" to="/cadastro/indicador">{t('registrationChoice.start')}</Link>
          </div>
        </div>
      </main>

      {/* Componente de rodapé da aplicação. */}
      <Footer />
    </>
  )
}

export default Cadastro
