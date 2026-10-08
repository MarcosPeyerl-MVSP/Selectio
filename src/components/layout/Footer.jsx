import './Footer.css'

import logoVermelho from '../../assets/Selectio_vermelho_sem_fundo.png'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

function Footer() {
  const { t } = useTranslation('common')

  return (
    <footer className="footer">
      <Link to="/" aria-label={`Selectio — ${t('navigation.home')}`}>
        <img className="footer-logo" src={logoVermelho} alt="Selectio" />
      </Link>

      <nav className="footer-group" aria-labelledby="footer-institutional">
        <h2 id="footer-institutional">{t('footer.institutional')}</h2>
        <Link to="/equipe">{t('footer.team')}</Link>
        <Link to="/contato">{t('footer.contact')}</Link>
      </nav>
      <nav className="footer-group" aria-labelledby="footer-help">
        <h2 id="footer-help">{t('footer.help')}</h2>
        <Link to="/faq">{t('footer.faq')}</Link>
        <Link to="/privacidade">{t('footer.privacy')}</Link>
        <Link to="/termos">{t('footer.terms')}</Link>
      </nav>
      <p className="footer-copyright">{t('footer.copyright', { year: new Date().getFullYear() })}</p>
    </footer>
  )
}

export default Footer
