import './Login.css'

import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FaApple, FaEye, FaEyeSlash, FaGoogle, FaLock, FaUser } from 'react-icons/fa'
import {
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from 'firebase/auth'

import Navbar from '../../components/layout/Navbar'
import Footer from '../../components/layout/Footer'
import { auth } from '../../services/firebase'
import { getFirebaseAuthErrorMessage, isFirebaseAuthError } from '../../services/authErrors'
import { buscarPerfilUsuario } from '../../services/firestoreUsers'
import { useToast } from '../../hooks/useToast'

function Login() {
  const [form, setForm] = useState({ login: '', senha: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const redirectTo = new URLSearchParams(location.search).get('redirect')

  useEffect(() => {
    if (localStorage.getItem('indicadorUser')) {
      navigate(redirectTo || '/painel/indicador')
      return
    }

    if (localStorage.getItem('empresaUser')) {
      navigate(redirectTo || '/painel/empresa')
    }
  }, [navigate, redirectTo])

  const showError = (message) => {
    setError(message)
    toast.error(message)
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const storeProfileAndNavigate = (perfil) => {
    if (perfil.tipo === 'indicador') {
      localStorage.setItem('indicadorUser', JSON.stringify(perfil))
      localStorage.removeItem('empresaUser')
      toast.success('Login realizado com sucesso.')
      navigate(redirectTo || '/painel/indicador')
      return true
    }

    if (perfil.tipo === 'empresa') {
      localStorage.setItem('empresaUser', JSON.stringify(perfil))
      localStorage.removeItem('indicadorUser')
      toast.success('Login realizado com sucesso.')
      navigate(redirectTo || '/painel/empresa')
      return true
    }

    return false
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    const login = form.login.trim()
    const senha = form.senha

    if (!login || !senha) {
      const message = 'Preencha e-mail e senha.'
      setError(message)
      toast.warning(message)
      return
    }

    let firebaseAuthenticated = false

    try {
      setLoading(true)

      const firebaseCredential = await signInWithEmailAndPassword(auth, login, senha)
      const firebaseUid = firebaseCredential.user.uid
      firebaseAuthenticated = true
      const perfil = await buscarPerfilUsuario(firebaseUid)

      if (!perfil) {
        await signOut(auth)
        showError('Sua conta existe no Firebase, mas ainda nao possui perfil no Selectio.')
        setLoading(false)
        return
      }

      if (!storeProfileAndNavigate(perfil)) {
        await signOut(auth)
        showError('Perfil de usuario invalido. Entre em contato com o suporte da Selectio.')
        setLoading(false)
      }
    } catch (error) {
      if (isFirebaseAuthError(error)) {
        showError(getFirebaseAuthErrorMessage(error))
      } else {
        if (firebaseAuthenticated) {
          await signOut(auth).catch(() => {})
        }

        showError('Nao foi possivel buscar seu perfil no Firestore. Verifique sua conexao e tente novamente.')
      }

      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError('')
    setSuccess('')

    try {
      setLoading(true)

      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })

      const firebaseCredential = await signInWithPopup(auth, provider)
      const perfil = await buscarPerfilUsuario(firebaseCredential.user.uid)

      if (!perfil) {
        await signOut(auth)
        const message = 'Esta conta Google ainda nao possui perfil no Selectio. Conclua o cadastro primeiro.'
        setError(message)
        toast.warning(message)
        setLoading(false)
        return
      }

      if (!storeProfileAndNavigate(perfil)) {
        await signOut(auth)
        showError('Perfil de usuario invalido. Entre em contato com o suporte da Selectio.')
        setLoading(false)
      }
    } catch (error) {
      if (isFirebaseAuthError(error)) {
        showError(getFirebaseAuthErrorMessage(error))
      } else {
        showError('Nao foi possivel entrar com Google. Verifique sua conexao e tente novamente.')
      }

      setLoading(false)
    }
  }

  const handlePasswordReset = async () => {
    setError('')
    setSuccess('')

    const email = form.login.trim()

    if (!email) {
      const message = 'Informe seu e-mail para receber o link de redefinicao.'
      setError(message)
      toast.warning(message)
      return
    }

    try {
      setLoading(true)
      await sendPasswordResetEmail(auth, email)
      const message = 'Se este e-mail estiver cadastrado, enviaremos um link de redefinicao.'
      setSuccess(message)
      toast.success(message)
    } catch (error) {
      if (isFirebaseAuthError(error)) {
        showError(getFirebaseAuthErrorMessage(error))
      } else {
        showError('Nao foi possivel solicitar a redefinicao agora. Verifique sua conexao e tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Navbar />

      <main className="login-container">
        <div className="login-card">
          <h1>Entre na sua conta</h1>

          <form className="login-form" onSubmit={handleSubmit}>
            <label>
              E-mail
              <div className="input-group">
                <span className="input-icon"><FaUser /></span>
                <input
                  name="login"
                  type="email"
                  placeholder="seu@email.com"
                  value={form.login}
                  onChange={handleChange}
                />
              </div>
            </label>

            <label>
              Senha
              <div className="input-group">
                <span className="input-icon"><FaLock /></span>
                <input
                  name="senha"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="********"
                  value={form.senha}
                  onChange={handleChange}
                />

                <button
                  type="button"
                  className="password-visibility"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>

              <button
                type="button"
                className="forgot-password"
                onClick={handlePasswordReset}
                disabled={loading}
              >
                Esqueceu sua senha?
              </button>
            </label>

            {error && <p className="login-error">{error}</p>}
            {success && <p className="login-success">{success}</p>}

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar ->'}
            </button>
          </form>

          <div className="login-divider">
            <span>ou continue com</span>
          </div>

          <div className="social-login">
            <button type="button" className="google" onClick={handleGoogleLogin} disabled={loading}>
              <FaGoogle /> Google
            </button>
            <button type="button" className="apple"><FaApple /> Apple</button>
          </div>

          <p className="register-link">
            Nao tem uma conta? <Link to="/cadastro">Cadastre-se</Link>
          </p>
        </div>
      </main>

      <Footer />
    </>
  )
}

export default Login
