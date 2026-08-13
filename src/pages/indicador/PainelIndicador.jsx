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
  const { t } = useTranslation('referrer')
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
          eyebrow={t('panel.eyebrow')}
          greeting={t('panel.greeting')}
          name={perfil?.nome || perfil?.nomeCompleto || t('panel.defaultName')}
          description={t('panel.description')}
        />

        <section className="dashboard-cards" aria-label={t('panel.shortcuts')}>
          {painelCards.map((card) => (
            <DashboardActionCard
              key={card.titleKey}
              {...card}
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
    </DashboardLayout>
  )
}

export default PainelIndicador
