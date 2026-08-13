import './Footer.css'

import logoVermelho from '../../assets/Selectio_vermelho_sem_fundo.png'
import { useTranslation } from 'react-i18next'

function Footer() {
  const { t } = useTranslation('common')

  return (
    <footer className="footer">
      <img className="footer-logo" src={logoVermelho} alt="Selectio" />

      <div>
        <a href="#">{t('footer.privacy')}</a>
        <a href="#">{t('footer.terms')}</a>
        <a href="#">{t('footer.contact')}</a>
        <a href="#">{t('footer.faq')}</a>
      </div>
    </footer>
  )
}

export default Footer
