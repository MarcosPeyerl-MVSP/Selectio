import './Navbar.css'

import logoVermelho from '../../../assets/Selectio_vermelho_sem_fundo.png'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { FaBell, FaMoon, FaSignOutAlt, FaSun, FaUserCircle } from 'react-icons/fa'
import { signOut } from 'firebase/auth'
import { auth } from '../../../services/firebase'
import { useTheme } from '../../../hooks/useTheme'

function Navbar() {
  const navigate = useNavigate()
  const { isDark, toggleTheme } = useTheme()
  const empresa = getStoredUser('empresaUser')
  const indicador = getStoredUser('indicadorUser')
  const session = empresa
    ? { type: 'empresa', user: empresa, painelPath: '/painel/empresa' }
    : indicador
      ? { type: 'indicador', user: indicador, painelPath: '/painel/indicador' }
      : { type: 'publico', user: null, painelPath: '/login' }

  const handleLogout = async () => {
    if (session.type === 'publico') return

    await signOut(auth).catch(() => {})
    localStorage.removeItem('empresaUser')
    localStorage.removeItem('indicadorUser')
    navigate('/login')
  }

  return (
    <header className="navbar">
      <img className="logo-img" src={logoVermelho} alt="Selectio" />

      <nav className="nav-links">
        <NavLink to="/">Home</NavLink>
        <NavLink to="/vagas">Vagas</NavLink>
        {session.type !== 'publico' && (
          <NavLink to={session.painelPath}>Painel</NavLink>
        )}
      </nav>

      <div className="navbar-right">
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
          title={isDark ? 'Tema claro' : 'Tema escuro'}
        >
          {isDark ? <FaSun /> : <FaMoon />}
        </button>

        {session.type === 'publico' ? (
          <nav className="nav-auth">
            <Link className="btn-primary" to="/cadastro">Cadastre-se</Link>
            <Link className="btn-secondary" to="/login">Login</Link>
          </nav>
        ) : (
          <div className="user-actions">
            <button type="button" className="icon-button" aria-label="Notificacoes">
              <FaBell />
            </button>
            <Link className="icon-button" to={session.painelPath} aria-label="Perfil">
              <FaUserCircle />
            </Link>
            <button type="button" className="icon-button" onClick={handleLogout} aria-label="Logout">
              <FaSignOutAlt />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

function getStoredUser(key) {
  const stored = localStorage.getItem(key)
  if (!stored) return null

  try {
    return JSON.parse(stored)
  } catch {
    localStorage.removeItem(key)
    return null
  }
}

export default Navbar
