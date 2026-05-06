import './Sidebar.css'
import { NavLink } from 'react-router-dom'
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
      { to: '/vagas', label: 'Vagas', icon: FaBriefcase },
      { to: '/painel/indicador', label: 'Dashboard', icon: FaChartBar },
      { to: '/painel/indicador', label: 'Candidatos', icon: FaUserFriends },
      { to: '/painel/indicador', label: 'Perfil', icon: FaUserTie },
      { to: '/painel/indicador', label: 'Configuracoes', icon: FaCog },
    ],
  },
  empresa: {
    title: 'PAINEL DA EMPRESA',
    userLabel: 'Empresa',
    action: { to: '/criar-vaga/empresa', label: 'Nova vaga', icon: FaPlus },
    items: [
      { to: '/vagas', label: 'Vagas', icon: FaBriefcase },
      { to: '/painel/empresa', label: 'Dashboard', icon: FaChartBar },
      { to: '/painel/empresa', label: 'Perfil', icon: FaUserTie },
      { to: '/painel/empresa', label: 'Configuracoes', icon: FaCog },
      { to: '/painel/empresa', label: 'Entrevistas', icon: FaCalendarAlt },
    ],
  },
}

function Sidebar({ type, user }) {
  const session = getSession()
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
            <NavLink key={`${item.to}-${item.label}`} to={item.to}>
              <Icon /> {item.label}
            </NavLink>
          )
        })}
      </nav>

      <NavLink className="app-sidebar-btn" to={config.action.to}>
        <ActionIcon /> {config.action.label}
      </NavLink>
    </aside>
  )
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
