import './Sidebar.css'
import { NavLink, useLocation } from 'react-router-dom'
import {
  FaBriefcase,
  FaCalendarAlt,
  FaChartBar,
  FaCog,
  FaPlus,
  FaUserFriends,
  FaUserTie,
} from 'react-icons/fa'

const sidebarConfig = {
  indicador: {
    title: 'PAINEL DO INDICADOR',
    userLabel: 'Indicador',
    action: { to: '/vagas', label: 'Candidato', icon: FaPlus },
    items: [
      { to: '/vagas', label: 'Vagas', icon: FaBriefcase, activeOn: ['/vagas'] },
      { to: '/candidatos/indicador', label: 'Candidatos', icon: FaUserFriends, activeOn: ['/candidatos/indicador', '/indicar'] },
      { to: '/painel/indicador', label: 'Dashboard', icon: FaChartBar, exact: true },
      { to: '/painel/indicador?secao=perfil', label: 'Perfil', icon: FaUserTie },
      { to: '/painel/indicador?secao=configuracoes', label: 'Configuracoes', icon: FaCog },
    ],
  },
  empresa: {
    title: 'PAINEL DA EMPRESA',
    userLabel: 'Empresa',
    action: { to: '/criar-vaga/empresa', label: 'Nova vaga', icon: FaPlus },
    items: [
      { to: '/vagas', label: 'Vagas', icon: FaBriefcase, activeOn: ['/vagas'] },
      { to: '/candidatos/empresa', label: 'Candidatos', icon: FaUserFriends, activeOn: ['/candidatos/empresa'] },
      { to: '/painel/empresa', label: 'Dashboard', icon: FaChartBar, exact: true },
      { to: '/painel/empresa?secao=perfil', label: 'Perfil', icon: FaUserTie },
      { to: '/painel/empresa?secao=configuracoes', label: 'Configuracoes', icon: FaCog },
      { to: '/painel/empresa?secao=entrevistas', label: 'Entrevistas', icon: FaCalendarAlt },
    ],
  },
}

function Sidebar({ type, user }) {
  const session = getSession()
  const { pathname, search } = useLocation()
  const activeType = type || session.type
  const activeUser = user || session.user
  if (!activeType || activeType === 'publico') return null

  const config = sidebarConfig[activeType] || sidebarConfig.indicador
  const ActionIcon = config.action.icon
  const userName = activeUser?.nome || activeUser?.nomeEmpresa || config.userLabel
  const userInfo = activeUser?.email || activeUser?.cnpj || config.userLabel

  return (
    <aside className="app-sidebar">
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
            >
              <Icon /> {item.label}
            </NavLink>
          )
        })}
      </nav>

      <NavLink className={() => 'app-sidebar-btn'} to={config.action.to}>
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
