import './Footer.css'

import logoVermelho from '../../assets/Selectio_vermelho_sem_fundo.png'

function Footer() {
  return (
    <footer className="footer">
      <img className="footer-logo" src={logoVermelho} alt="Selectio" />

      <div>
        <a href="#">Privacidade</a>
        <a href="#">Termos de Uso</a>
        <a href="#">Contato</a>
        <a href="#">FAQ</a>
      </div>
    </footer>
  )
}

export default Footer