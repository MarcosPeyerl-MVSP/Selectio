// Objetivo do arquivo: renderizar o painel central da empresa.
// A pagina valida a sessao da empresa e exibe secoes internas de dashboard,
// perfil, configuracoes e entrevistas.

import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  FaCalendarAlt,
  FaChartBar,
  FaSuitcase,
  FaUserFriends,
  FaUserTie
} from 'react-icons/fa'

import AccountSettings from '../../../components/AccountSettings/AccountSettings'
import DashboardActionCard from '../../../components/dashboard/DashboardActionCard'
import DashboardHeader from '../../../components/dashboard/DashboardHeader'
import DashboardLayout from '../../../components/dashboard/DashboardLayout'
import PanelPlaceholder from '../../../components/dashboard/PanelPlaceholder'

const empresaCards = [
  {
    icon: FaSuitcase,
    title: 'Minhas Vagas',
    description: 'Crie sua rede de postagens de vagas, melhore suas conexoes e contrate rapido.',
    to: '/criar-vaga/empresa',
    action: 'Criar Vagas'
  },
  {
    icon: FaUserFriends,
    title: 'Candidatos',
    description: 'Veja os candidatos disponiveis para suas vagas publicadas.',
    to: '/candidatos/empresa',
    action: 'Ver Candidatos'
  },
  {
    icon: FaUserTie,
    title: 'Perfil',
    description: 'Personalize o perfil da sua empresa e gerencie seus dados.',
    to: '/painel/empresa?secao=perfil',
    action: 'Meu Perfil'
  },
  {
    icon: FaChartBar,
    title: 'Dashboard',
    description: 'Acompanhe status, ganhos e impacto das suas contratacoes.',
    to: '/painel/empresa',
    action: 'Acompanhar'
  },
  {
    icon: FaCalendarAlt,
    title: 'Entrevistas',
    description: 'Organize e acompanhe entrevistas com candidatos de forma simples.',
    to: '/painel/empresa?secao=entrevistas',
    action: 'Minhas Entrevistas'
  }
]

function PainelEmpresa() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const activeSection = searchParams.get('secao') || 'dashboard'

  const [empresa] = useState(() => {
    const storedEmpresa = localStorage.getItem('empresaUser')
    return storedEmpresa ? JSON.parse(storedEmpresa) : null
  })

  useEffect(() => {
    if (!empresa) {
      navigate('/login')
    }
  }, [empresa, navigate])

  if (!empresa) return null

  return (
    <DashboardLayout sidebarType="empresa" user={empresa}>
      {activeSection === 'configuracoes' ? (
        <AccountSettings user={empresa} tipo="empresa" />
      ) : activeSection === 'perfil' ? (
        <PanelPlaceholder
          title="Perfil da empresa"
          description="Esta area sera liberada em uma proxima etapa. Por enquanto, os dados de acesso ficam em Configuracoes."
        />
      ) : activeSection === 'entrevistas' ? (
        <PanelPlaceholder
          title="Entrevistas"
          description="A organizacao de entrevistas continuara dentro deste painel quando a funcionalidade estiver pronta."
        />
      ) : (
        <>
          <DashboardHeader
            eyebrow="BOAS-VINDAS - Painel Central"
            greeting="Bem-vinda,"
            name={empresa.nomeEmpresa}
            description="Gerencie suas vagas, explore novas oportunidades e acompanhe seu crescimento em um so lugar."
          />

          <section className="dashboard-cards">
            {empresaCards.map((card) => (
              <DashboardActionCard key={card.title} {...card} />
            ))}
          </section>

          <Link className="dashboard-floating-btn" to="/criar-vaga/empresa">+</Link>
        </>
      )}
    </DashboardLayout>
  )
}

export default PainelEmpresa
