import './Navbar.css'

import logoVermelho from '../../assets/Selectio_vermelho_sem_fundo.png'
import { Link } from 'react-router-dom'

function Navbar() {

  return (
    <header className="navbar">
      <img className="logo-img" src={logoVermelho} alt="Selectio" />

      <nav className="nav-links">
        <Link className="active" to={"/"}>Home</Link>
        <a href="#">Vagas</a>
      </nav>

      <div className="navbar-right">
        <nav className="nav-auth">
          <Link className="btn-primary" to={"/Cadastro"}>Cadastre-se</Link>
          <Link className="btn-secondary" to={"/Login"}>Login</Link>
        </nav>
      </div>
    </header>
  )
}

export default Navbar