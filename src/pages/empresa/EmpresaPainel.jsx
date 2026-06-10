// Objetivo do arquivo: renderizar o painel central da empresa.
// A pagina valida a sessão da empresa e exibe secoes internas de dashboard,
// perfil, configuracoes e entrevistas.

import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  FaCalendarAlt,
  FaChartBar,
  FaCreditCard,
  FaSuitcase,
  FaUserFriends,
  FaUserTie
} from 'react-icons/fa'

import ConfiguracoesConta from '../../components/configuracoes-conta/ConfiguracoesConta'
import DashboardActionCard from '../../components/dashboard/DashboardActionCard'
import DashboardHeader from '../../components/dashboard/DashboardHeader'
import DashboardLayout from '../../components/dashboard/DashboardLayout'
import PageLoader from '../../components/ui/PageLoader'
import EmpresaEntrevistas from './EmpresaEntrevistas'
import EmpresaPagamentos from './EmpresaPagamentos'
import EmpresaPerfil from './EmpresaPerfil'

const empresaCards = [
  {
    icon: FaSuitcase,
    title: 'Minhas Vagas',
    description: 'Crie sua rede de postagens de vagas, melhore suas conexões e contrate rápido.',
    to: '/criar-vaga/empresa',
    action: 'Criar Vagas'
  },
  {
    icon: FaUserFriends,
    title: 'Candidatos',
    description: 'Veja os candidatos disponíveis para suas vagas publicadas.',
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
    description: 'Acompanhe status, ganhos e impacto das suas contratações.',
    to: '/painel/empresa',
    action: 'Acompanhar'
  },
  {
    icon: FaCalendarAlt,
    title: 'Entrevistas',
    description: 'Organize e acompanhe entrevistas com candidatos de forma simples.',
    to: '/painel/empresa?secao=entrevistas',
    action: 'Minhas Entrevistas'
  },
  {
    icon: FaCreditCard,
    title: 'Pagamentos',
    description: 'Acompanhe recompensas pagas aos indicadores por contratações.',
    to: '/painel/empresa?secao=pagamentos',
    action: 'Ver Pagamentos'
  }
]

function PainelEmpresa() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const activeSection = searchParams.get('secao') || 'dashboard'

  const [empresa, setEmpresa] = useState(() => {
    const storedEmpresa = localStorage.getItem('empresaUser')
    return storedEmpresa ? JSON.parse(storedEmpresa) : null
  })

  useEffect(() => {
    if (!empresa) {
      navigate('/login')
    }
  }, [empresa, navigate])

  if (!empresa) return <PageLoader label="Carregando painel da empresa..." />

  return (
    <DashboardLayout sidebarType="empresa" user={empresa}>
      {activeSection === 'configuracoes' ? (
        <ConfiguracoesConta user={empresa} tipo="empresa" onUserUpdate={setEmpresa} />
      ) : activeSection === 'perfil' ? (
        <EmpresaPerfil empresa={empresa} onUserUpdate={setEmpresa} />
      ) : activeSection === 'entrevistas' ? (
        <EmpresaEntrevistas empresa={empresa} />
      ) : activeSection === 'pagamentos' ? (
        <EmpresaPagamentos empresa={empresa} />
      ) : (
        <>
          <DashboardHeader
            eyebrow="BOAS-VINDAS - Painel Central"
            greeting="Bem-vinda,"
            name={empresa.nomeEmpresa}
            description="Gerencie suas vagas, explore novas oportunidades e acompanhe seu crescimento em um só lugar."
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
