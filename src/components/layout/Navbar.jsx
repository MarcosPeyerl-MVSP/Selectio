import './Navbar.css'

import logoVermelho from '../../assets/Selectio_vermelho_sem_fundo.png'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { FaCog, FaMoon, FaSignOutAlt, FaSun, FaUserAlt, FaUserCircle } from 'react-icons/fa'
import { signOut } from 'firebase/auth'
import { auth } from '../../services/firebase'
import { useTema } from '../../hooks/useTema'
import { useConfirmacao } from '../../hooks/useConfirmacao'
import { useToast } from '../../hooks/useToast'
import MenuNotificacoes from '../notificacoes/MenuNotificacoes'
import { useAuth } from '../../hooks/useAuth'

function Navbar() {
  const navigate = useNavigate()
  const { isDark, toggleTheme } = useTema()
  const confirm = useConfirmacao()
  const toast = useToast()
  const { perfil, carregando: carregandoSessao } = useAuth()
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef(null)
  const session = perfil?.tipo === 'empresa'
    ? { type: 'empresa', label: 'Empresa', user: perfil, painelPath: '/painel/empresa' }
    : perfil?.tipo === 'indicador'
      ? { type: 'indicador', label: 'Indicador', user: perfil, painelPath: '/painel/indicador' }
      : { type: 'publico', label: '', user: null, painelPath: '/login' }
  const userName = getUserName(session.user)
  const userEmail = getUserEmail(session.user)
  const profilePath = `${session.painelPath}?secao=perfil`
  const settingsPath = `${session.painelPath}?secao=configuracoes`

  useEffect(() => {
    if (!profileMenuOpen) return undefined

    const handlePointerDown = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) {
        setProfileMenuOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setProfileMenuOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [profileMenuOpen])

  const handleLogout = async () => {
    if (session.type === 'publico') return

    const confirmed = await confirm({
      title: 'Sair da conta?',
      description: 'Sua sessão local será encerrada neste navegador.',
      confirmLabel: 'Sair'
    })

    if (!confirmed) return

    await signOut(auth).catch(() => {})
    localStorage.removeItem('empresaUser')
    localStorage.removeItem('indicadorUser')
    setProfileMenuOpen(false)
    toast.info('Sessão encerrada.')
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
        {!carregandoSessao && session.type === 'publico' ? (
          <>
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
              title={isDark ? 'Tema claro' : 'Tema escuro'}
            >
              {isDark ? <FaSun /> : <FaMoon />}
            </button>
            <nav className="nav-auth">
              <Link className="btn-primary" to="/cadastro">Cadastre-se</Link>
              <Link className="btn-secondary" to="/login">Login</Link>
            </nav>
          </>
        ) : (
          <div className="user-actions" data-tour="navbar-account-actions">
            <MenuNotificacoes user={session.user} />
            <div className="profile-menu-wrapper" ref={profileMenuRef}>
              <button
                type="button"
                className="icon-button profile-trigger"
                onClick={() => setProfileMenuOpen((current) => !current)}
                aria-label="Abrir menu de perfil"
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
              >
                <FaUserCircle />
              </button>

              {profileMenuOpen && (
                <section className="profile-menu" role="menu" aria-label="Menu de perfil">
                  <header className="profile-menu-header">
                    <div className="profile-menu-avatar">
                      <FaUserAlt />
                    </div>
                    <div>
                      <strong>{userName || 'Usuário Selectio'}</strong>
                      {userEmail && <span>{userEmail}</span>}
                      <small>{session.label}</small>
                    </div>
                  </header>

                  <div className="profile-menu-section">
                    <Link to={profilePath} role="menuitem" onClick={() => setProfileMenuOpen(false)}>
                      <FaUserCircle />
                      <span>Meu perfil</span>
                    </Link>
                    <Link to={settingsPath} role="menuitem" onClick={() => setProfileMenuOpen(false)}>
                      <FaCog />
                      <span>Configurações</span>
                    </Link>
                  </div>

                  <div className="profile-menu-section">
                    <button type="button" role="menuitem" onClick={toggleTheme}>
                      {isDark ? <FaSun /> : <FaMoon />}
                      <span>Tema: {isDark ? 'escuro' : 'claro'}</span>
                    </button>
                  </div>

                  <div className="profile-menu-section">
                    <button type="button" className="logout-item" role="menuitem" onClick={handleLogout}>
                      <FaSignOutAlt />
                      <span>Sair</span>
                    </button>
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

function getUserName(user) {
  return user?.nome
    || user?.nomeCompleto
    || user?.nomeEmpresa
    || user?.razaoSocial
    || user?.displayName
    || ''
}

function getUserEmail(user) {
  return user?.email || user?.emailCorporativo || ''
}

export default Navbar
