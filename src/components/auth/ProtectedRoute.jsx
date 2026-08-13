import { Navigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../../hooks/useAuth'
import PageLoader from '../ui/PageLoader'

function ProtectedRoute({ children, tipo }) {
  const { t } = useTranslation('common')
  const location = useLocation()
  const {
    firebaseUser,
    perfil,
    carregando,
    carregandoPerfil
  } = useAuth()

  if (carregando || carregandoPerfil) {
    return <PageLoader label={t('loading.session')} />
  }

  if (!firebaseUser) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }

  if (!perfil) {
    return <Navigate to="/login" replace />
  }

  if (tipo && perfil.tipo !== tipo) {
    return <Navigate to={getPainelPath(perfil.tipo)} replace />
  }

  return children
}

function getPainelPath(tipo) {
  if (tipo === 'admin') return '/admin/visao-geral'
  if (tipo === 'empresa') return '/painel/empresa'
  if (tipo === 'indicador') return '/painel/indicador'
  return '/login'
}

export default ProtectedRoute
