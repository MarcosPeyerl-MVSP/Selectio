// Objetivo do arquivo: organizar as seções do painel do indicador sem alterar
// as rotas existentes de dashboard, perfil, financeiro e configurações.

import { lazy, Suspense, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import ConfiguracoesConta from '../../components/configuracoes-conta/ConfiguracoesConta'
import DashboardLayout from '../../components/dashboard/DashboardLayout'
import GuidedTour from '../../components/onboarding/GuidedTour'
import PageLoader from '../../components/ui/PageLoader'
import { buscarPerfilUsuario, marcarTourUsuarioConcluido } from '../../services/firestoreUsers'
import { getFirebaseUid } from '../../services/identidadeFirebase'
import IndicadorFinanceiro from './IndicadorFinanceiro'
import IndicadorPerfil from './IndicadorPerfil'

const IndicadorDashboard = lazy(() => import('./IndicadorDashboard'))

const indicadorTourSteps = [
  {
    title: 'Seu desempenho em um só lugar',
    description: 'Este dashboard reúne indicações, conversões, contratações e recompensas.',
  },
  {
    selector: '[data-tour="indicador-sidebar"]',
    align: 'start',
    title: 'Menu lateral',
    description: 'Use o menu para acessar vagas, candidatos, perfil, financeiro e configurações.',
  },
  {
    selector: '[data-tour="indicador-dashboard-metricas"]',
    title: 'Métricas principais',
    description: 'Veja rapidamente o volume da sua rede, processos ativos e pagamentos aprovados.',
  },
  {
    selector: '[data-tour="indicador-dashboard-recentes"]',
    title: 'Pipeline recente',
    description: 'Acompanhe os últimos talentos indicados e a etapa atual de cada processo.',
  },
  {
    selector: '[data-tour="indicador-dashboard-grafico"]',
    title: 'Evolução financeira',
    description: 'Os ganhos aprovados são agrupados por mês para mostrar a evolução das recompensas.',
  },
  {
    selector: '[data-tour="navbar-account-actions"]',
    scroll: false,
    title: 'Notificações e perfil',
    description: 'Receba alertas sobre processos e pagamentos ou acesse as configurações da conta.',
  },
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
            firebaseUid: indicadorUid,
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

  if (!user || loadingPanel) {
    return <PageLoader label="Carregando painel do indicador..." />
  }

  const tourConcluido = Boolean(
    user.tourIndicadorConcluido || user.onboardingTour?.indicadorConcluido,
  )

  const concluirTour = async () => {
    const atualizacao = {
      tourIndicadorConcluido: true,
      onboardingTour: {
        ...(user.onboardingTour || {}),
        indicadorConcluido: true,
      },
    }

    setUser((usuarioAtual) => {
      const merged = { ...usuarioAtual, ...atualizacao }
      localStorage.setItem('indicadorUser', JSON.stringify(merged))
      return merged
    })

    await marcarTourUsuarioConcluido({
      uid: indicadorUid,
      tipo: 'indicador',
    }).catch(() => {})
  }

  return (
    <DashboardLayout
      sidebarType="indicador"
      user={user}
      contentClassName={activeSection === 'dashboard' ? 'dashboard-content--performance' : ''}
    >
      {activeSection === 'configuracoes' ? (
        <ConfiguracoesConta user={user} tipo="indicador" onUserUpdate={setUser} />
      ) : activeSection === 'perfil' ? (
        <IndicadorPerfil user={user} onUserUpdate={setUser} />
      ) : activeSection === 'financeiro' ? (
        <IndicadorFinanceiro user={user} />
      ) : (
        <>
          <Suspense fallback={<PageLoader label="Carregando indicadores de performance..." compact />}>
            <IndicadorDashboard user={user} />
          </Suspense>

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
