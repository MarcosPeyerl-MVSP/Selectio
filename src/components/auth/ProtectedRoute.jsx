import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import PageLoader from '../ui/PageLoader'

function ProtectedRoute({ children, tipo }) {
  const location = useLocation()
  const {
    firebaseUser,
    perfil,
    carregando,
    carregandoPerfil
  } = useAuth()

  if (carregando || carregandoPerfil) {
    return <PageLoader label="Validando sua sessão..." />
  }

  if (!firebaseUser) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }

  if (!perfil) {
    return <Navigate to="/login" replace />
  }

  if (tipo && perfil.tipo !== tipo) {
    const painel = perfil.tipo === 'empresa'
      ? '/painel/empresa'
      : '/painel/indicador'

    return <Navigate to={painel} replace />
  }

  return children
}

export default ProtectedRoute
