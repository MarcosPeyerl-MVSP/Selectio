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
import GuidedTour from '../../components/onboarding/GuidedTour'
import PageLoader from '../../components/ui/PageLoader'
import EmpresaEntrevistas from './EmpresaEntrevistas'
import EmpresaPagamentos from './EmpresaPagamentos'
import EmpresaPerfil from './EmpresaPerfil'
import { getFirebaseUid } from '../../services/identidadeFirebase'
import { buscarPerfilUsuario, marcarTourUsuarioConcluido } from '../../services/firestoreUsers'

const empresaCards = [
  {
    icon: FaSuitcase,
    title: 'Minhas Vagas',
    description: 'Crie sua rede de postagens de vagas, melhore suas conexões e contrate rápido.',
    to: '/criar-vaga/empresa',
    action: 'Criar Vagas',
    dataTour: 'empresa-card-vagas'
  },
  {
    icon: FaUserFriends,
    title: 'Candidatos',
    description: 'Veja os candidatos disponíveis para suas vagas publicadas.',
    to: '/candidatos/empresa',
    action: 'Ver Candidatos',
    dataTour: 'empresa-card-candidatos'
  },
  {
    icon: FaUserTie,
    title: 'Perfil',
    description: 'Personalize o perfil da sua empresa e gerencie seus dados.',
    to: '/painel/empresa?secao=perfil',
    action: 'Meu Perfil',
    dataTour: 'empresa-card-perfil'
  },
  {
    icon: FaChartBar,
    title: 'Dashboard',
    description: 'Acompanhe status, ganhos e impacto das suas contratações.',
    to: '/painel/empresa',
    action: 'Acompanhar',
    dataTour: 'empresa-card-dashboard'
  },
  {
    icon: FaCalendarAlt,
    title: 'Entrevistas',
    description: 'Organize e acompanhe entrevistas com candidatos de forma simples.',
    to: '/painel/empresa?secao=entrevistas',
    action: 'Minhas Entrevistas',
    dataTour: 'empresa-card-entrevistas'
  },
  {
    icon: FaCreditCard,
    title: 'Pagamentos',
    description: 'Acompanhe recompensas pagas aos indicadores por contratações.',
    to: '/painel/empresa?secao=pagamentos',
    action: 'Ver Pagamentos',
    dataTour: 'empresa-card-pagamentos'
  }
]

const empresaTourSteps = [
  {
    title: 'Bem-vindo ao painel da empresa',
    description: 'Aqui você acompanha vagas, candidatos indicados, entrevistas e pagamentos de recompensas.'
  },
  {
    selector: '[data-tour="empresa-sidebar"]',
    align: 'start',
    title: 'Menu lateral',
    description: 'Use o menu lateral para navegar pelas principais áreas do painel.'
  },
  {
    selector: '[data-tour="empresa-card-vagas"]',
    title: 'Vagas',
    description: 'Crie e gerencie suas vagas para começar a receber indicações.'
  },
  {
    selector: '[data-tour="empresa-card-candidatos"]',
    title: 'Candidatos',
    description: 'Aqui ficam os candidatos indicados para suas vagas. Você pode acompanhar e atualizar o status de cada um.'
  },
  {
    selector: '[data-tour="empresa-card-entrevistas"]',
    title: 'Entrevistas',
    description: 'Organize entrevistas com candidatos promissores e acompanhe os agendamentos.'
  },
  {
    selector: '[data-tour="empresa-card-pagamentos"]',
    title: 'Pagamentos',
    description: 'Quando um candidato for contratado, acompanhe e pague a recompensa do indicador.'
  },
  {
    selector: '[data-tour="navbar-account-actions"]',
    scroll: false,
    title: 'Notificações e perfil',
    description: 'Receba alertas importantes e acesse configurações, tema e perfil da conta.'
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
  const empresaUid = getFirebaseUid(empresa)
  const [perfilCarregado, setPerfilCarregado] = useState(() => !empresaUid)

  useEffect(() => {
    if (!empresaUid) return undefined

    let ativo = true

    const carregarPerfil = async () => {
      try {
        const perfil = await buscarPerfilUsuario(empresaUid)
        if (!ativo || !perfil) return

        setEmpresa((empresaAtual) => {
          const merged = {
            ...empresaAtual,
            ...perfil,
            id: perfil.id || empresaUid,
            uid: empresaUid,
            firebaseUid: empresaUid
          }

          localStorage.setItem('empresaUser', JSON.stringify(merged))
          return merged
        })
      } catch (error) {
        console.error('Erro ao buscar perfil da empresa:', error)
      } finally {
        if (ativo) setPerfilCarregado(true)
      }
    }

    carregarPerfil()

    return () => {
      ativo = false
    }
  }, [empresaUid])

  useEffect(() => {
    if (!empresa) {
      navigate('/login')
    }
  }, [empresa, navigate])

  if (!empresa || !perfilCarregado) return <PageLoader label="Carregando painel da empresa..." />

  const tourConcluido = Boolean(empresa.tourEmpresaConcluido || empresa.onboardingTour?.empresaConcluido)

  const concluirTour = async () => {
    const atualizacao = {
      tourEmpresaConcluido: true,
      onboardingTour: {
        ...(empresa.onboardingTour || {}),
        empresaConcluido: true
      }
    }

    setEmpresa((empresaAtual) => {
      const merged = { ...empresaAtual, ...atualizacao }
      localStorage.setItem('empresaUser', JSON.stringify(merged))
      return merged
    })

    await marcarTourUsuarioConcluido({ uid: empresaUid, tipo: 'empresa' }).catch(() => {})
  }

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

          <GuidedTour
            key={`empresa-tour-${empresaUid}`}
            active={activeSection === 'dashboard' && !tourConcluido}
            steps={empresaTourSteps}
            storageKey={`empresa-${empresaUid}`}
            onFinish={concluirTour}
          />
        </>
      )}
    </DashboardLayout>
  )
}

export default PainelEmpresa
