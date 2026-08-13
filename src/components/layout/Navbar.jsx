import './Navbar.css'

import logoVermelho from '../../assets/Selectio_vermelho_sem_fundo.png'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { FaCog, FaExchangeAlt, FaSignOutAlt, FaUserAlt, FaUserCircle } from 'react-icons/fa'
import { LuMoonStar, LuSunMedium } from 'react-icons/lu'
import { signOut } from 'firebase/auth'
import { useTranslation } from 'react-i18next'
import { auth } from '../../services/firebase'
import { useTema } from '../../hooks/useTema'
import { useConfirmacao } from '../../hooks/useConfirmacao'
import { useToast } from '../../hooks/useToast'
import MenuNotificacoes from '../notificacoes/MenuNotificacoes'
import { useAuth } from '../../hooks/useAuth'
import { perfilExigeSetorEmpresarial } from '../../utils/modoEmpresarial'
import ModalAlterarSetor from './ModalAlterarSetor'
import LanguageSwitcher from './LanguageSwitcher'

function Navbar() {
  const { t } = useTranslation(['common', 'auth'])
  const navigate = useNavigate()
  const { isDark, toggleTheme } = useTema()
  const confirm = useConfirmacao()
  const toast = useToast()
  const { perfil, carregando: carregandoSessao, adotarPerfil } = useAuth()
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [sectorModalOpen, setSectorModalOpen] = useState(false)
  const profileMenuRef = useRef(null)
  const session = perfil?.tipo === 'empresa'
    ? {
      type: 'empresa',
      label: perfil.setorEmpresarial?.id
        ? t(`auth:sectors.${perfil.setorEmpresarial.id}`, { defaultValue: perfil.setorEmpresarial.nome })
        : t('account.company'),
      user: perfil,
      painelPath: '/painel/empresa'
    }
    : perfil?.tipo === 'indicador'
      ? { type: 'indicador', label: t('account.referrer'), user: perfil, painelPath: '/painel/indicador' }
      : perfil?.tipo === 'admin'
        ? { type: 'admin', label: t('account.administrator'), user: perfil, painelPath: '/admin/visao-geral' }
        : { type: 'publico', label: '', user: null, painelPath: '/login' }
  const userName = getUserName(session.user)
  const userEmail = getUserEmail(session.user)
  const accountPanelPath = session.type === 'indicador'
    ? '/painel/indicador/dashboard'
    : session.painelPath
  const profilePath = session.type === 'admin'
    ? '/admin/visao-geral'
    : `${accountPanelPath}?secao=perfil`
  const settingsPath = session.type === 'admin'
    ? '/admin/configuracoes'
    : `${accountPanelPath}?secao=configuracoes`
  const podeAlterarSetor = perfilExigeSetorEmpresarial(session.user)

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
      title: t('account.logoutTitle'),
      description: t('account.logoutDescription'),
      confirmLabel: t('account.logout')
    })

    if (!confirmed) return

    await signOut(auth).catch(() => {})
    localStorage.removeItem('empresaUser')
    localStorage.removeItem('indicadorUser')
    localStorage.removeItem('adminUser')
    setProfileMenuOpen(false)
    toast.info(t('account.sessionEnded'))
    navigate('/login')
  }

  const handleSectorChange = (perfilAtualizado, setor) => {
    adotarPerfil(perfilAtualizado)
    window.dispatchEvent(new CustomEvent('selectio:empresa-setor-alterado', {
      detail: perfilAtualizado
    }))
    setSectorModalOpen(false)
    toast.success(t('account.accessChanged', {
      sector: t(`auth:sectors.${setor.id}`, { defaultValue: setor.nome })
    }))
    navigate('/painel/empresa')
  }

  return (
    <header className="navbar">
      <img className="logo-img" src={logoVermelho} alt="Selectio" />

      <nav className="nav-links">
        <NavLink to="/">{t('navigation.home')}</NavLink>
        <NavLink to="/vagas">{t('navigation.jobs')}</NavLink>
        {session.type !== 'publico' && (
          <NavLink to={session.painelPath}>{t('navigation.dashboard')}</NavLink>
        )}
      </nav>

      <div className="navbar-right">
        {!carregandoSessao && session.type === 'publico' ? (
          <>
            <div className="user-actions">
              <button
                type="button"
                className="icon-button theme-toggle"
                onClick={toggleTheme}
                aria-label={isDark ? t('theme.activateLight') : t('theme.activateDark')}
                title={isDark ? t('theme.light') : t('theme.dark')}
              >
                {isDark ? <LuSunMedium /> : <LuMoonStar />}
              </button>
            </div>
            <nav className="nav-auth">
              <Link className="btn-primary" to="/cadastro">{t('navigation.signUp')}</Link>
              <Link className="btn-secondary" to="/login">{t('navigation.login')}</Link>
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
                aria-label={t('account.openProfileMenu')}
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
              >
                <FaUserCircle />
              </button>

              {profileMenuOpen && (
                <section className="profile-menu" role="menu" aria-label={t('account.profileMenu')}>
                  <header className="profile-menu-header">
                    <div className="profile-menu-avatar">
                      <FaUserAlt />
                    </div>
                    <div>
                      <strong>{userName || t('account.selectioUser')}</strong>
                      {userEmail && <span>{userEmail}</span>}
                      <small>{session.label}</small>
                    </div>
                  </header>

                  <div className="profile-menu-section">
                    <Link to={profilePath} role="menuitem" onClick={() => setProfileMenuOpen(false)}>
                      <FaUserCircle />
                      <span>{t('account.myProfile')}</span>
                    </Link>
                    <Link to={settingsPath} role="menuitem" onClick={() => setProfileMenuOpen(false)}>
                      <FaCog />
                      <span>{t('account.settings')}</span>
                    </Link>
                    {podeAlterarSetor && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setProfileMenuOpen(false)
                          setSectorModalOpen(true)
                        }}
                      >
                        <FaExchangeAlt />
                        <span>{t('account.changeSector')}</span>
                      </button>
                    )}
                  </div>

                  <div className="profile-menu-section">
                    <LanguageSwitcher
                      variant="menu"
                      onLanguageChange={() => setProfileMenuOpen(false)}
                    />
                    <button type="button" role="menuitem" onClick={toggleTheme}>
                      {isDark ? <LuSunMedium /> : <LuMoonStar />}
                      <span>{t('theme.current', {
                        theme: isDark ? t('theme.darkValue') : t('theme.lightValue')
                      })}</span>
                    </button>
                  </div>

                  <div className="profile-menu-section">
                    <button type="button" className="logout-item" role="menuitem" onClick={handleLogout}>
                      <FaSignOutAlt />
                      <span>{t('account.logout')}</span>
                    </button>
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </div>

      {sectorModalOpen && podeAlterarSetor && (
        <ModalAlterarSetor
          empresa={session.user}
          onClose={() => setSectorModalOpen(false)}
          onSuccess={handleSectorChange}
        />
      )}
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
