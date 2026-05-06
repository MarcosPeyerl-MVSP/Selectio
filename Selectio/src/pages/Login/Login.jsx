import './Login.css'
import Navbar from '../../components/Navbar/Navbar/Navbar'
import Footer from '../../components/Footer/Footer'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { FaApple, FaEye, FaEyeSlash, FaGoogle, FaLock, FaUser } from 'react-icons/fa'

function Login() {
  const [form, setForm] = useState({ login: '', senha: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
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

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const requestLogin = async (url) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ login: form.login, senha: form.senha })
    })

    const data = await response.json()
    return { response, data }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!form.login || !form.senha) {
      setError('Preencha e-mail/usuario e senha.')
      return
    }

    try {
      setLoading(true)
      const indicadorLogin = await requestLogin('http://localhost:3333/indicador/login')

      if (indicadorLogin.response.ok) {
        localStorage.setItem('indicadorUser', JSON.stringify(indicadorLogin.data))
        localStorage.removeItem('empresaUser')
        navigate(redirectTo || '/painel/indicador')
        return
      }

      const empresaLogin = await requestLogin('http://localhost:3333/empresa/login')

      if (!empresaLogin.response.ok) {
        setError(empresaLogin.data.erro || 'Erro ao entrar. Verifique seus dados.')
        setLoading(false)
        return
      }

      localStorage.setItem('empresaUser', JSON.stringify(empresaLogin.data))
      localStorage.removeItem('indicadorUser')
      navigate(redirectTo || '/painel/empresa')
    } catch {
      setError('Nao foi possivel conectar ao servidor. Tente novamente.')
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
              E-mail, usuario ou CNPJ
              <div className="input-group">
                <span className="input-icon"><FaUser /></span>
                <input
                  name="login"
                  type="text"
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
              <a href="#" className="forgot-password">
                Esqueceu sua senha?
              </a>
            </label>

            {error && <p className="login-error">{error}</p>}

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar ->'}
            </button>
          </form>

          <div className="login-divider">
            <span>ou continue com</span>
          </div>

          <div className="social-login">
            <button type="button" className="google"><FaGoogle /> Google</button>
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
