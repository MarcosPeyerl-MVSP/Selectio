// Objetivo do arquivo: renderizar o painel central do indicador.
// A pagina valida a sessão do indicador, atualiza dados, busca metricas
// e exibe as secoes internas de dashboard, perfil e configuracoes.

import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FaChartBar, FaMoneyBillWave, FaSuitcase, FaUserFriends, FaUserTie } from 'react-icons/fa'

import ConfiguracoesConta from '../../components/configuracoes-conta/ConfiguracoesConta'
import DashboardActionCard from '../../components/dashboard/DashboardActionCard'
import DashboardHeader from '../../components/dashboard/DashboardHeader'
import DashboardLayout from '../../components/dashboard/DashboardLayout'
import GuidedTour from '../../components/onboarding/GuidedTour'
import PageLoader from '../../components/ui/PageLoader'
import IndicadorFinanceiro from './IndicadorFinanceiro'
import IndicadorPerfil from './IndicadorPerfil'
import { buscarStatusIndicador } from '../../services/firestoreIndicacoes'
import { buscarPerfilUsuario, marcarTourUsuarioConcluido } from '../../services/firestoreUsers'
import { getFirebaseUid } from '../../services/identidadeFirebase'

const formatCurrency = (value) => Number(value || 0).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

const emptyStatus = {
  totalIndicacoes: 0,
  taxaSucesso: 0,
  valorRecebido: 0
}

const indicadorCards = [
  {
    icon: FaSuitcase,
    title: 'Vagas',
    description: 'Explore oportunidades de talentos e encontre o match perfeito para sua rede.',
    to: '/vagas',
    action: 'Ver Oportunidades',
    dataTour: 'indicador-card-vagas'
  },
  {
    icon: FaUserFriends,
    title: 'Candidatos',
    description: 'Inicie uma nova indicação de talento e impulsione a carreira da sua rede.',
    to: '/vagas',
    action: 'Indicar Agora',
    dataTour: 'indicador-card-candidatos'
  },
  {
    icon: FaUserTie,
    title: 'Perfil',
    description: 'Personalize sua bio e gerencie seus dados para manter sua autoridade.',
    to: '/painel/indicador?secao=perfil',
    action: 'Meu Perfil',
    dataTour: 'indicador-card-perfil'
  },
  {
    icon: FaChartBar,
    title: 'Dashboard',
    description: 'Acompanhe status, ganhos e o impacto de cada indicação em tempo real.',
    to: '/painel/indicador',
    action: 'Acompanhar',
    dataTour: 'indicador-card-dashboard'
  },
  {
    icon: FaMoneyBillWave,
    title: 'Financeiro',
    description: 'Veja seu saldo, movimentações e solicite saques manuais.',
    to: '/painel/indicador?secao=financeiro',
    action: 'Abrir Carteira',
    dataTour: 'indicador-card-financeiro'
  }
]

const indicadorTourSteps = [
  {
    title: 'Bem-vindo ao painel do indicador',
    description: 'Aqui você acompanha suas indicações, entrevistas e recompensas.'
  },
  {
    selector: '[data-tour="indicador-sidebar"]',
    align: 'start',
    title: 'Menu lateral',
    description: 'Use o menu lateral para navegar entre candidatos, entrevistas, financeiro e perfil.'
  },
  {
    selector: '[data-tour="indicador-card-vagas"]',
    title: 'Vagas disponíveis',
    description: 'Explore vagas abertas e escolha oportunidades compatíveis com sua rede de contatos.'
  },
  {
    selector: '[data-tour="indicador-card-candidatos"]',
    title: 'Candidatos indicados',
    description: 'Acompanhe o andamento dos candidatos que você indicou.'
  },
  {
    selector: '[data-tour="indicador-nav-candidatos"]',
    title: 'Entrevistas',
    description: 'Quando uma empresa agendar uma entrevista, ela aparecerá nesta seção.'
  },
  {
    selector: '[data-tour="indicador-card-financeiro"]',
    title: 'Financeiro',
    description: 'Veja recompensas recebidas, saldo disponível e solicitações de saque.'
  },
  {
    selector: '[data-tour="navbar-account-actions"]',
    scroll: false,
    title: 'Notificações e perfil',
    description: 'Receba alertas sobre status, entrevistas, pagamentos e acesse suas configurações.'
  }
]

