import './Navbar.css'

import logoVermelho from '../../../assets/Selectio_vermelho_sem_fundo.png'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { FaBell, FaSignOutAlt, FaUserCircle } from 'react-icons/fa'

function Navbar() {
  const navigate = useNavigate()
  const empresa = localStorage.getItem('empresaUser')

  const logout = () => {
    localStorage.removeItem('empresaUser')
    navigate('/login')
  }

  return (
    <header className="navbar">
      <img className="logo-img" src={logoVermelho} alt="Selectio" />

      <nav className="nav-links">
        <NavLink to="/">Home</NavLink>
        <NavLink to="/vagas">Vagas</NavLink>
        <NavLink to="/painel/empresa">Painel</NavLink>
      </nav>

      <div className="navbar-right">
        <div className="user-actions">
          {empresa ? (
            <>
              <button type="button" className="icon-button" aria-label="Notificacoes">
                <FaBell />
              </button>
              <Link className="icon-button" to="/painel/empresa" aria-label="Perfil">
                <FaUserCircle />
              </Link>
              <button type="button" className="icon-button" onClick={logout} aria-label="Logout">
                <FaSignOutAlt />
              </button>
            </>
          ) : (
            <nav className="nav-auth">
              <Link className="btn-primary" to="/cadastro">Cadastre-se</Link>
              <Link className="btn-secondary" to="/login">Login</Link>
            </nav>
          )}
        </div>
      </div>
    </header>
  )
}

export default Navbar
