// Objetivo do arquivo: renderizar a página de login da aplicação Selectio.
// A página autentica usuários dos tipos indicador e empresa, controla redirecionamento
// após login e mantém a sessão no localStorage.

import './Login.css'
import Navbar from '../../components/Navbar/Navbar/Navbar'
import Footer from '../../components/Footer/Footer'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { FaApple, FaEye, FaEyeSlash, FaGoogle, FaLock, FaUser } from 'react-icons/fa'
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth } from '../../services/firebase'
import { getFirebaseAuthErrorMessage, isFirebaseAuthError } from '../../services/authErrors'

function Login() {
  // Armazena os dados digitados no formulário de login.
  const [form, setForm] = useState({ login: '', senha: '' })

  // Armazena mensagens de erro exibidas ao usuário.
  const [error, setError] = useState('')

  // Controla o estado de carregamento durante a tentativa de autenticação.
  const [loading, setLoading] = useState(false)

  // Controla se o campo de senha será exibido como texto ou senha mascarada.
  const [showPassword, setShowPassword] = useState(false)

  // Hook usado para redirecionar o usuário após login ou quando já existe sessão.
  const navigate = useNavigate()

  // Hook usado para ler parâmetros da URL atual.
  const location = useLocation()

  // Parâmetro opcional usado para redirecionar o usuário após autenticação.
  const redirectTo = new URLSearchParams(location.search).get('redirect')

  useEffect(() => {
    // Regra de sessão: se já existir usuário indicador salvo, redireciona
    // para o destino informado ou para o painel do indicador.
    if (localStorage.getItem('indicadorUser')) {
      navigate(redirectTo || '/painel/indicador')
      return
    }

    // Regra de sessão: se já existir usuário empresa salvo, redireciona
    // para o destino informado ou para o painel da empresa.
    if (localStorage.getItem('empresaUser')) {
      navigate(redirectTo || '/painel/empresa')
    }
  }, [navigate, redirectTo])

  // Responsabilidade: atualizar o estado do formulário conforme o usuário digita.
  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  // Responsabilidade: enviar credenciais para um endpoint de login.
  // Integração: recebe a URL do endpoint e envia login e senha via POST JSON.
  const requestLogin = async (url, login, senha, firebaseUid) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ login, senha, firebaseUid })
    })

    // Converte a resposta para JSON e retorna junto com o objeto response
    // para permitir validação do status HTTP.
    const data = await response.json()
    return { response, data }
  }

  // Responsabilidade: validar o formulário e executar o fluxo de autenticação.
  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const login = form.login.trim()
    const senha = form.senha

    // Validação obrigatória: login e senha precisam estar preenchidos.
    if (!login || !senha) {
      setError('Preencha e-mail e senha.')
      return
    }

    let firebaseAuthenticated = false

    try {
      setLoading(true)

      // Firebase Auth e a primeira camada de autenticacao do login.
      const firebaseCredential = await signInWithEmailAndPassword(auth, login, senha)
      const firebaseUid = firebaseCredential.user.uid
      const firebaseEmail = firebaseCredential.user.email || login
      firebaseAuthenticated = true

      // Primeiro tenta autenticar como indicador.
      const indicadorLogin = await requestLogin('http://localhost:3333/indicador/login', firebaseEmail, senha, firebaseUid)

      if (indicadorLogin.response.ok) {
        // Regra de sessão: salva indicador autenticado e remove sessão de empresa.
        localStorage.setItem('indicadorUser', JSON.stringify(indicadorLogin.data))
        localStorage.removeItem('empresaUser')
        navigate(redirectTo || '/painel/indicador')
        return
      }

      // Caso não autentique como indicador, tenta autenticar como empresa.
      const empresaLogin = await requestLogin('http://localhost:3333/empresa/login', firebaseEmail, senha, firebaseUid)

      if (!empresaLogin.response.ok) {
        await signOut(auth)

        // Exibe erro retornado pela API ou mensagem padrão.
        setError('Conta autenticada, mas nao encontramos seu perfil local no Selectio.')
        setLoading(false)
        return
      }

      // Regra de sessão: salva empresa autenticada e remove sessão de indicador.
      localStorage.setItem('empresaUser', JSON.stringify(empresaLogin.data))
      localStorage.removeItem('indicadorUser')
      navigate(redirectTo || '/painel/empresa')
    } catch (error) {
      // Tratamento de erro para falha de conexão com o servidor.
      if (isFirebaseAuthError(error)) {
        setError(getFirebaseAuthErrorMessage(error))
      } else {
        if (firebaseAuthenticated) {
          await signOut(auth).catch(() => {})
        }

        setError('Nao foi possivel conectar ao servidor local. Verifique se o backend esta rodando em localhost:3333.')
      }

      setLoading(false)
    }
  }

  return (
    <>
      {/* Componente de navegação principal da aplicação. */}
      <Navbar />

      <main className="login-container">
        <div className="login-card">
          <h1>Entre na sua conta</h1>

          {/* Formulário principal de autenticação. */}
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

                {/* Botão para alternar visibilidade da senha. */}
                <button
                  type="button"
                  className="password-visibility"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>

              {/* Link visual de recuperação de senha, sem rota definida neste código. */}
              <a href="#" className="forgot-password">
                Esqueceu sua senha?
              </a>
            </label>

            {/* Exibe mensagens de erro de validação, autenticação ou conexão. */}
            {error && <p className="login-error">{error}</p>}

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar ->'}
            </button>
          </form>

          {/* Separador visual entre login por formulário e botões sociais. */}
          <div className="login-divider">
            <span>ou continue com</span>
          </div>

          {/* Botões sociais exibidos na interface; não há integração implementada neste código. */}
          <div className="social-login">
            <button type="button" className="google"><FaGoogle /> Google</button>
            <button type="button" className="apple"><FaApple /> Apple</button>
          </div>

          {/* Link para página de cadastro. */}
          <p className="register-link">
            Nao tem uma conta? <Link to="/cadastro">Cadastre-se</Link>
          </p>
        </div>
      </main>

      {/* Componente de rodapé da aplicação. */}
      <Footer />
    </>
  )
}

export default Login