function Painel() {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('indicadorUser')
    if (!storedUser) return null

    try {
      return JSON.parse(storedUser)
    } catch {
      localStorage.removeItem('indicadorUser')
      return null
    }
  })

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const activeSection = searchParams.get('secao') || 'dashboard'

  const indicadorUid = getFirebaseUid(user)
  const [status, setStatus] = useState(emptyStatus)
  const [loadingPanel, setLoadingPanel] = useState(() => Boolean(indicadorUid))

  useEffect(() => {
    if (!user) {
      navigate('/login')
    }
  }, [navigate, user])

  useEffect(() => {
    if (!indicadorUid) return

    const fetchCurrentUser = async () => {
      try {
        const perfil = await buscarPerfilUsuario(indicadorUid)
        if (!perfil) return

        setUser((currentUser) => {
          const mergedUser = {
            ...currentUser,
            ...perfil,
            id: perfil.id || indicadorUid,
            uid: indicadorUid,
            firebaseUid: indicadorUid
          }

          localStorage.setItem('indicadorUser', JSON.stringify(mergedUser))
          return mergedUser
        })
      } catch (error) {
        console.error('Erro ao buscar usuário:', error)
      } finally {
        setLoadingPanel(false)
      }
    }

    fetchCurrentUser()
  }, [indicadorUid])

  useEffect(() => {
    if (!indicadorUid) return

    const fetchStatus = async () => {
      try {
        const data = await buscarStatusIndicador(indicadorUid)
        setStatus(data)
      } catch (error) {
        console.error('Erro ao buscar status do indicador:', error)
      }
    }

    fetchStatus()
  }, [indicadorUid])

  if (!user || loadingPanel) return <PageLoader label="Carregando painel do indicador..." />

  const tourConcluido = Boolean(user.tourIndicadorConcluido || user.onboardingTour?.indicadorConcluido)

  const concluirTour = async () => {
    const atualizacao = {
      tourIndicadorConcluido: true,
      onboardingTour: {
        ...(user.onboardingTour || {}),
        indicadorConcluido: true
      }
    }

    setUser((usuarioAtual) => {
      const merged = { ...usuarioAtual, ...atualizacao }
      localStorage.setItem('indicadorUser', JSON.stringify(merged))
      return merged
    })

    await marcarTourUsuarioConcluido({ uid: indicadorUid, tipo: 'indicador' }).catch(() => {})
  }

  return (
    <DashboardLayout sidebarType="indicador" user={user}>
      {activeSection === 'configuracoes' ? (
        <ConfiguracoesConta user={user} tipo="indicador" onUserUpdate={setUser} />
      ) : activeSection === 'perfil' ? (
        <IndicadorPerfil user={user} onUserUpdate={setUser} />
      ) : activeSection === 'financeiro' ? (
        <IndicadorFinanceiro user={user} />
      ) : (
        <>
          <DashboardHeader
            eyebrow="BOAS-VINDAS - Painel Central"
            greeting="Olá,"
            name={user.nome}
            description="Gerencie suas indicações, explore novas oportunidades e acompanhe seu crescimento editorial em um só lugar."
          />

          <section className="dashboard-cards">
            {indicadorCards.map((card) => (
              <DashboardActionCard key={card.title} {...card} />
            ))}
          </section>

          <section className="dashboard-stats">
            <div>
              <span>Total de Indicações</span>
              <h2>{status?.totalIndicacoes ?? 0}</h2>
            </div>

            <div>
              <span>Taxa de Conversão</span>
              <h2 className="red">{status?.taxaSucesso ?? 0}%</h2>
            </div>

            <div>
              <span>Ganhos Totais</span>
              <h2>{formatCurrency(status?.valorRecebido ?? 0)}</h2>
            </div>
          </section>

          <Link className="dashboard-floating-btn" to="/vagas">+</Link>

          <GuidedTour
            key={`indicador-tour-${indicadorUid}`}
            active={activeSection === 'dashboard' && !tourConcluido}
            steps={indicadorTourSteps}
            storageKey={`indicador-${indicadorUid}`}
            onFinish={concluirTour}
          />
        </>
      )}
    </DashboardLayout>
  )
}

export default Painel
