import './AdminLayout.css'

import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  FaBriefcase,
  FaBuilding,
  FaChartPie,
  FaCog,
  FaMoneyCheckAlt,
  FaSignOutAlt,
  FaUserFriends,
  FaUserTie,
} from 'react-icons/fa'
import { LuMoonStar, LuSunMedium } from 'react-icons/lu'
import { signOut } from 'firebase/auth'

import logoVermelho from '../../assets/Selectio_vermelho_sem_fundo.png'
import { useAuth } from '../../hooks/useAuth'
import { useConfirmacao } from '../../hooks/useConfirmacao'
import { useTema } from '../../hooks/useTema'
import { useToast } from '../../hooks/useToast'
import { auth } from '../../services/firebase'
import LanguageSwitcher from '../layout/LanguageSwitcher'

const adminItems = [
  { to: '/admin/visao-geral', labelKey: 'layout.overview', icon: FaChartPie },
  { to: '/admin/empresas', labelKey: 'layout.companies', icon: FaBuilding },
  { to: '/admin/indicadores', labelKey: 'layout.referrers', icon: FaUserTie },
  { to: '/admin/vagas', labelKey: 'layout.jobs', icon: FaBriefcase },
  { to: '/admin/candidatos', labelKey: 'layout.candidates', icon: FaUserFriends },
  { to: '/admin/financeiro', labelKey: 'layout.finance', icon: FaMoneyCheckAlt },
  { to: '/admin/configuracoes', labelKey: 'layout.settings', icon: FaCog },
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
  const { t } = useTranslation(['admin', 'common'])
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
      title: t('layout.logoutTitle'),
      description: t('layout.logoutDescription'),
      confirmLabel: t('common:account.logout'),
    })

    if (!confirmed) return

    await signOut(auth).catch(() => {})
    localStorage.removeItem('adminUser')
    localStorage.removeItem('empresaUser')
    localStorage.removeItem('indicadorUser')
    toast.info(t('layout.sessionEnded'))
    navigate('/login')
  }

  return (
    <header className="admin-topbar">
      <NavLink className="admin-topbar-brand" to="/admin/visao-geral">
        <img src={logoVermelho} alt="Selectio" />
        <span>Admin</span>
      </NavLink>

      <div className="admin-topbar-context">
        <span>{t('layout.environment')}</span>
        <strong>{t('layout.operation')}</strong>
      </div>

      <div className="admin-topbar-actions">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? t('common:theme.activateLight') : t('common:theme.activateDark')}
          title={isDark ? t('common:theme.light') : t('common:theme.dark')}
        >
          {isDark ? <LuSunMedium /> : <LuMoonStar />}
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
              <strong>{perfil?.nome || t('layout.selectioAdmin')}</strong>
              <span>{perfil?.email || t('layout.administrator')}</span>
              <LanguageSwitcher
                variant="menu"
                onLanguageChange={() => setMenuOpen(false)}
              />
              <button type="button" onClick={handleLogout}>
                <FaSignOutAlt /> {t('common:account.logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function AdminSidebar({ perfil }) {
  const { t } = useTranslation('admin')
  const location = useLocation()

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-heading">
        <strong>{t('layout.selectioAdmin')}</strong>
        <span>{t('layout.controlPanel')}</span>
      </div>

      <div className="admin-sidebar-user">
        <span>{initials(perfil?.nome || perfil?.email || 'Admin')}</span>
        <div>
          <strong>{perfil?.nome || t('layout.administrator')}</strong>
          <small>{t('layout.platformOwner')}</small>
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
              <span>{t(item.labelKey)}</span>
            </NavLink>
          )
        })}

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
