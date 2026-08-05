import './styles/PainelIndicador.css'
import '../../components/dashboard/Dashboard.css'

import { Link, Navigate, useSearchParams } from 'react-router-dom'
import {
  FaBriefcase,
  FaChartBar,
  FaCog,
  FaMoneyBillWave,
  FaPlus,
  FaUserFriends,
  FaUserTie,
} from 'react-icons/fa'

import DashboardActionCard from '../../components/dashboard/DashboardActionCard'
import DashboardHeader from '../../components/dashboard/DashboardHeader'
import DashboardLayout from '../../components/dashboard/DashboardLayout'
import { useAuth } from '../../hooks/useAuth'

const painelCards = [
  {
    icon: FaBriefcase,
    title: 'Vagas',
    description: 'Explore oportunidades abertas e encontre a vaga certa para cada talento da sua rede.',
    to: '/vagas',
    action: 'Explorar vagas',
  },
  {
    icon: FaUserFriends,
    title: 'Candidatos',
    description: 'Cadastre profissionais e acompanhe todas as indicações enviadas às empresas.',
    to: '/candidatos/indicador',
    action: 'Ver candidatos',
  },
  {
    icon: FaUserTie,
    title: 'Perfil',
    description: 'Atualize seus dados, especialidades e informações profissionais na plataforma.',
    to: '/painel/indicador/dashboard?secao=perfil',
    action: 'Meu perfil',
  },
  {
    icon: FaChartBar,
    title: 'Dashboard',
    description: 'Acompanhe indicações, conversões, contratações e o desempenho da sua rede.',
    to: '/painel/indicador/dashboard',
    action: 'Acompanhar',
  },
  {
    icon: FaMoneyBillWave,
    title: 'Financeiro',
    description: 'Consulte recompensas, pagamentos aprovados, saldo disponível e movimentações.',
    to: '/painel/indicador/dashboard?secao=financeiro',
    action: 'Ver financeiro',
  },
  {
    icon: FaCog,
    title: 'Configurações',
    description: 'Gerencie sua conta, preferências de acesso e opções de segurança.',
    to: '/painel/indicador/dashboard?secao=configuracoes',
    action: 'Configurar conta',
  },
]

function PainelIndicador() {
  const { perfil } = useAuth()
  const [searchParams] = useSearchParams()
  const secaoLegada = searchParams.get('secao')

  if (secaoLegada) {
    return <Navigate to={`/painel/indicador/dashboard?secao=${encodeURIComponent(secaoLegada)}`} replace />
  }

  return (
    <DashboardLayout sidebarType="indicador" user={perfil}>
      <section className="indicador-central-panel">
        <DashboardHeader
          eyebrow="BOAS-VINDAS - Painel Central"
          greeting="Bem-vindo,"
          name={perfil?.nome || perfil?.nomeCompleto || 'Indicador'}
          description="Explore oportunidades, gerencie seus candidatos e acompanhe seu crescimento em um só lugar."
        />

        <section className="dashboard-cards" aria-label="Atalhos do painel do indicador">
          {painelCards.map((card) => (
            <DashboardActionCard key={card.title} {...card} />
          ))}
        </section>

        <Link
          className="dashboard-floating-btn"
          to="/candidatos/indicador/novo"
          aria-label="Cadastrar candidato"
          title="Cadastrar candidato"
        >
          <FaPlus aria-hidden="true" />
        </Link>
      </section>
    </DashboardLayout>
  )
}

export default PainelIndicador
