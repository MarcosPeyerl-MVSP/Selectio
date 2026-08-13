import './Sidebar.css'
import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  FaBars,
  FaBriefcase,
  FaCalendarAlt,
  FaChartBar,
  FaChevronLeft,
  FaChevronRight,
  FaClipboardCheck,
  FaCog,
  FaCreditCard,
  FaMoneyBillWave,
  FaPlus,
  FaUserFriends,
  FaUserTie,
  FaUsersCog,
  FaTimes,
} from 'react-icons/fa'
import {
  SETOR_ADMIN_EMPRESA,
  SETOR_CHEFE_DEPARTAMENTO,
  SETOR_REITORIA_AUDITORIA,
  SETOR_RH,
  isModoEmpresarial
} from '../../utils/modoEmpresarial'

const sidebarConfig = {
  indicador: {
    titleKey: 'sidebar.referrerPanel',
    userLabelKey: 'account.referrer',
    action: { to: '/candidatos/indicador/novo', labelKey: 'sidebar.candidate', icon: FaPlus },
    items: [
      { to: '/vagas', labelKey: 'sidebar.jobs', icon: FaBriefcase, activeOn: ['/vagas'], tourKey: 'vagas' },
      { to: '/candidatos/indicador', labelKey: 'sidebar.candidates', icon: FaUserFriends, activeOn: ['/candidatos/indicador', '/indicar'], tourKey: 'candidatos' },
      { to: '/painel/indicador/dashboard', labelKey: 'sidebar.dashboard', icon: FaChartBar, exact: true, tourKey: 'dashboard' },
      { to: '/painel/indicador/dashboard?secao=perfil', labelKey: 'sidebar.profile', icon: FaUserTie, tourKey: 'perfil' },
      { to: '/painel/indicador/dashboard?secao=financeiro', labelKey: 'sidebar.finance', icon: FaMoneyBillWave, tourKey: 'financeiro' },
      { to: '/painel/indicador/dashboard?secao=configuracoes', labelKey: 'sidebar.settings', icon: FaCog },
    ],
  },
  empresa: {
    titleKey: 'sidebar.companyPanel',
    userLabelKey: 'account.company',
    action: { to: '/criar-vaga/empresa', labelKey: 'sidebar.newJob', icon: FaPlus },
    items: [
      { to: '/vagas', labelKey: 'sidebar.jobs', icon: FaBriefcase, activeOn: ['/vagas'], tourKey: 'vagas' },
      { to: '/candidatos/empresa', labelKey: 'sidebar.candidates', icon: FaUserFriends, activeOn: ['/candidatos/empresa'], tourKey: 'candidatos' },
      { to: '/painel/empresa', labelKey: 'sidebar.dashboard', icon: FaChartBar, exact: true, tourKey: 'dashboard' },
      { to: '/painel/empresa?secao=perfil', labelKey: 'sidebar.profile', icon: FaUserTie, tourKey: 'perfil' },
      { to: '/painel/empresa?secao=pagamentos', labelKey: 'sidebar.payments', icon: FaCreditCard, tourKey: 'pagamentos' },
      { to: '/painel/empresa?secao=configuracoes', labelKey: 'sidebar.settings', icon: FaCog },
      { to: '/painel/empresa?secao=entrevistas', labelKey: 'sidebar.interviews', icon: FaCalendarAlt, tourKey: 'entrevistas' },
    ],
  },
}

function getSidebarConfig(type, user) {
  if (type !== 'empresa' || !isModoEmpresarial(user)) {
    return sidebarConfig[type] || sidebarConfig.indicador
  }

  const setorId = user?.setorEmpresarial?.id
  const commonItems = [
    { to: '/painel/empresa', labelKey: 'sidebar.dashboard', icon: FaChartBar, exact: true, tourKey: 'dashboard' },
    { to: '/painel/empresa?secao=perfil', labelKey: 'sidebar.profile', icon: FaUserTie, tourKey: 'perfil' },
    { to: '/painel/empresa?secao=configuracoes', labelKey: 'sidebar.settings', icon: FaCog },
  ]

  const configs = {
    [SETOR_CHEFE_DEPARTAMENTO]: {
      titleKey: 'sidebar.departmentHead',
      userLabelKey: 'sidebar.department',
      action: { to: '/criar-vaga/empresa', labelKey: 'sidebar.requestJob', icon: FaPlus },
      items: [
        { to: '/painel/empresa?secao=aprovacoes', labelKey: 'sidebar.requests', icon: FaClipboardCheck, tourKey: 'vagas' },
        ...commonItems
      ]
    },
    [SETOR_REITORIA_AUDITORIA]: {
      titleKey: 'sidebar.rectoryAudit',
      userLabelKey: 'sidebar.audit',
      action: { to: '/painel/empresa?secao=aprovacoes', labelKey: 'sidebar.analyze', icon: FaClipboardCheck },
      items: [
        { to: '/painel/empresa?secao=aprovacoes', labelKey: 'sidebar.approvals', icon: FaClipboardCheck, tourKey: 'vagas' },
        ...commonItems
      ]
    },
    [SETOR_RH]: {
      titleKey: 'sidebar.hrSector',
      userLabelKey: 'sidebar.hr',
      action: { to: '/painel/empresa?secao=aprovacoes', labelKey: 'sidebar.publish', icon: FaClipboardCheck },
      items: [
        { to: '/painel/empresa?secao=aprovacoes', labelKey: 'sidebar.approved', icon: FaClipboardCheck, tourKey: 'vagas' },
        { to: '/candidatos/empresa', labelKey: 'sidebar.candidates', icon: FaUserFriends, activeOn: ['/candidatos/empresa'], tourKey: 'candidatos' },
        { to: '/painel/empresa?secao=pagamentos', labelKey: 'sidebar.payments', icon: FaCreditCard, tourKey: 'pagamentos' },
        { to: '/painel/empresa?secao=entrevistas', labelKey: 'sidebar.interviews', icon: FaCalendarAlt, tourKey: 'entrevistas' },
        ...commonItems
      ]
    },
    [SETOR_ADMIN_EMPRESA]: {
      titleKey: 'sidebar.companyAdministrator',
      userLabelKey: 'account.administrator',
      action: { to: '/painel/empresa?secao=setores', labelKey: 'sidebar.sectors', icon: FaUsersCog },
      items: [
        { to: '/painel/empresa?secao=setores', labelKey: 'sidebar.sectors', icon: FaUsersCog, tourKey: 'perfil' },
        { to: '/painel/empresa?secao=aprovacoes', labelKey: 'sidebar.jobFlow', icon: FaClipboardCheck, tourKey: 'vagas' },
        ...commonItems
      ]
    }
  }

  return configs[setorId] || configs[SETOR_ADMIN_EMPRESA]
}

