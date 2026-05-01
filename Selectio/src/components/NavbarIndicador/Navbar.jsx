import './Navbar.css'

import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { FaUserCircle, FaSignOutAlt, FaBell} from 'react-icons/fa'

import logoVermelho from '../../assets/Selectio_vermelho_sem_fundo.png'

function Navbar() {
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const storedUser = localStorage.getItem('indicadorUser')
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
  }, [])

  const handleLogout = () => {
    const confirmed = window.confirm('Deseja sair da sua conta?')
    if (!confirmed) return

    localStorage.removeItem('indicadorUser')
    navigate('/')
  }

  return (
    <header className="navbar">
      <img className="logo-img" src={logoVermelho} alt="Selectio" />

      <nav className="nav-links">
        <Link className="" to={"/"}>Home</Link>
        <a href="#">Vagas</a>
        <Link className="" to={"/painel/indicador"}>Painel</Link>
      </nav>

      <div className="navbar-right">
        <div className="user-actions">
          <button type="button" className="icon-button" aria-label="Notificações">
            <FaBell />
          </button>
          <Link className="icon-button" to="/painel/indicador" aria-label="Perfil">
            <FaUserCircle />
          </Link>
          <button type="button" className="icon-button" onClick={handleLogout} aria-label="Logout">
            <FaSignOutAlt />
          </button>
        </div>
      </div>
    </header>
  )
}

export default Navbar