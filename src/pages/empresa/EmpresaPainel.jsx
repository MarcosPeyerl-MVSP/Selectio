// Objetivo do arquivo: renderizar o painel central da empresa.
// A pagina valida a sessão da empresa e exibe secoes internas de dashboard,
// perfil, configuracoes e entrevistas.

import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  FaCalendarAlt,
  FaChartBar,
  FaClipboardCheck,
  FaCreditCard,
  FaSuitcase,
  FaUsersCog,
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
import { EmpresaFluxoEmpresarial, EmpresaSetoresEmpresariais } from './EmpresaModoEmpresarial'
import EmpresaPagamentos from './EmpresaPagamentos'
import EmpresaPerfil from './EmpresaPerfil'
import { getFirebaseUid } from '../../services/identidadeFirebase'
import { buscarPerfilUsuario, marcarTourUsuarioConcluido } from '../../services/firestoreUsers'
import {
  SETOR_ADMIN_EMPRESA,
  SETOR_CHEFE_DEPARTAMENTO,
  SETOR_REITORIA_AUDITORIA,
  SETOR_RH,
  isModoEmpresarial,
  obterSetorAtual
} from '../../utils/modoEmpresarial'

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

const getEmpresaCards = (empresa) => {
  if (!isModoEmpresarial(empresa)) return empresaCards

  const setorId = empresa?.setorEmpresarial?.id
  const cardsBySetor = {
    [SETOR_CHEFE_DEPARTAMENTO]: [
      {
        icon: FaSuitcase,
        title: 'Solicitar vaga',
        description: 'Preencha o pedido da vaga para que Reitoria ou Auditoria avalie a parte financeira.',
        to: '/criar-vaga/empresa',
        action: 'Nova solicitacao',
        dataTour: 'empresa-card-vagas'
      },
      {
        icon: FaClipboardCheck,
        title: 'Minhas solicitacoes',
        description: 'Acompanhe vagas enviadas, devolvidas e aprovadas no fluxo empresarial.',
        to: '/painel/empresa?secao=aprovacoes',
        action: 'Acompanhar'
      }
    ],
    [SETOR_REITORIA_AUDITORIA]: [
      {
        icon: FaClipboardCheck,
        title: 'Pedidos para analise',
        description: 'Revise salario, premiacao e comentarios antes de liberar a vaga para o RH.',
        to: '/painel/empresa?secao=aprovacoes',
        action: 'Analisar pedidos',
        dataTour: 'empresa-card-vagas'
      },
      {
        icon: FaChartBar,
        title: 'Dashboard',
        description: 'Veja a visao geral das solicitacoes e do fluxo da empresa.',
        to: '/painel/empresa',
        action: 'Acompanhar'
      }
    ],
    [SETOR_RH]: [
      {
        icon: FaClipboardCheck,
        title: 'Publicar aprovadas',
        description: 'Receba vagas aprovadas pela auditoria e publique para os indicadores.',
        to: '/painel/empresa?secao=aprovacoes',
        action: 'Ver aprovadas',
        dataTour: 'empresa-card-vagas'
      },
      {
        icon: FaUserFriends,
        title: 'Candidatos',
        description: 'Administre os candidatos das vagas publicadas pelo RH.',
        to: '/candidatos/empresa',
        action: 'Ver Candidatos',
        dataTour: 'empresa-card-candidatos'
      },
      {
        icon: FaCalendarAlt,
        title: 'Entrevistas',
        description: 'Organize entrevistas e acompanhe agendamentos com candidatos.',
        to: '/painel/empresa?secao=entrevistas',
        action: 'Minhas Entrevistas'
      },
      {
        icon: FaCreditCard,
        title: 'Pagamentos',
        description: 'Acompanhe recompensas pagas aos indicadores por contratacoes.',
        to: '/painel/empresa?secao=pagamentos',
        action: 'Ver Pagamentos'
      }
    ],
    [SETOR_ADMIN_EMPRESA]: [
      {
        icon: FaUsersCog,
        title: 'Setores',
        description: 'Acompanhe setores e redefina senhas de acesso do modo empresarial.',
        to: '/painel/empresa?secao=setores',
        action: 'Gerenciar setores',
        dataTour: 'empresa-card-perfil'
      },
      {
        icon: FaClipboardCheck,
        title: 'Fluxo de vagas',
        description: 'Observe pedidos, aprovacoes, devolucoes e publicacoes do RH.',
        to: '/painel/empresa?secao=aprovacoes',
        action: 'Ver fluxo',
        dataTour: 'empresa-card-vagas'
      },
      {
        icon: FaChartBar,
        title: 'Dashboard',
        description: 'Acompanhe o funcionamento geral da empresa no Selectio.',
        to: '/painel/empresa',
        action: 'Acompanhar',
        dataTour: 'empresa-card-dashboard'
      }
    ]
  }

  return [
    ...(cardsBySetor[setorId] || cardsBySetor[SETOR_ADMIN_EMPRESA]),
    {
      icon: FaUserTie,
      title: 'Perfil',
      description: 'Consulte dados da empresa e configuracoes do perfil.',
      to: '/painel/empresa?secao=perfil',
      action: 'Meu Perfil',
      dataTour: 'empresa-card-perfil'
    }
  ]
}

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
    const handleSetorAlterado = (event) => {
      if (event.detail?.tipo === 'empresa') setEmpresa(event.detail)
    }

    window.addEventListener('selectio:empresa-setor-alterado', handleSetorAlterado)
    return () => window.removeEventListener('selectio:empresa-setor-alterado', handleSetorAlterado)
  }, [])

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
            setorEmpresarial: empresaAtual?.setorEmpresarial || perfil.setorEmpresarial,
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
  const modoEmpresarialAtivo = isModoEmpresarial(empresa)
  const setorAtual = obterSetorAtual(empresa)
  const cards = getEmpresaCards(empresa)
  const dashboardDescription = modoEmpresarialAtivo && setorAtual
    ? `Voce esta acessando o setor ${setorAtual.nome}. Use o painel para acompanhar as tarefas desse setor no fluxo empresarial.`
    : "Gerencie suas vagas, explore novas oportunidades e acompanhe seu crescimento em um sÃ³ lugar."

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
      ) : activeSection === 'aprovacoes' ? (
        <EmpresaFluxoEmpresarial empresa={empresa} />
      ) : activeSection === 'setores' ? (
        <EmpresaSetoresEmpresariais empresa={empresa} onUserUpdate={setEmpresa} />
      ) : (
        <>
          <DashboardHeader
            eyebrow={modoEmpresarialAtivo ? `MODO EMPRESARIAL - ${setorAtual?.nome || 'Setor'}` : "BOAS-VINDAS - Painel Central"}
            greeting="Bem-vinda,"
            name={empresa.nomeEmpresa}
            description={dashboardDescription}
          />

          <section className="dashboard-cards">
            {cards.map((card) => (
              <DashboardActionCard key={card.title} {...card} />
            ))}
          </section>

          {(!modoEmpresarialAtivo || setorAtual?.id === SETOR_CHEFE_DEPARTAMENTO) && (
            <Link className="dashboard-floating-btn" to="/criar-vaga/empresa">+</Link>
          )}

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
