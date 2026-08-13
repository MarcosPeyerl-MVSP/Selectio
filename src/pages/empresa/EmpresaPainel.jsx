// Objetivo do arquivo: renderizar o painel central da empresa.
// A pagina valida a sessão da empresa e exibe secoes internas de dashboard,
// perfil, configuracoes e entrevistas.

import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
    copyKey: 'myJobs',
    to: '/criar-vaga/empresa',
    dataTour: 'empresa-card-vagas'
  },
  {
    icon: FaUserFriends,
    copyKey: 'candidates',
    to: '/candidatos/empresa',
    dataTour: 'empresa-card-candidatos'
  },
  {
    icon: FaUserTie,
    copyKey: 'profile',
    to: '/painel/empresa?secao=perfil',
    dataTour: 'empresa-card-perfil'
  },
  {
    icon: FaChartBar,
    copyKey: 'dashboard',
    to: '/painel/empresa',
    dataTour: 'empresa-card-dashboard'
  },
  {
    icon: FaCalendarAlt,
    copyKey: 'interviews',
    to: '/painel/empresa?secao=entrevistas',
    dataTour: 'empresa-card-entrevistas'
  },
  {
    icon: FaCreditCard,
    copyKey: 'payments',
    to: '/painel/empresa?secao=pagamentos',
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
        copyKey: 'requestJob',
        to: '/criar-vaga/empresa',
        dataTour: 'empresa-card-vagas'
      },
      {
        icon: FaClipboardCheck,
        copyKey: 'myRequests',
        to: '/painel/empresa?secao=aprovacoes',
      }
    ],
    [SETOR_REITORIA_AUDITORIA]: [
      {
        icon: FaClipboardCheck,
        copyKey: 'reviewRequests',
        to: '/painel/empresa?secao=aprovacoes',
        dataTour: 'empresa-card-vagas'
      },
      {
        icon: FaChartBar,
        copyKey: 'requestsDashboard',
        to: '/painel/empresa',
      }
    ],
    [SETOR_RH]: [
      {
        icon: FaClipboardCheck,
        copyKey: 'publishApproved',
        to: '/painel/empresa?secao=aprovacoes',
        dataTour: 'empresa-card-vagas'
      },
      {
        icon: FaUserFriends,
        copyKey: 'hrCandidates',
        to: '/candidatos/empresa',
        dataTour: 'empresa-card-candidatos'
      },
      {
        icon: FaCalendarAlt,
        copyKey: 'hrInterviews',
        to: '/painel/empresa?secao=entrevistas',
      },
      {
        icon: FaCreditCard,
        copyKey: 'hrPayments',
        to: '/painel/empresa?secao=pagamentos',
      }
    ],
    [SETOR_ADMIN_EMPRESA]: [
      {
        icon: FaUsersCog,
        copyKey: 'sectors',
        to: '/painel/empresa?secao=setores',
        dataTour: 'empresa-card-perfil'
      },
      {
        icon: FaClipboardCheck,
        copyKey: 'jobFlow',
        to: '/painel/empresa?secao=aprovacoes',
        dataTour: 'empresa-card-vagas'
      },
      {
        icon: FaChartBar,
        copyKey: 'generalDashboard',
        to: '/painel/empresa',
        dataTour: 'empresa-card-dashboard'
      }
    ]
  }

  return [
    ...(cardsBySetor[setorId] || cardsBySetor[SETOR_ADMIN_EMPRESA]),
    {
      icon: FaUserTie,
      copyKey: 'companyProfile',
      to: '/painel/empresa?secao=perfil',
      dataTour: 'empresa-card-perfil'
    }
  ]
}

const getEmpresaTourSteps = (t) => [
  {
    title: t('panel.tour.welcomeTitle'),
    description: t('panel.tour.welcomeDescription')
  },
  {
    selector: '[data-tour="empresa-sidebar"]',
    align: 'start',
    title: t('panel.tour.menuTitle'),
    description: t('panel.tour.menuDescription')
  },
  {
    selector: '[data-tour="empresa-card-vagas"]',
    title: t('panel.tour.jobsTitle'),
    description: t('panel.tour.jobsDescription')
  },
  {
    selector: '[data-tour="empresa-card-candidatos"]',
    title: t('panel.tour.candidatesTitle'),
    description: t('panel.tour.candidatesDescription')
  },
  {
    selector: '[data-tour="empresa-card-entrevistas"]',
    title: t('panel.tour.interviewsTitle'),
    description: t('panel.tour.interviewsDescription')
  },
  {
    selector: '[data-tour="empresa-card-pagamentos"]',
    title: t('panel.tour.paymentsTitle'),
    description: t('panel.tour.paymentsDescription')
  },
  {
    selector: '[data-tour="navbar-account-actions"]',
    scroll: false,
    title: t('panel.tour.accountTitle'),
    description: t('panel.tour.accountDescription')
  }
]

function PainelEmpresa() {
  const { t } = useTranslation(['company', 'auth'])
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

  if (!empresa || !perfilCarregado) return <PageLoader label={t('panel.loading')} />

  const tourConcluido = Boolean(empresa.tourEmpresaConcluido || empresa.onboardingTour?.empresaConcluido)
  const modoEmpresarialAtivo = isModoEmpresarial(empresa)
  const setorAtual = obterSetorAtual(empresa)
  const cards = getEmpresaCards(empresa)
  const setorLabel = setorAtual
    ? t(`auth:sectors.${setorAtual.id}`, { defaultValue: setorAtual.nome })
    : t('panel.defaultSector')
  const dashboardDescription = modoEmpresarialAtivo && setorAtual
    ? t('panel.enterpriseDescription', { sector: setorLabel })
    : t('panel.description')

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
            eyebrow={modoEmpresarialAtivo
              ? t('panel.enterpriseEyebrow', { sector: setorLabel })
              : t('panel.eyebrow')}
            greeting={t('panel.greeting')}
            name={empresa.nomeEmpresa}
            description={dashboardDescription}
          />

          <section className="dashboard-cards">
            {cards.map((card) => (
              <DashboardActionCard
                key={`${card.to}-${card.copyKey}`}
                {...card}
                title={t(`panel.cards.${card.copyKey}.title`)}
                description={t(`panel.cards.${card.copyKey}.description`)}
                action={t(`panel.cards.${card.copyKey}.action`)}
              />
            ))}
          </section>

          {(!modoEmpresarialAtivo || setorAtual?.id === SETOR_CHEFE_DEPARTAMENTO) && (
            <Link className="dashboard-floating-btn" to="/criar-vaga/empresa">+</Link>
          )}

          <GuidedTour
            key={`empresa-tour-${empresaUid}`}
            active={activeSection === 'dashboard' && !tourConcluido}
            steps={getEmpresaTourSteps(t)}
            storageKey={`empresa-${empresaUid}`}
            onFinish={concluirTour}
          />
        </>
      )}
    </DashboardLayout>
  )
}

export default PainelEmpresa
