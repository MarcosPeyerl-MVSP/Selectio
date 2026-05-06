import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './Painel.css'
import Navbar from '../../../components/Navbar/NavbarIndicador/Navbar'
import Sidebar from '../../../components/Sidebar/Sidebar'
import Footer from '../../../components/Footer/Footer'
import { FaChartBar, FaSuitcase, FaUserFriends, FaUserTie } from 'react-icons/fa'

function Painel() {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('indicadorUser')
    if (!storedUser) return null

    try {
      return JSON.parse(storedUser)
    } catch {
      localStorage.removeItem('indicadorUser')
      return null
    }
  })
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) {
      navigate('/login')
    }
  }, [navigate, user])

  useEffect(() => {
    if (!user?.id) return

    const fetchCurrentUser = async () => {
      try {
        const response = await fetch(`http://localhost:3333/indicador/${user.id}`)
        if (!response.ok) {
          localStorage.removeItem('indicadorUser')
          navigate('/login')
          return
        }

        const data = await response.json()
        setUser(data)
        localStorage.setItem('indicadorUser', JSON.stringify(data))
      } catch (error) {
        console.error('Erro ao buscar usuario:', error)
      }
    }

    fetchCurrentUser()
  }, [user?.id, navigate])

  if (!user) return null

  return (
    <>
      <Navbar />

      <div className="painel-container">
        <Sidebar type="indicador" user={user} />

        <main className="painel-content">
          <p className="breadcrumb">BOAS-VINDAS - Painel Central</p>

          <h1>
            Ola, <span>{user.nome}</span>.
          </h1>

          <p className="subtitle">
            Gerencie suas indicacoes, explore novas oportunidades e acompanhe seu
            crescimento editorial em um so lugar.
          </p>

          <section className="cards">
            <div className="card">
              <FaSuitcase className="card-icon" />
              <h3>Vagas</h3>
              <p>Explore oportunidades de talentos e encontre o match perfeito para sua rede.</p>
              <Link to="/vagas">Ver Oportunidades {'->'}</Link>
            </div>

            <div className="card">
              <FaUserFriends className="card-icon" />
              <h3>Candidatos</h3>
              <p>Inicie uma nova indicacao de talento e impulsione a carreira da sua rede.</p>
              <Link to="/vagas">Indicar Agora {'->'}</Link>
            </div>

            <div className="card">
              <FaUserTie className="card-icon" />
              <h3>Perfil</h3>
              <p>Personalize sua bio e gerencie seus dados para manter sua autoridade.</p>
              <Link to="/painel/indicador">Meu Perfil {'->'}</Link>
            </div>

            <div className="card">
              <FaChartBar className="card-icon" />
              <h3>Dashboard</h3>
              <p>Acompanhe status, ganhos e o impacto de cada indicacao em tempo real.</p>
              <Link to="/painel/indicador">Acompanhar {'->'}</Link>
            </div>
          </section>

          <section className="stats">
            <div>
              <span>Total de Indicacoes</span>
              <h2>42</h2>
            </div>

            <div>
              <span>Taxa de Conversao</span>
              <h2 className="red">18%</h2>
            </div>

            <div>
              <span>Ganhos Totais</span>
              <h2>R$ 12.450</h2>
            </div>
          </section>

          <Link className="floating-btn" to="/vagas">+</Link>
        </main>
      </div>

      <Footer />
    </>
  )
}

export default Painel
