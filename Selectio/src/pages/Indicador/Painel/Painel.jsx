// Objetivo do arquivo: renderizar o painel central do indicador.
// A página valida a sessão do indicador, atualiza os dados do usuário,
// busca indicadores de status e exibe atalhos e métricas principais.

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './Painel.css'
import Navbar from '../../../components/Navbar/Navbar/Navbar'
import Sidebar from '../../../components/Sidebar/Sidebar'
import Footer from '../../../components/Footer/Footer'
import { FaChartBar, FaSuitcase, FaUserFriends, FaUserTie } from 'react-icons/fa'
import { buscarStatusIndicador } from '../../../services/firestoreIndicacoes'
import { buscarPerfilUsuario } from '../../../services/firestoreUsers'
import { getFirebaseUid } from '../../../services/legacyIds'

// Responsabilidade: formatar valores numéricos como moeda brasileira.
const formatCurrency = (value) => Number(value || 0).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

const emptyStatus = {
  totalIndicacoes: 0,
  taxaSucesso: 0,
  valorRecebido: 0
}

function Painel() {
  // Recupera o indicador autenticado salvo no localStorage ao iniciar o componente.
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('indicadorUser')
    if (!storedUser) return null

    try {
      return JSON.parse(storedUser)
    } catch {
      // Fluxo de segurança: remove a sessão caso o JSON salvo esteja inválido.
      localStorage.removeItem('indicadorUser')
      return null
    }
  })

  // Hook usado para redirecionar o usuário quando não há sessão válida.
  const navigate = useNavigate()

  // Armazena os dados estatísticos do indicador.
  const [status, setStatus] = useState(emptyStatus)
  const indicadorUid = getFirebaseUid(user)

  useEffect(() => {
    // Regra de acesso: sem indicador autenticado, redireciona para login.
    if (!user) {
      navigate('/login')
    }
  }, [navigate, user])

  useEffect(() => {
    if (!indicadorUid) return

    // Responsabilidade: buscar os dados atualizados do indicador autenticado.
    const fetchCurrentUser = async () => {
      try {
        const perfil = await buscarPerfilUsuario(indicadorUid)
        if (!perfil) return

        setUser((currentUser) => {
          const mergedUser = {
            ...currentUser,
            ...perfil,
            id: perfil.id || indicadorUid,
            uid: indicadorUid,
            firebaseUid: indicadorUid
          }

          localStorage.setItem('indicadorUser', JSON.stringify(mergedUser))
          return mergedUser
        })
      } catch (error) {
        console.error('Erro ao buscar usuário:', error)
      }
    }

    fetchCurrentUser()
  }, [indicadorUid])

  useEffect(() => {
    if (!indicadorUid) return

    // Responsabilidade: buscar as métricas do painel do indicador.
    const fetchStatus = async () => {
      try {
        const data = await buscarStatusIndicador(indicadorUid)
        setStatus(data)
      } catch (error) {
        console.error('Erro ao buscar status do indicador:', error)
      }
    }

    fetchStatus()
  }, [indicadorUid])

  // Evita renderizar o painel enquanto não há usuário autenticado.
  if (!user) return null

  return (
    <>
      {/* Componente de navegação principal. */}
      <Navbar />

      <div className="painel-container">
        {/* Menu lateral do painel do indicador. */}
        <Sidebar type="indicador" user={user} />

        <main className="painel-content">
          <p className="breadcrumb">BOAS-VINDAS - Painel Central</p>

          <h1>
            Olá, <span>{user.nome}</span>.
          </h1>

          <p className="subtitle">
            Gerencie suas indicações, explore novas oportunidades e acompanhe seu
            crescimento editorial em um só lugar.
          </p>

          {/* Cards de atalho para áreas principais do painel. */}
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
              <p>Inicie uma nova indicação de talento e impulsione a carreira da sua rede.</p>
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
              <p>Acompanhe status, ganhos e o impacto de cada indicação em tempo real.</p>
              <Link to="/painel/indicador">Acompanhar {'->'}</Link>
            </div>
          </section>

          {/* Métricas resumidas do indicador. */}
          <section className="stats">
            <div>
              <span>Total de Indicações</span>
              <h2>{status?.totalIndicacoes ?? 0}</h2>
            </div>

            <div>
              <span>Taxa de Conversão</span>
              <h2 className="red">{status?.taxaSucesso ?? 0}%</h2>
            </div>

            <div>
              <span>Ganhos Totais</span>
              <h2>{formatCurrency(status?.valorRecebido ?? 0)}</h2>
            </div>
          </section>

          {/* Atalho flutuante para a listagem de vagas. */}
          <Link className="floating-btn" to="/vagas">+</Link>
        </main>
      </div>

      {/* Componente de rodapé. */}
      <Footer />
    </>
  )
}

export default Painel
