import './Login.css'
import Navbar from '../../components/Navbar/Navbar'
import Footer from '../../components/Footer/Footer'
import { Link } from 'react-router-dom'

function Login() {
  return (
    <>
      <Navbar />

      <main className="login-container">
        <div className="login-card">
          <h1>Entre na sua conta</h1>

          <form className="login-form">
            <label>
              E-mail ou usuário
              <input
                type="text"
                placeholder="seu@email.com"
              />
            </label>

            <label>
              Senha
              <input
                type="password"
                placeholder="••••••••"
              />
              <a href="#" className="forgot-password">
                Esqueceu sua senha?
              </a>
            </label>

            <button type="submit" className="login-button">
              Entrar →
            </button>
          </form>

          <div className="login-divider">
            <span>ou continue com</span>
          </div>

          <div className="social-login">
            <button className="google">Google</button>
            <button className="apple">Apple</button>
          </div>

          <p className="register-link">
            Não tem uma conta? <Link to={"/cadastro"}>Cadastre-se</Link>
          </p>
        </div>
      </main>

      <Footer />
    </>
  )
}

export default Login

