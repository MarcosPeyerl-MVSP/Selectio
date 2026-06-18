import './AdminLayout.css'

import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  FaBriefcase,
  FaBuilding,
  FaChartPie,
  FaCog,
  FaMoneyCheckAlt,
  FaMoon,
  FaSignOutAlt,
  FaSun,
  FaUserFriends,
  FaUserTie,
} from 'react-icons/fa'
import { signOut } from 'firebase/auth'

import logoVermelho from '../../assets/Selectio_vermelho_sem_fundo.png'
import { useAuth } from '../../hooks/useAuth'
import { useConfirmacao } from '../../hooks/useConfirmacao'
import { useTema } from '../../hooks/useTema'
import { useToast } from '../../hooks/useToast'
import { auth } from '../../services/firebase'

const adminItems = [
  { to: '/admin/visao-geral', label: 'Visão Geral', icon: FaChartPie },
  { to: '/admin/empresas', label: 'Empresas', icon: FaBuilding },
  { to: '/admin/indicadores', label: 'Indicadores', icon: FaUserTie },
  { to: '/admin/vagas', label: 'Vagas', icon: FaBriefcase },
  { to: '/admin/candidatos', label: 'Candidatos', icon: FaUserFriends },
  { to: '/admin/financeiro', label: 'Financeiro', icon: FaMoneyCheckAlt },
]

function AdminLayout() {
  const { perfil } = useAuth()

  return (
    <div className="admin-root">
      <AdminTopbar perfil={perfil} />

      <div className="admin-shell">
        <AdminSidebar perfil={perfil} />
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function AdminTopbar({ perfil }) {
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirmacao()
  const { isDark, toggleTheme } = useTema()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return undefined

    const closeMenu = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false)
    }

    document.addEventListener('mousedown', closeMenu)
    return () => document.removeEventListener('mousedown', closeMenu)
  }, [menuOpen])

  const handleLogout = async () => {
    const confirmed = await confirm({
      title: 'Sair do painel administrativo?',
      description: 'Sua sessão Selectio será encerrada neste navegador.',
      confirmLabel: 'Sair',
    })

    if (!confirmed) return

    await signOut(auth).catch(() => {})
    localStorage.removeItem('adminUser')
    localStorage.removeItem('empresaUser')
    localStorage.removeItem('indicadorUser')
    toast.info('Sessão administrativa encerrada.')
    navigate('/login')
  }

  return (
    <header className="admin-topbar">
      <NavLink className="admin-topbar-brand" to="/admin/visao-geral">
        <img src={logoVermelho} alt="Selectio" />
        <span>Admin</span>
      </NavLink>

      <div className="admin-topbar-context">
        <span>Ambiente administrativo</span>
        <strong>Operação Selectio</strong>
      </div>

      <div className="admin-topbar-actions">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
          title={isDark ? 'Tema claro' : 'Tema escuro'}
        >
          {isDark ? <FaSun /> : <FaMoon />}
        </button>

        <div className="admin-account" ref={menuRef}>
          <button
            type="button"
            className="admin-avatar-button"
            onClick={() => setMenuOpen((current) => !current)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            {initials(perfil?.nome || perfil?.email || 'Admin')}
          </button>

          {menuOpen && (
            <div className="admin-account-menu" role="menu">
              <strong>{perfil?.nome || 'Selectio Admin'}</strong>
              <span>{perfil?.email || 'Administrador'}</span>
              <button type="button" onClick={handleLogout}>
                <FaSignOutAlt /> Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function AdminSidebar({ perfil }) {
  const location = useLocation()
  const toast = useToast()

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-heading">
        <strong>Selectio Admin</strong>
        <span>Painel de controle</span>
      </div>

      <div className="admin-sidebar-user">
        <span>{initials(perfil?.nome || perfil?.email || 'Admin')}</span>
        <div>
          <strong>{perfil?.nome || 'Administrador'}</strong>
          <small>Platform owner</small>
        </div>
      </div>

      <nav className="admin-sidebar-nav">
        {adminItems.map((item) => {
          const Icon = item.icon

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={location.pathname === item.to ? 'active' : ''}
            >
              <Icon />
              <span>{item.label}</span>
            </NavLink>
          )
        })}

        <button
          type="button"
          className="disabled"
          onClick={() => toast.info('Configurações globais estarão disponíveis em uma versão futura.')}
        >
          <FaCog />
          <span>Configurações</span>
          <small>Em breve</small>
        </button>
      </nav>
    </aside>
  )
}

function initials(value) {
  return String(value || 'AD')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export default AdminLayout
