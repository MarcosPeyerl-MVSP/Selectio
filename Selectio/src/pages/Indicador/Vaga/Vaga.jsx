// Objetivo do arquivo: renderizar a página de detalhes de uma vaga.
// A página identifica o perfil autenticado, busca a vaga no Firestore,
// redireciona usuários públicos para login e exibe ações diferentes para empresa e indicador.

import './Vaga.css'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Navbar from '../../../components/Navbar/Navbar/Navbar'
import Sidebar from '../../../components/Sidebar/Sidebar'
import Footer from '../../../components/Footer/Footer'
import {
  FaRegClock,
  FaCheck,
  FaEdit,
} from 'react-icons/fa'
import { buscarVagaPorId } from '../../../services/firestoreVagas'
import { getFirebaseUid } from '../../../services/firebaseIdentity'

// Responsabilidade: identificar o perfil atual com base nos dados salvos no localStorage.
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
  // Identificador da vaga recebido pela rota.
  const { id } = useParams()

  // Armazena os dados da vaga carregada.
  const [vaga, setVaga] = useState(null)

  // Controla o estado de carregamento da busca da vaga.
  const [loading, setLoading] = useState(true)

  // Armazena mensagem de erro quando a vaga não é encontrada.
  const [error, setError] = useState(null)

  // Guarda o perfil do usuário atual para definir acesso, layout e ações.
  const [perfil] = useState(getPerfil)

  useEffect(() => {
    // Responsabilidade: buscar os detalhes da vaga no Firestore.
    const fetchVaga = async () => {
      if (perfil.tipo === 'publico') return

      try {
        const data = await buscarVagaPorId(id)
        if (!data) {
          throw new Error('Vaga não encontrada')
        }
        setVaga(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchVaga()
  }, [id, perfil])

  // Regra de acesso: usuário público precisa fazer login antes de ver a vaga.
  if (perfil.tipo === 'publico') {
    return <Navigate to={`/login?redirect=/vaga/${id}`} replace />
  }

  // Estado visual enquanto a vaga está sendo carregada.
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

  // Estado visual quando ocorre erro ou a vaga não existe.
  if (error || !vaga) {
    return (
      <>
        <Navbar />
        <main className="vaga-detail-content">
          <div className="not-found-message">
            <h2>Vaga não encontrada</h2>
            <p>Verifique se a vaga existe ou retorne à lista de vagas.</p>
            <Link to={perfil.vagasPath}>Voltar à lista</Link>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  // Desestrutura os campos da vaga usados na interface.
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

  // Regras de normalização: benefícios e requisitos podem chegar como array ou JSON serializado.
  const beneficiosArray = Array.isArray(beneficios) ? beneficios : JSON.parse(beneficios || '[]')
  const requisitosArray = Array.isArray(requisitos) ? requisitos : JSON.parse(requisitos || '[]')
  const isOwnCompanyJob = perfil.tipo === 'empresa'
    && String(vaga.empresaId || vaga.empresaUid || '') === String(getFirebaseUid(perfil.user))

  return (
    <>
      {/* Componente de navegação principal. */}
      <Navbar />

      <div className={`vaga-detail-page ${perfil.tipo === 'publico' ? 'public-layout' : ''}`}>
        {/* Menu lateral exibido para usuários autenticados. */}
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
              {/* Bloco principal com resumo da vaga. */}
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

              {/* Descrição detalhada da função. */}
              <section className="section-block">
                <h2>Descrição da Função</h2>
                <p>{descricaoLonga}</p>
              </section>

              {/* Lista de requisitos da vaga. */}
              <section className="section-block">
                <h2>Requisitos e Qualificações</h2>
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
              {perfil.tipo === 'empresa' && isOwnCompanyJob ? (
                // Ação exibida para usuário empresa gerenciar a vaga.
                <div className="edit-vaga-card">
                  <span className="tag edit-tag">MINHA VAGA</span>
                  <strong>Gerenciar vaga</strong>
                  <p>
                    Atualize as informações, requisitos, benefícios e recompensa desta oportunidade.
                  </p>
                  <Link className="btn-primary" to={`/editar-vaga/empresa/${id}`}>
                    <FaEdit /> Editar vaga
                  </Link>
                </div>
              ) : (
                // Ação exibida para indicador iniciar uma indicação para a vaga.
                <div className="reward-card">
                  <span className="tag reward-tag">RECOMPENSA POR INDICAÇÃO</span>
                  <strong>{recompensa}</strong>
                  <p>
                    {perfil.tipo === 'indicador'
                      ? 'Indique um profissional qualificado. Se ele for contratado, voce recebe o premio direto na sua conta.'
                      : 'Esta vaga foi publicada por outra empresa e esta disponivel apenas para visualizacao.'}
                  </p>
                  {perfil.tipo === 'indicador' && (
                    <Link className="btn-primary" to={`/indicar/${id}`}>Fazer Indicação</Link>
                  )}
                </div>
              )}

              {/* Lista de benefícios da vaga. */}
              <div className="benefits-card">
                <h3>Benefícios</h3>
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

      {/* Componente de rodapé. */}
      <Footer />
    </>
  )
}

export default Vaga
