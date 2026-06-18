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
