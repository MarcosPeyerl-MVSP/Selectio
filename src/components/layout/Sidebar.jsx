import './Sidebar.css'
import { NavLink, useLocation } from 'react-router-dom'
import {
  FaBriefcase,
  FaCalendarAlt,
  FaChartBar,
  FaClipboardCheck,
  FaCog,
  FaCreditCard,
  FaMoneyBillWave,
  FaPlus,
  FaUserFriends,
  FaUserTie,
  FaUsersCog,
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
    title: 'PAINEL DO INDICADOR',
    userLabel: 'Indicador',
    action: { to: '/vagas', label: 'Candidato', icon: FaPlus },
    items: [
      { to: '/vagas', label: 'Vagas', icon: FaBriefcase, activeOn: ['/vagas'], tourKey: 'vagas' },
      { to: '/candidatos/indicador', label: 'Candidatos', icon: FaUserFriends, activeOn: ['/candidatos/indicador', '/indicar'], tourKey: 'candidatos' },
      { to: '/painel/indicador', label: 'Dashboard', icon: FaChartBar, exact: true, tourKey: 'dashboard' },
      { to: '/painel/indicador?secao=perfil', label: 'Perfil', icon: FaUserTie, tourKey: 'perfil' },
      { to: '/painel/indicador?secao=financeiro', label: 'Financeiro', icon: FaMoneyBillWave, tourKey: 'financeiro' },
      { to: '/painel/indicador?secao=configuracoes', label: 'Configurações', icon: FaCog },
    ],
  },
  empresa: {
    title: 'PAINEL DA EMPRESA',
    userLabel: 'Empresa',
    action: { to: '/criar-vaga/empresa', label: 'Nova vaga', icon: FaPlus },
    items: [
      { to: '/vagas', label: 'Vagas', icon: FaBriefcase, activeOn: ['/vagas'], tourKey: 'vagas' },
      { to: '/candidatos/empresa', label: 'Candidatos', icon: FaUserFriends, activeOn: ['/candidatos/empresa'], tourKey: 'candidatos' },
      { to: '/painel/empresa', label: 'Dashboard', icon: FaChartBar, exact: true, tourKey: 'dashboard' },
      { to: '/painel/empresa?secao=perfil', label: 'Perfil', icon: FaUserTie, tourKey: 'perfil' },
      { to: '/painel/empresa?secao=pagamentos', label: 'Pagamentos', icon: FaCreditCard, tourKey: 'pagamentos' },
      { to: '/painel/empresa?secao=configuracoes', label: 'Configurações', icon: FaCog },
      { to: '/painel/empresa?secao=entrevistas', label: 'Entrevistas', icon: FaCalendarAlt, tourKey: 'entrevistas' },
    ],
  },
}

function getSidebarConfig(type, user) {
  if (type !== 'empresa' || !isModoEmpresarial(user)) {
    return sidebarConfig[type] || sidebarConfig.indicador
  }

  const setorId = user?.setorEmpresarial?.id
  const commonItems = [
    { to: '/painel/empresa', label: 'Dashboard', icon: FaChartBar, exact: true, tourKey: 'dashboard' },
    { to: '/painel/empresa?secao=perfil', label: 'Perfil', icon: FaUserTie, tourKey: 'perfil' },
    { to: '/painel/empresa?secao=configuracoes', label: 'Configuracoes', icon: FaCog },
  ]

  const configs = {
    [SETOR_CHEFE_DEPARTAMENTO]: {
      title: 'CHEFE DE DEPARTAMENTO',
      userLabel: 'Departamento',
      action: { to: '/criar-vaga/empresa', label: 'Solicitar vaga', icon: FaPlus },
      items: [
        { to: '/painel/empresa?secao=aprovacoes', label: 'Solicitacoes', icon: FaClipboardCheck, tourKey: 'vagas' },
        ...commonItems
      ]
    },
    [SETOR_REITORIA_AUDITORIA]: {
      title: 'REITORIA OU AUDITORIA',
      userLabel: 'Auditoria',
      action: { to: '/painel/empresa?secao=aprovacoes', label: 'Analisar', icon: FaClipboardCheck },
      items: [
        { to: '/painel/empresa?secao=aprovacoes', label: 'Aprovacoes', icon: FaClipboardCheck, tourKey: 'vagas' },
        ...commonItems
      ]
    },
    [SETOR_RH]: {
      title: 'SETOR RH',
      userLabel: 'RH',
      action: { to: '/painel/empresa?secao=aprovacoes', label: 'Publicar', icon: FaClipboardCheck },
      items: [
        { to: '/painel/empresa?secao=aprovacoes', label: 'Aprovadas', icon: FaClipboardCheck, tourKey: 'vagas' },
        { to: '/candidatos/empresa', label: 'Candidatos', icon: FaUserFriends, activeOn: ['/candidatos/empresa'], tourKey: 'candidatos' },
        { to: '/painel/empresa?secao=pagamentos', label: 'Pagamentos', icon: FaCreditCard, tourKey: 'pagamentos' },
        { to: '/painel/empresa?secao=entrevistas', label: 'Entrevistas', icon: FaCalendarAlt, tourKey: 'entrevistas' },
        ...commonItems
      ]
    },
    [SETOR_ADMIN_EMPRESA]: {
      title: 'ADMINISTRADOR EMPRESA',
      userLabel: 'Administrador',
      action: { to: '/painel/empresa?secao=setores', label: 'Setores', icon: FaUsersCog },
      items: [
        { to: '/painel/empresa?secao=setores', label: 'Setores', icon: FaUsersCog, tourKey: 'perfil' },
        { to: '/painel/empresa?secao=aprovacoes', label: 'Fluxo de vagas', icon: FaClipboardCheck, tourKey: 'vagas' },
        ...commonItems
      ]
    }
  }

  return configs[setorId] || configs[SETOR_ADMIN_EMPRESA]
}

function Sidebar({ type, user }) {
  const session = getSession()
  const { pathname, search } = useLocation()
  const activeType = type || session.type
  const activeUser = user || session.user
  if (!activeType || activeType === 'publico') return null

  const config = getSidebarConfig(activeType, activeUser)
  const ActionIcon = config.action.icon
  const userName = activeUser?.nome || activeUser?.nomeEmpresa || config.userLabel
  const userInfo = activeUser?.email || activeUser?.cnpj || config.userLabel

  return (
    <aside className="app-sidebar" data-tour={`${activeType}-sidebar`}>
      <h2 className="app-sidebar-title">{config.title}</h2>

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
              key={`${item.to}-${item.label}`}
              to={item.to}
              className={() => isItemActive(item, pathname, search) ? 'active' : ''}
              data-tour={item.tourKey ? `${activeType}-nav-${item.tourKey}` : undefined}
            >
              <Icon /> {item.label}
            </NavLink>
          )
        })}
      </nav>

      <NavLink className={() => 'app-sidebar-btn'} to={config.action.to} data-tour={`${activeType}-nav-action`}>
        <ActionIcon /> {config.action.label}
      </NavLink>
    </aside>
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
