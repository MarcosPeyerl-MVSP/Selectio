import { useCallback, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'

import { auth } from '../../services/firebase'
import { buscarPerfilUsuario } from '../../services/firestoreUsers'
import { AuthContext } from './authContext'

const limparPerfilLocal = () => {
  localStorage.removeItem('empresaUser')
  localStorage.removeItem('indicadorUser')
  localStorage.removeItem('adminUser')
}

const salvarPerfilLocal = (perfil) => {
  limparPerfilLocal()

  if (perfil?.tipo === 'empresa') {
    localStorage.setItem('empresaUser', JSON.stringify(perfil))
  }

  if (perfil?.tipo === 'indicador') {
    localStorage.setItem('indicadorUser', JSON.stringify(perfil))
  }

  if (perfil?.tipo === 'admin') {
    localStorage.setItem('adminUser', JSON.stringify(perfil))
  }
}

function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(auth.currentUser)
  const [perfil, setPerfil] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [carregandoPerfil, setCarregandoPerfil] = useState(false)

  const adotarPerfil = useCallback((novoPerfil) => {
    setPerfil(novoPerfil || null)

    if (novoPerfil) {
      salvarPerfilLocal(novoPerfil)
    } else {
      limparPerfilLocal()
    }
  }, [])

  const recarregarPerfil = useCallback(async () => {
    const usuarioAtual = auth.currentUser

    if (!usuarioAtual) {
      adotarPerfil(null)
      return null
    }

    setCarregandoPerfil(true)

    try {
      const perfilAtual = await buscarPerfilUsuario(usuarioAtual.uid)

      if (auth.currentUser?.uid === usuarioAtual.uid) {
        adotarPerfil(perfilAtual)
      }

      return perfilAtual
    } finally {
      setCarregandoPerfil(false)
    }
  }, [adotarPerfil])

  useEffect(() => onAuthStateChanged(auth, async (usuarioAtual) => {
    setFirebaseUser(usuarioAtual)

    if (!usuarioAtual) {
      adotarPerfil(null)
      setCarregando(false)
      return
    }

    setCarregandoPerfil(true)

    try {
      const perfilAtual = await buscarPerfilUsuario(usuarioAtual.uid)

      if (auth.currentUser?.uid === usuarioAtual.uid) {
        adotarPerfil(perfilAtual)
      }
    } catch {
      if (auth.currentUser?.uid === usuarioAtual.uid) {
        adotarPerfil(null)
      }
    } finally {
      setCarregandoPerfil(false)
      setCarregando(false)
    }
  }), [adotarPerfil])

  const value = useMemo(() => ({
    firebaseUser,
    perfil,
    carregando,
    carregandoPerfil,
    adotarPerfil,
    recarregarPerfil
  }), [
    firebaseUser,
    perfil,
    carregando,
    carregandoPerfil,
    adotarPerfil,
    recarregarPerfil
  ])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthProvider
