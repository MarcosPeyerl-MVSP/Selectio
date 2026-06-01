// Objetivo do arquivo: renderizar o painel central do indicador.
// A pagina valida a sessão do indicador, atualiza dados, busca metricas
// e exibe as secoes internas de dashboard, perfil e configuracoes.

import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FaChartBar, FaMoneyBillWave, FaSuitcase, FaUserFriends, FaUserTie } from 'react-icons/fa'

import AccountSettings from '../../components/AccountSettings/AccountSettings'
import DashboardActionCard from '../../components/dashboard/DashboardActionCard'
import DashboardHeader from '../../components/dashboard/DashboardHeader'
import DashboardLayout from '../../components/dashboard/DashboardLayout'
import PageLoader from '../../components/ui/PageLoader'
import IndicadorFinanceiro from './IndicadorFinanceiro'
import IndicadorPerfil from './IndicadorPerfil'
import { buscarStatusIndicador } from '../../services/firestoreIndicacoes'
import { buscarPerfilUsuario } from '../../services/firestoreUsers'
import { getFirebaseUid } from '../../services/firebaseIdentity'

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
    action: 'Ver Oportunidades'
  },
  {
    icon: FaUserFriends,
    title: 'Candidatos',
    description: 'Inicie uma nova indicação de talento e impulsione a carreira da sua rede.',
    to: '/vagas',
    action: 'Indicar Agora'
  },
  {
    icon: FaUserTie,
    title: 'Perfil',
    description: 'Personalize sua bio e gerencie seus dados para manter sua autoridade.',
    to: '/painel/indicador?secao=perfil',
    action: 'Meu Perfil'
  },
  {
    icon: FaChartBar,
    title: 'Dashboard',
    description: 'Acompanhe status, ganhos e o impacto de cada indicação em tempo real.',
    to: '/painel/indicador',
    action: 'Acompanhar'
  },
  {
    icon: FaMoneyBillWave,
    title: 'Financeiro',
    description: 'Veja seu saldo, movimentações e solicite saques manuais.',
    to: '/painel/indicador?secao=financeiro',
    action: 'Abrir Carteira'
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

  return (
    <DashboardLayout sidebarType="indicador" user={user}>
      {activeSection === 'configuracoes' ? (
        <AccountSettings user={user} tipo="indicador" onUserUpdate={setUser} />
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
        </>
      )}
    </DashboardLayout>
  )
}

export default Painel