function Sidebar({ type, user }) {
  const { t } = useTranslation('common')
  const [collapsed, setCollapsed] = useState(() => (
    localStorage.getItem('selectioSidebarCollapsed') === 'true'
  ))
  const [mobileOpen, setMobileOpen] = useState(false)
  const session = getSession()
  const { pathname, search } = useLocation()
  const activeType = type || session.type
  const activeUser = user || session.user

  useEffect(() => {
    localStorage.setItem('selectioSidebarCollapsed', String(collapsed))
  }, [collapsed])

  useEffect(() => {
    if (!mobileOpen) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [mobileOpen])

  if (!activeType || activeType === 'publico') return null

  const config = getSidebarConfig(activeType, activeUser)
  const ActionIcon = config.action.icon
  const userLabel = t(config.userLabelKey)
  const userName = activeUser?.nome || activeUser?.nomeEmpresa || userLabel
  const userInfo = activeUser?.email || activeUser?.cnpj || userLabel

  return (
    <>
      <button
        type="button"
        className="sidebar-mobile-trigger"
        onClick={() => setMobileOpen(true)}
        aria-label={t('sidebar.open')}
        aria-controls="selectio-sidebar"
        aria-expanded={mobileOpen}
      >
        <FaBars />
      </button>

      {mobileOpen && (
        <button
          type="button"
          className="sidebar-mobile-overlay"
          onClick={() => setMobileOpen(false)}
          aria-label={t('sidebar.close')}
        />
      )}

    <aside
      id="selectio-sidebar"
      className={`app-sidebar retractable ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`.trim()}
      data-tour={`${activeType}-sidebar`}
    >
      <button
        type="button"
        className="app-sidebar-toggle"
        onClick={() => mobileOpen ? setMobileOpen(false) : setCollapsed((current) => !current)}
        aria-label={mobileOpen
          ? t('sidebar.close')
          : collapsed
            ? t('sidebar.expand')
            : t('sidebar.collapse')}
        aria-expanded={mobileOpen || !collapsed}
      >
        <FaChevronLeft className="sidebar-collapse-icon" />
        <FaChevronRight className="sidebar-expand-icon" />
        <FaTimes className="sidebar-mobile-close-icon" />
      </button>

      <h2 className="app-sidebar-title">{t(config.titleKey)}</h2>

      <div className="app-sidebar-user">
        <FaUserTie />
        <div>
          <strong>{userName}</strong>
          <p>{userInfo}</p>
        </div>
      </div>

      <nav className="app-sidebar-menu">
        {config.items.map((item) => {
          const Icon = item.icon

          return (
            <NavLink
              key={`${item.to}-${item.labelKey}`}
              to={item.to}
              className={() => isItemActive(item, pathname, search) ? 'active' : ''}
              data-tour={item.tourKey ? `${activeType}-nav-${item.tourKey}` : undefined}
              title={collapsed ? t(item.labelKey) : undefined}
              onClick={() => setMobileOpen(false)}
            >
              <Icon /> <span>{t(item.labelKey)}</span>
            </NavLink>
          )
        })}
      </nav>

      <NavLink
        className={() => 'app-sidebar-btn'}
        to={config.action.to}
        data-tour={`${activeType}-nav-action`}
        title={collapsed ? t(config.action.labelKey) : undefined}
        onClick={() => setMobileOpen(false)}
      >
        <ActionIcon /> <span>{t(config.action.labelKey)}</span>
      </NavLink>
    </aside>
    </>
  )
}

function splitTarget(to) {
  const [path, query] = to.split('?')
  return {
    path,
    search: query ? `?${query}` : ''
  }
}

function isItemActive(item, pathname, search) {
  const target = splitTarget(item.to)

  if (target.search) {
    return pathname === target.path && search === target.search
  }

  if (item.exact) {
    return pathname === target.path && !search
  }

  if (pathname === target.path && !search) {
    return true
  }

  return item.activeOn?.some((path) => pathname.startsWith(path)) || false
}

function getSession() {
  const empresa = getStoredUser('empresaUser')
  if (empresa) return { type: 'empresa', user: empresa }

  const indicador = getStoredUser('indicadorUser')
  if (indicador) return { type: 'indicador', user: indicador }

  return { type: 'publico', user: null }
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

export default Sidebar
