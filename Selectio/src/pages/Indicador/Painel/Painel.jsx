import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Painel.css'
import Navbar from '../../../components/NavbarIndicador/Navbar'
import Footer from '../../../components/Footer/Footer'

import {
  FaUserTie,
  FaSuitcase,
  FaUserFriends,
  FaChartBar,
  FaCog,
  FaPlus,
} from 'react-icons/fa'

function Painel() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const storedUser = localStorage.getItem('indicadorUser')
    if (!storedUser) {
      navigate('/login')
      return
    }

    try {
      const parsedUser = JSON.parse(storedUser)
      setUser(parsedUser)
      setLoading(false)
    } catch (error) {
      localStorage.removeItem('indicadorUser')
      navigate('/login')
    }
  }, [navigate])

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
        console.error('Erro ao buscar usuário:', error)
      }
    }

    fetchCurrentUser()
  }, [user?.id, navigate])

  if (loading) {
    return <div className="painel-container">Carregando painel...</div>
  }

  if (!user) {
    return null
  }

  return (
    <>
      <Navbar />

      <div className="painel-container">
        {/* Sidebar */}
        <aside className="sidebar">
          <h2 className="sidebar-title">PAINEL DO INDICADOR</h2>

          <div className="sidebar-user">
            <FaUserTie />
            <div>
              <strong>{user.nome}</strong>
              <p>{user.email}</p>
            </div>
          </div>

          <nav className="sidebar-menu">
            <a href="#"><FaSuitcase /> Vagas</a>
            <a href="#"><FaUserFriends /> Candidatos</a>
            <a href="#"><FaChartBar /> Dashboard</a>
            <a href="#"><FaUserTie /> Perfil</a>
            <a href="#"><FaCog /> Configurações</a>
          </nav>

          <button className="sidebar-btn">
            <FaPlus /> Candidato
          </button>
        </aside>

        {/* Conteúdo */}
        <main className="painel-content">
          <p className="breadcrumb">BOAS-VINDAS • Painel Central</p>

          <h1>
            Olá, <span>{user.nome}</span>.
          </h1>

          <p className="subtitle">
            Gerencie suas indicações, explore novas oportunidades e acompanhe seu
            crescimento editorial em um só lugar.
          </p>

          {/* Cards */}
          <section className="cards">
            <div className="card">
              <FaSuitcase className="card-icon" />
              <h3>Vagas</h3>
              <p>
                Explore oportunidades de talentos e encontre o match perfeito
                para sua rede.
              </p>
              <a href="#">Ver Oportunidades →</a>
            </div>

            <div className="card">
              <FaUserFriends className="card-icon" />
              <h3>Candidatos</h3>
              <p>
                Inicie uma nova indicação de talento e impulsione a carreira da
                sua rede profissional.
              </p>
              <a href="#">Indicar Agora →</a>
            </div>

            <div className="card">
              <FaUserTie className="card-icon" />
              <h3>Perfil</h3>
              <p>
                Personalize sua bio e gerencie seus dados para manter sua
                autoridade como curador.
              </p>
              <a href="#">Meu Perfil →</a>
            </div>

            <div className="card">
              <FaChartBar className="card-icon" />
              <h3>Dashboard</h3>
              <p>
                Acompanhe status, ganhos e o impacto de cada uma de suas
                indicações em tempo real.
              </p>
              <a href="#">Acompanhar →</a>
            </div>
          </section>

          {/* Estatísticas */}
          <section className="stats">
            <div>
              <span>Total de Indicações</span>
              <h2>42</h2>
            </div>

            <div>
              <span>Taxa de Conversão</span>
              <h2 className="red">18%</h2>
            </div>

            <div>
              <span>Ganhos Totais</span>
              <h2>R$ 12.450</h2>
            </div>
          </section>

          <button className="floating-btn">+</button>
        </main>
      </div>

      <Footer />
    </>
  );
}

export default Painel;