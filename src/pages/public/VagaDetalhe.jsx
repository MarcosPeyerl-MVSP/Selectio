// Objetivo do arquivo: renderizar a página de detalhes de uma vaga.
// A página identifica o perfil autenticado, busca a vaga no Firestore,
// redireciona usuários públicos para login e exibe ações diferentes para empresa e indicador.

import './VagaDetalhe.css'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Navbar from '../../components/layout/Navbar'
import Sidebar from '../../components/layout/Sidebar'
import Footer from '../../components/layout/Footer'
import EstadoDados from '../../components/ui/EstadoDados'
import PageLoader from '../../components/ui/PageLoader'
import {
  FaRegClock,
  FaCheck,
  FaEdit,
} from 'react-icons/fa'
import {
  buscarVagaPorId,
  statusVagaLabels,
  vagaAceitaIndicacoes,
} from '../../services/firestoreVagas'
import { getFirebaseUid } from '../../services/identidadeFirebase'
import { useAuth } from '../../hooks/useAuth'

function Vaga() {
  // Identificador da vaga recebido pela rota.
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const candidatoPreSalvoId = searchParams.get('candidatoPreSalvoId') || ''

  // Armazena os dados da vaga carregada.
  const [vaga, setVaga] = useState(null)

  // Controla o estado de carregamento da busca da vaga.
  const [loading, setLoading] = useState(true)

  // Armazena mensagem de erro quando a vaga não é encontrada.
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Guarda o perfil do usuário atual para definir acesso, layout e ações.
  const { perfil: usuario } = useAuth()
  const perfil = {
    tipo: usuario?.tipo || 'publico',
    user: usuario,
    vagasPath: '/vagas',
    painelPath: usuario?.tipo === 'empresa' ? '/painel/empresa' : '/painel/indicador'
  }
  const vagasPath = candidatoPreSalvoId
    ? `${perfil.vagasPath}?candidatoPreSalvoId=${encodeURIComponent(candidatoPreSalvoId)}`
    : perfil.vagasPath

  useEffect(() => {
    // Responsabilidade: buscar os detalhes da vaga no Firestore.
    const fetchVaga = async () => {
      if (perfil.tipo === 'publico') return

      try {
        setError(null)
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
  }, [id, perfil.tipo, reloadKey])

  const tentarNovamente = () => {
    setLoading(true)
    setReloadKey((value) => value + 1)
  }

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
          <PageLoader label="Carregando vaga..." />
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
          <EstadoDados
            actionLabel="Tentar novamente"
            description={error || 'Verifique se a vaga existe ou retorne à lista de vagas.'}
            onAction={tentarNovamente}
            title={navigator.onLine ? 'Não foi possível carregar a vaga' : 'Você está sem conexão'}
            tone={navigator.onLine ? 'error' : 'offline'}
          />
          <Link className="detail-return-link" to={vagasPath}>Voltar à lista de vagas</Link>
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
  const aceitaIndicacoes = vagaAceitaIndicacoes(vaga)

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
            <Link className="back-link" to={vagasPath}>
              <FaRegClock /> Voltar para listagem de vagas
            </Link>
            <span className={`tag status status-${vaga.status}`}>
              {statusVagaLabels[vaga.status] || vaga.status}
            </span>
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
                      ? 'Indique um profissional qualificado. Se ele for contratado, você recebe o prêmio direto na sua conta.'
                      : 'Esta vaga foi publicada por outra empresa e está disponível apenas para visualização.'}
                  </p>
                  {perfil.tipo === 'indicador' && aceitaIndicacoes && (
                    <Link
                      className="btn-primary"
                      to={`/indicar/${id}${candidatoPreSalvoId
                        ? `?candidatoPreSalvoId=${encodeURIComponent(candidatoPreSalvoId)}`
                        : ''}`}
                    >
                      Fazer Indicação
                    </Link>
                  )}
                  {perfil.tipo === 'indicador' && !aceitaIndicacoes && (
                    <div className="indication-unavailable" role="status">
                      Esta vaga está {statusVagaLabels[vaga.status]?.toLowerCase() || 'indisponível'} e não recebe novas indicações.
                    </div>
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
