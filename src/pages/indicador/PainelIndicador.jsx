import './styles/PainelIndicador.css'
import '../../components/dashboard/Dashboard.css'

import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
import { useToast } from '../../hooks/useToast'
import GuidedTour from '../../components/onboarding/GuidedTour'
import { marcarTourUsuarioConcluido } from '../../services/firestoreUsers'
import { getFirebaseUid } from '../../services/identidadeFirebase'

const painelCards = [
  {
    icon: FaBriefcase,
    titleKey: 'panel.cards.jobs.title',
    descriptionKey: 'panel.cards.jobs.description',
    to: '/vagas',
    actionKey: 'panel.cards.jobs.action',
  },
  {
    icon: FaUserFriends,
    titleKey: 'panel.cards.candidates.title',
    descriptionKey: 'panel.cards.candidates.description',
    to: '/candidatos/indicador',
    actionKey: 'panel.cards.candidates.action',
  },
  {
    icon: FaUserTie,
    titleKey: 'panel.cards.profile.title',
    descriptionKey: 'panel.cards.profile.description',
    to: '/painel/indicador/dashboard?secao=perfil',
    actionKey: 'panel.cards.profile.action',
  },
  {
    icon: FaChartBar,
    titleKey: 'panel.cards.dashboard.title',
    descriptionKey: 'panel.cards.dashboard.description',
    to: '/painel/indicador/dashboard',
    actionKey: 'panel.cards.dashboard.action',
  },
  {
    icon: FaMoneyBillWave,
    titleKey: 'panel.cards.finance.title',
    descriptionKey: 'panel.cards.finance.description',
    to: '/painel/indicador/dashboard?secao=financeiro',
    actionKey: 'panel.cards.finance.action',
  },
  {
    icon: FaCog,
    titleKey: 'panel.cards.settings.title',
    descriptionKey: 'panel.cards.settings.description',
    to: '/painel/indicador/dashboard?secao=configuracoes',
    actionKey: 'panel.cards.settings.action',
  },
]

function PainelIndicador() {
  const { t } = useTranslation(['referrer', 'common'])
  const { perfil, adotarPerfil } = useAuth()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const secaoLegada = searchParams.get('secao')
  const uid = getFirebaseUid(perfil)
  const tourConcluido = Boolean(perfil?.tourIndicadorConcluido || perfil?.onboardingTour?.indicadorConcluido)
  const steps = [
    { title: t('panel.tour.welcomeTitle'), description: t('panel.tour.welcomeDescription') },
    { selector: '[data-tour="indicador-sidebar"]', title: t('panel.tour.menuTitle'), description: t('panel.tour.menuDescription'), align: 'start' },
    ...painelCards.map((card, index) => ({
      selector: `[data-tour="indicador-atalho-${index}"]`,
      title: t(card.titleKey), description: t(card.descriptionKey)
    })),
    { selector: '[data-tour="navbar-account-actions"]', title: t('panel.tour.accountTitle'), description: t('panel.tour.accountDescription'), scroll: false }
  ]

  const concluirTour = async () => {
    adotarPerfil({ ...perfil, tourIndicadorConcluido: true,
      onboardingTour: { ...perfil.onboardingTour, indicadorConcluido: true } })
    try { await marcarTourUsuarioConcluido({ uid, tipo: 'indicador' }) }
    catch { toast.warning(t('common:accountSettings.tourSessionOnly')) }
  }

  if (secaoLegada) {
    return <Navigate to={`/painel/indicador/dashboard?secao=${encodeURIComponent(secaoLegada)}`} replace />
  }

  return (
    <DashboardLayout sidebarType="indicador" user={perfil}>
      <section className="indicador-central-panel">
        <DashboardHeader
          eyebrow={t('panel.eyebrow')}
          greeting={t('panel.greeting')}
          name={perfil?.nome || perfil?.nomeCompleto || t('panel.defaultName')}
          description={t('panel.description')}
        />

        <section className="dashboard-cards" aria-label={t('panel.shortcuts')}>
          {painelCards.map((card, index) => (
            <DashboardActionCard
              key={card.titleKey}
              {...card}
              dataTour={`indicador-atalho-${index}`}
              title={t(card.titleKey)}
              description={t(card.descriptionKey)}
              action={t(card.actionKey)}
            />
          ))}
        </section>

        <Link
          className="dashboard-floating-btn"
          to="/candidatos/indicador/novo"
          aria-label={t('panel.registerCandidate')}
          title={t('panel.registerCandidate')}
        >
          <FaPlus aria-hidden="true" />
        </Link>
      </section>
      <GuidedTour active={Boolean(uid) && !tourConcluido} steps={steps}
        storageKey={`indicador-${uid}`} onFinish={concluirTour} />
    </DashboardLayout>
  )
}

export default PainelIndicador
