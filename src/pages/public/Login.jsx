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
import { getFirebaseAuthErrorMessage, isFirebaseAuthError } from '../../services/errosAutenticacao'
import { buscarPerfilUsuario } from '../../services/firestoreUsers'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../hooks/useAuth'
import {
  hashSenhaSetor,
  obterHashSenhaSetor,
  obterSetorEmpresarial,
  perfilExigeSetorEmpresarial,
  perfilTemSetorEmpresarial,
  setoresEmpresariais
} from '../../utils/modoEmpresarial'

function Login() {
  const [form, setForm] = useState({ login: '', senha: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [pendingPerfilEmpresarial, setPendingPerfilEmpresarial] = useState(null)
  const [setorForm, setSetorForm] = useState({
    setorId: setoresEmpresariais[0].id,
    senha: ''
  })
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const { perfil: perfilSessao, carregando: carregandoSessao, adotarPerfil } = useAuth()
  const redirectTo = new URLSearchParams(location.search).get('redirect')

  useEffect(() => {
    if (carregandoSessao || !perfilSessao) return

    if (perfilSessao.tipo === 'indicador') {
      navigate(redirectTo || '/painel/indicador', { replace: true })
    } else if (perfilSessao.tipo === 'empresa') {
      navigate(redirectTo || '/painel/empresa', { replace: true })
    } else if (perfilSessao.tipo === 'admin') {
      navigate(redirectTo || '/admin/visao-geral', { replace: true })
    }
  }, [carregandoSessao, navigate, perfilSessao, redirectTo])

  const showError = (message) => {
    setError(message)
    toast.error(message)
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const storeProfileAndNavigate = (perfil) => {
    if (perfilExigeSetorEmpresarial(perfil) && !perfilTemSetorEmpresarial(perfil)) {
      setPendingPerfilEmpresarial(perfil)
      setSetorForm({
        setorId: setoresEmpresariais[0].id,
        senha: ''
      })
      setLoading(false)
      toast.info('Login validado. Agora escolha o setor empresarial.')
      return true
    }

    adotarPerfil(perfil)

    if (perfil.tipo === 'indicador') {
      toast.success('Login realizado com sucesso.')
      navigate(redirectTo || '/painel/indicador')
      return true
    }

    if (perfil.tipo === 'empresa') {
      toast.success('Login realizado com sucesso.')
      navigate(redirectTo || '/painel/empresa')
      return true
    }

    if (perfil.tipo === 'admin') {
      toast.success('Acesso administrativo validado.')
      navigate(redirectTo || '/admin/visao-geral')
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
        showError('Sua conta existe no Firebase, mas ainda não possui perfil no Selectio.')
        setLoading(false)
        return
      }

      if (!storeProfileAndNavigate(perfil)) {
        await signOut(auth)
        showError('Perfil de usuário inválido. Entre em contato com o suporte da Selectio.')
        setLoading(false)
      }
    } catch (error) {
      if (isFirebaseAuthError(error)) {
        showError(getFirebaseAuthErrorMessage(error))
      } else {
        if (firebaseAuthenticated) {
          await signOut(auth).catch(() => {})
        }

        showError('Não foi possível buscar seu perfil no Firestore. Verifique sua conexão e tente novamente.')
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
        const message = 'Esta conta Google ainda não possui perfil no Selectio. Conclua o cadastro primeiro.'
        setError(message)
        toast.warning(message)
        setLoading(false)
        return
      }

      if (!storeProfileAndNavigate(perfil)) {
        await signOut(auth)
        showError('Perfil de usuário inválido. Entre em contato com o suporte da Selectio.')
        setLoading(false)
      }
    } catch (error) {
      if (isFirebaseAuthError(error)) {
        showError(getFirebaseAuthErrorMessage(error))
      } else {
        showError('Não foi possível entrar com Google. Verifique sua conexão e tente novamente.')
      }

      setLoading(false)
    }
  }

  const handleSetorSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!pendingPerfilEmpresarial) return

    if (!setorForm.senha.trim()) {
      const message = 'Informe a senha do setor selecionado.'
      setError(message)
      toast.warning(message)
      return
    }

    const setor = obterSetorEmpresarial(setorForm.setorId)
    const senhaHashSalva = obterHashSenhaSetor(pendingPerfilEmpresarial, setorForm.setorId)
    const senhaHashDigitada = await hashSenhaSetor(setorForm.senha, pendingPerfilEmpresarial.firebaseUid || pendingPerfilEmpresarial.uid)

    if (!setor || !senhaHashSalva || senhaHashDigitada !== senhaHashSalva) {
      const message = 'Senha do setor incorreta.'
      setError(message)
      toast.error(message)
      return
    }

    const perfilComSetor = {
      ...pendingPerfilEmpresarial,
      setorEmpresarial: {
        id: setor.id,
        nome: setor.nome,
        acessadoEm: new Date().toISOString()
      }
    }

    setPendingPerfilEmpresarial(null)
    setSetorForm({ setorId: setoresEmpresariais[0].id, senha: '' })
    adotarPerfil(perfilComSetor)
    toast.success(`Acesso liberado para ${setor.nome}.`)
    navigate(redirectTo || '/painel/empresa')
  }

  const handleCancelarSetor = async () => {
    await signOut(auth).catch(() => {})
    setPendingPerfilEmpresarial(null)
    setSetorForm({ setorId: setoresEmpresariais[0].id, senha: '' })
    setLoading(false)
  }

  const handlePasswordReset = async () => {
    setError('')
    setSuccess('')

    const email = form.login.trim()

    if (!email) {
      const message = 'Informe seu e-mail para receber o link de redefinição.'
      setError(message)
      toast.warning(message)
      return
    }

    try {
      setLoading(true)
      await sendPasswordResetEmail(auth, email)
      const message = 'Se este e-mail estiver cadastrado, enviaremos um link de redefinição.'
      setSuccess(message)
      toast.success(message)
    } catch (error) {
      if (isFirebaseAuthError(error)) {
        showError(getFirebaseAuthErrorMessage(error))
      } else {
        showError('Não foi possível solicitar a redefinição agora. Verifique sua conexão e tente novamente.')
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
          <h1>{pendingPerfilEmpresarial ? 'Escolha o setor' : 'Entre na sua conta'}</h1>

          {pendingPerfilEmpresarial ? (
            <form className="login-form setor-login-form" onSubmit={handleSetorSubmit}>
              <p className="setor-login-copy">
                Selecione o setor empresarial e informe a senha definida pelo Administrador Empresa.
              </p>

              <label>
                Setor
                <select
                  value={setorForm.setorId}
                  onChange={(event) => setSetorForm((current) => ({
                    ...current,
                    setorId: event.target.value,
                    senha: ''
                  }))}
                >
                  {setoresEmpresariais.map((setor) => (
                    <option key={setor.id} value={setor.id}>{setor.nome}</option>
                  ))}
                </select>
              </label>

              <label>
                Senha do setor
                <div className="input-group">
                  <span className="input-icon"><FaLock /></span>
                  <input
                    type="password"
                    placeholder="Senha do setor"
                    value={setorForm.senha}
                    onChange={(event) => setSetorForm((current) => ({
                      ...current,
                      senha: event.target.value
                    }))}
                  />
                </div>
              </label>

              {error && <p className="login-error">{error}</p>}

              <button type="submit" className="login-button">
                Acessar setor
              </button>
              <button type="button" className="sector-cancel-button" onClick={handleCancelarSetor}>
                Trocar conta
              </button>
            </form>
          ) : (
            <>

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
            Não tem uma conta? <Link to="/cadastro">Cadastre-se</Link>
          </p>
            </>
          )}
        </div>
      </main>

      <Footer />
    </>
  )
}

export default Login
