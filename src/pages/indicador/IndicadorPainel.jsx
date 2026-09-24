// Objetivo do arquivo: organizar as seções do painel do indicador sem alterar
// as rotas existentes de dashboard, perfil, financeiro e configurações.

import { lazy, Suspense, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import ConfiguracoesConta from '../../components/configuracoes-conta/ConfiguracoesConta'
import DashboardLayout from '../../components/dashboard/DashboardLayout'
import PageLoader from '../../components/ui/PageLoader'
import { buscarPerfilUsuario } from '../../services/firestoreUsers'
import { getFirebaseUid } from '../../services/identidadeFirebase'
import IndicadorFinanceiro from './IndicadorFinanceiro'
import IndicadorPerfil from './IndicadorPerfil'

const IndicadorDashboard = lazy(() => import('./IndicadorDashboard'))

function Painel() {
  const { t } = useTranslation('referrer')
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
    return <PageLoader label={t('panel.loading')} />
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
          <Suspense fallback={<PageLoader label={t('panel.loadingPerformance')} compact />}>
            <IndicadorDashboard user={user} />
          </Suspense>
        </>
      )}
    </DashboardLayout>
  )
}

export default Painel
