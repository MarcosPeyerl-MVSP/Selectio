import './Navbar.css'

import logoVermelho from '../../../assets/Selectio_vermelho_sem_fundo.png'
import { Link, NavLink } from 'react-router-dom'

function Navbar() {

  return (
    <header className="navbar">
      <img className="logo-img" src={logoVermelho} alt="Selectio" />

      <nav className="nav-links">
        <NavLink to="/">Home</NavLink>
        <NavLink to="/vagas">Vagas</NavLink>
      </nav>

      <div className="navbar-right">
        <nav className="nav-auth">
          <Link className="btn-primary" to="/cadastro">Cadastre-se</Link>
          <Link className="btn-secondary" to="/login">Login</Link>
        </nav>
      </div>
    </header>
  )
}

export default Navbar
