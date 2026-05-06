import './Vaga.css'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Navbar from '../../../components/Navbar/Navbar/Navbar'
import Sidebar from '../../../components/Sidebar/Sidebar'
import Footer from '../../../components/Footer/Footer'
import {
  FaRegClock,
  FaCheck,
} from 'react-icons/fa'

const getPerfil = () => {
  const indicador = localStorage.getItem('indicadorUser')
  const empresa = localStorage.getItem('empresaUser')

  if (indicador) {
    const user = JSON.parse(indicador)
    return {
      tipo: 'indicador',
      user,
      vagasPath: '/vagas',
      painelPath: '/painel/indicador'
    }
  }

  if (empresa) {
    const user = JSON.parse(empresa)
    return {
      tipo: 'empresa',
      user,
      vagasPath: '/vagas',
      painelPath: '/painel/empresa'
    }
  }

  return {
    tipo: 'publico',
    user: null,
    vagasPath: '/vagas',
    painelPath: '/login'
  }
}

function Vaga() {
  const { id } = useParams()
  const [vaga, setVaga] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [perfil] = useState(getPerfil)

  useEffect(() => {
    const fetchVaga = async () => {
      if (perfil.tipo === 'publico') return

      try {
        const response = await fetch(`http://localhost:3333/vagas/${id}`)
        if (!response.ok) {
          throw new Error('Vaga nao encontrada')
        }
        const data = await response.json()
        setVaga(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchVaga()
  }, [id, perfil])

  if (perfil.tipo === 'publico') {
    return <Navigate to={`/login?redirect=/vaga/${id}`} replace />
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="vaga-detail-content">
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p>Carregando vaga...</p>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  if (error || !vaga) {
    return (
      <>
        <Navbar />
        <main className="vaga-detail-content">
          <div className="not-found-message">
            <h2>Vaga nao encontrada</h2>
            <p>Verifique se a vaga existe ou retorne a lista de vagas.</p>
            <Link to={perfil.vagasPath}>Voltar a lista</Link>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  const {
    titulo,
    empresa,
    localizacao,
    salario,
    tipo,
    recompensa,
    descricaoCurta,
    descricaoLonga,
    beneficios,
    requisitos,
    imagem,
  } = vaga

  const beneficiosArray = Array.isArray(beneficios) ? beneficios : JSON.parse(beneficios || '[]')
  const requisitosArray = Array.isArray(requisitos) ? requisitos : JSON.parse(requisitos || '[]')

  return (
    <>
      <Navbar />

      <div className={`vaga-detail-page ${perfil.tipo === 'publico' ? 'public-layout' : ''}`}>
        {perfil.tipo !== 'publico' && (
          <Sidebar type={perfil.tipo} user={perfil.user} />
        )}

        <main className="vaga-detail-content">
          <div className="page-header">
            <Link className="back-link" to={perfil.vagasPath}>
              <FaRegClock /> Voltar para listagem de vagas
            </Link>
            <span className="tag status">ABERTA</span>
          </div>

          <div className="detail-grid">
            <section className="detail-main">
              <div className="vaga-card-top">
                <div>
                  <h1>{titulo}</h1>
                  <div className="vaga-tags">
                    <span>{empresa}</span>
                    <span>{localizacao}</span>
                    <span>{salario}</span>
                    <span>{tipo}</span>
                  </div>
                </div>
                <p className="vaga-intro">{descricaoCurta}</p>
              </div>

              <div className="vaga-image">
                <img src={imagem} alt={titulo} />
              </div>

              <section className="section-block">
                <h2>Descricao da Funcao</h2>
                <p>{descricaoLonga}</p>
              </section>

              <section className="section-block">
                <h2>Requisitos e Qualificacoes</h2>
                <ul>
                  {requisitosArray.map((item) => (
                    <li key={item}>
                      <FaCheck /> {item}
                    </li>
                  ))}
                </ul>
              </section>
            </section>

            <aside className="detail-aside">
              <div className="reward-card">
                <span className="tag reward-tag">RECOMPENSA POR INDICACAO</span>
                <strong>{recompensa}</strong>
                <p>
                  Indique um profissional qualificado. Se ele for contratado, voce recebe o premio direto na sua conta.
                </p>
                {perfil.tipo === 'indicador' ? (
                  <button className="btn-primary">Fazer Indicacao</button>
                ) : (
                  <Link className="btn-primary" to={`/login?redirect=/vaga/${id}`}>
                    Fazer Indicacao
                  </Link>
                )}
              </div>

              <div className="benefits-card">
                <h3>Beneficios</h3>
                <div className="benefits-grid">
                  {beneficiosArray.map((beneficio) => (
                    <div key={beneficio}>
                      <FaCheck />
                      <span>{beneficio}</span>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </main>
      </div>

      <Footer />
    </>
  )
}

export default Vaga
