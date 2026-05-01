import './Login.css'
import Navbar from '../../components/Navbar/Navbar'
import Footer from '../../components/Footer/Footer'
import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { FaEnvelope, FaLock, FaGoogle, FaApple, FaUser } from 'react-icons/fa'

function Login() {
  const [form, setForm] = useState({ login: '', senha: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const storedUser = localStorage.getItem('indicadorUser')
    if (storedUser) {
      navigate('/painel/indicador')
    }
  }, [navigate])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!form.login || !form.senha) {
      setError('Preencha e-mail/usuário e senha.')
      return
    }

    try {
      setLoading(true)
      const response = await fetch('http://localhost:3333/indicador/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ login: form.login, senha: form.senha })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.erro || 'Erro ao entrar. Verifique seus dados.')
        setLoading(false)
        return
      }

      localStorage.setItem('indicadorUser', JSON.stringify(data))
      navigate('/painel/indicador')
    } catch (err) {
      setError('Não foi possível conectar ao servidor. Tente novamente.')
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
              E-mail ou usuário
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
                  type="password"
                  placeholder="••••••••"
                  value={form.senha}
                  onChange={handleChange}
                />
              </div>
              <a href="#" className="forgot-password">
                Esqueceu sua senha?
              </a>
            </label>

            {error && <p className="login-error">{error}</p>}

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? 'Entrando…' : 'Entrar →'}
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
            Não tem uma conta? <Link to={'/cadastro'}>Cadastre-se</Link>
          </p>
        </div>
      </main>

      <Footer />
    </>
  )
}

export default Login

