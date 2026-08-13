// Objetivo do arquivo: renderizar a página de detalhes de uma vaga.
// A página identifica o perfil autenticado, busca a vaga no Firestore,
// redireciona usuários públicos para login e exibe ações diferentes para empresa e indicador.

import './VagaDetalhe.css'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  vagaAceitaIndicacoes,
} from '../../services/firestoreVagas'
import { getFirebaseUid } from '../../services/identidadeFirebase'
import { useAuth } from '../../hooks/useAuth'
import { formatJobReward, formatJobSalary, formatJobType } from '../../i18n/domainFormatters'

function Vaga() {
  const { t, i18n } = useTranslation(['public', 'common'])
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
          throw new Error('job-not-found')
        }
        setVaga(data)
      } catch {
        setError(t('jobDetail.loadError'))
      } finally {
        setLoading(false)
      }
    }

    fetchVaga()
  }, [id, perfil.tipo, reloadKey, t])

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
          <PageLoader label={t('jobDetail.loading')} />
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
            actionLabel={t('jobDetail.retry')}
            description={t('jobDetail.errorDescription')}
            onAction={tentarNovamente}
            title={navigator.onLine ? t('jobDetail.loadError') : t('jobDetail.offline')}
            tone={navigator.onLine ? 'error' : 'offline'}
          />
          <Link className="detail-return-link" to={vagasPath}>{t('jobDetail.backToList')}</Link>
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
              <FaRegClock /> {t('jobDetail.backToListing')}
            </Link>
            <span className={`tag status status-${vaga.status}`}>
              {t(`common:statuses.jobs.${vaga.status}`, { defaultValue: vaga.status })}
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
                    <span>{formatJobSalary(vaga, t)}</span>
                    <span>{formatJobType(vaga, t)}</span>
                  </div>
                </div>
                <p className="vaga-intro">{descricaoCurta}</p>
              </div>

              <div className="vaga-image">
                <img src={imagem} alt={titulo} />
              </div>

              {/* Descrição detalhada da função. */}
              <section className="section-block">
                <h2>{t('jobDetail.roleDescription')}</h2>
                <p>{descricaoLonga}</p>
              </section>

              {/* Lista de requisitos da vaga. */}
              <section className="section-block">
                <h2>{t('jobDetail.requirements')}</h2>
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
                  <span className="tag edit-tag">{t('jobDetail.myJob')}</span>
                  <strong>{t('jobDetail.manageJob')}</strong>
                  <p>{t('jobDetail.manageDescription')}</p>
                  <Link className="btn-primary" to={`/editar-vaga/empresa/${id}`}>
                    <FaEdit /> {t('jobDetail.editJob')}
                  </Link>
                </div>
              ) : (
                // Ação exibida para indicador iniciar uma indicação para a vaga.
                <div className="reward-card">
                  <span className="tag reward-tag">{t('jobDetail.referralReward')}</span>
                  <strong>{formatJobReward(vaga, t)}</strong>
                  <p>
                    {perfil.tipo === 'indicador'
                      ? t('jobDetail.referrerDescription')
                      : t('jobDetail.companyDescription')}
                  </p>
                  {perfil.tipo === 'indicador' && aceitaIndicacoes && (
                    <Link
                      className="btn-primary"
                      to={`/indicar/${id}${candidatoPreSalvoId
                        ? `?candidatoPreSalvoId=${encodeURIComponent(candidatoPreSalvoId)}`
                        : ''}`}
                    >
                      {t('jobDetail.refer')}
                    </Link>
                  )}
                  {perfil.tipo === 'indicador' && !aceitaIndicacoes && (
                    <div className="indication-unavailable" role="status">
                      {t('jobDetail.unavailable', {
                        status: t(`common:statuses.jobs.${vaga.status}`, {
                          defaultValue: t('common:statuses.jobs.indisponivel')
                        }).toLocaleLowerCase(i18n.resolvedLanguage || i18n.language)
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Lista de benefícios da vaga. */}
              <div className="benefits-card">
                <h3>{t('jobDetail.benefits')}</h3>
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
