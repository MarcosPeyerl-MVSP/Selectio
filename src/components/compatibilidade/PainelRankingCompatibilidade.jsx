import './PainelRankingCompatibilidade.css'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  FaBrain,
  FaCheckCircle,
  FaChevronDown,
  FaExclamationTriangle,
  FaFileAlt,
  FaMinusCircle,
  FaQuestionCircle,
  FaSyncAlt,
  FaTimesCircle
} from 'react-icons/fa'
import { listarVagasPorEmpresa } from '../../services/firestoreVagas'
import {
  listarAnalisesPorEmpresa,
  salvarAnaliseCompatibilidade
} from '../../services/firestoreCompatibilidade'
import {
  analisarCurriculoDoCandidato,
  encerrarAnalisadorCurriculos
} from '../../services/compatibilidade/analiseCurriculoCliente'
import { useToast } from '../../hooks/useToast'
import { ANALISE_VERSAO } from '../../services/compatibilidade/motorCompatibilidade'

const ICONE_RESULTADO = {
  atende: FaCheckCircle,
  atende_parcialmente: FaExclamationTriangle,
  nao_atende: FaTimesCircle,
  nao_comprovado: FaQuestionCircle,
  nao_aplicavel: FaMinusCircle
}

function PainelRankingCompatibilidade({ candidatos, empresaId }) {
  const { t } = useTranslation('company')
  const toast = useToast()
  const [aberto, setAberto] = useState(false)
  const [vagas, setVagas] = useState([])
  const [analises, setAnalises] = useState([])
  const [vagaId, setVagaId] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [analisando, setAnalisando] = useState(false)
  const [candidatoAtual, setCandidatoAtual] = useState('')
  const [progresso, setProgresso] = useState({ valor: 0, detalhe: '' })
  const [falhas, setFalhas] = useState([])
  const [detalheAberto, setDetalheAberto] = useState('')

  useEffect(() => () => encerrarAnalisadorCurriculos(), [])

  useEffect(() => {
    if (!aberto || !empresaId) return
    let ativo = true
    const carregar = async () => {
      setCarregando(true)
      try {
        const [vagasData, analisesData] = await Promise.all([
          listarVagasPorEmpresa(empresaId),
          listarAnalisesPorEmpresa(empresaId)
        ])
        if (!ativo) return
        const idsComCandidatos = new Set(candidatos.map((candidato) => candidato.vagaId))
        const vagasFiltradas = vagasData.filter((vaga) => idsComCandidatos.has(vaga.id))
        setVagas(vagasFiltradas)
        setAnalises(analisesData)
        setVagaId((atual) => atual || vagasFiltradas[0]?.id || '')
      } catch (error) {
        console.error('Falha ao carregar ranking de compatibilidade:', error)
        toast.error(t('compatibility.loadError'))
      } finally {
        if (ativo) setCarregando(false)
      }
    }
    carregar()
    return () => { ativo = false }
  }, [aberto, candidatos, empresaId, t, toast])

  const vaga = useMemo(() => vagas.find((item) => item.id === vagaId), [vagaId, vagas])
  const candidatosDaVaga = useMemo(() => candidatos.filter((item) => item.vagaId === vagaId), [candidatos, vagaId])
  const analisesPorCandidato = useMemo(() => new Map(
    analises.filter((analise) => analise.vagaId === vagaId)
      .map((analise) => [analise.candidatoId, analise])
  ), [analises, vagaId])
  const ranking = useMemo(() => candidatosDaVaga
    .map((candidato) => ({ candidato, analise: analisesPorCandidato.get(candidato.id) }))
    .sort((a, b) => Number(b.analise?.nota ?? -1) - Number(a.analise?.nota ?? -1)), [analisesPorCandidato, candidatosDaVaga])

  const executarAnalises = async () => {
    if (!vaga?.rubricaCompatibilidade?.ativa || analisando) return
    setAnalisando(true)
    setFalhas([])
    const novasFalhas = []
    let concluidas = 0

    for (const candidato of candidatosDaVaga) {
      setCandidatoAtual(candidato.id)
      setProgresso({ valor: Math.round((concluidas / candidatosDaVaga.length) * 100), detalhe: candidato.nome })
      try {
        const resultado = await analisarCurriculoDoCandidato({
          candidato,
          vaga,
          onProgress: (mensagem) => setProgresso({
            valor: Math.round(((concluidas + mensagem.progresso / 100) / candidatosDaVaga.length) * 100),
            detalhe: `${candidato.nome}: ${mensagem.detalhe || mensagem.etapa}`
          })
        })
        await salvarAnaliseCompatibilidade({ candidato, vaga, empresaId, resultado })
        const agora = new Date().toISOString()
        const analiseSalva = {
          ...resultado,
          id: `${vaga.id}__${candidato.id}`,
          candidatoId: candidato.id,
          candidatoNome: candidato.nome,
          vagaId: vaga.id,
          vagaTitulo: vaga.titulo,
          empresaId,
          rubricaVersao: Number(vaga.rubricaCompatibilidade.versao || 1),
          atualizadoEm: agora
        }
        setAnalises((atuais) => [
          analiseSalva,
          ...atuais.filter((analise) => analise.id !== analiseSalva.id)
        ])
      } catch (error) {
        novasFalhas.push({ candidatoId: candidato.id, nome: candidato.nome, mensagem: error.message })
        setFalhas([...novasFalhas])
      }
      concluidas += 1
    }

    setCandidatoAtual('')
    setProgresso({ valor: 100, detalhe: t('compatibility.completed') })
    setAnalisando(false)
    if (novasFalhas.length) toast.warning(t('compatibility.completedWithErrors', { count: novasFalhas.length }))
    else toast.success(t('compatibility.completed'))
  }

  return (
    <section className={`compatibility-panel ${aberto ? 'open' : ''}`}>
      <button className="compatibility-panel-trigger" type="button" onClick={() => setAberto((valor) => !valor)}>
        <span className="compatibility-panel-trigger-icon"><FaBrain /></span>
        <span>
          <strong>{t('compatibility.title')}</strong>
          <small>{t('compatibility.subtitle')}</small>
        </span>
        <FaChevronDown className="compatibility-panel-chevron" />
      </button>

      {aberto && (
        <div className="compatibility-panel-body">
          {carregando ? (
            <p>{t('compatibility.loading')}</p>
          ) : !vagas.length ? (
            <p>{t('compatibility.noJobs')}</p>
          ) : (
            <>
              <div className="compatibility-toolbar">
                <label>
                  <span>{t('compatibility.selectJob')}</span>
                  <select value={vagaId} onChange={(event) => setVagaId(event.target.value)} disabled={analisando}>
                    {vagas.map((item) => <option key={item.id} value={item.id}>{item.titulo}</option>)}
                  </select>
                </label>
                {vaga?.rubricaCompatibilidade?.ativa && (
                  <button type="button" onClick={executarAnalises} disabled={analisando || !candidatosDaVaga.length}>
                    <FaSyncAlt className={analisando ? 'compatibility-spin' : ''} />
                    {analisando ? t('compatibility.analyzing') : t('compatibility.analyzeAll')}
                  </button>
                )}
              </div>

              {!vaga?.rubricaCompatibilidade?.ativa ? (
                <div className="compatibility-empty-rubric">
                  <FaFileAlt />
                  <div>
                    <strong>{t('compatibility.noRubric')}</strong>
                    <p>{t('compatibility.noRubricDescription')}</p>
                    <Link to={`/editar-vaga/empresa/${vaga?.id}`}>{t('compatibility.configureRubric')}</Link>
                  </div>
                </div>
              ) : (
                <>
                  <div className="compatibility-notice">
                    <FaExclamationTriangle />
                    <span>{t('compatibility.advisory')}</span>
                  </div>

                  {analisando && (
                    <div className="compatibility-progress">
                      <div><span style={{ width: `${progresso.valor}%` }} /></div>
                      <p>{progresso.valor}% — {progresso.detalhe}</p>
                    </div>
                  )}

                  {falhas.length > 0 && (
                    <div className="compatibility-failures">
                      <strong>{t('compatibility.failures')}</strong>
                      {falhas.map((falha) => <p key={falha.candidatoId}>{falha.nome}: {falha.mensagem}</p>)}
                    </div>
                  )}

                  <div className="compatibility-ranking">
                    {ranking.map(({ candidato, analise }, indice) => {
                      const desatualizada = analise && (
                        Number(analise.rubricaVersao) !== Number(vaga.rubricaCompatibilidade.versao)
                        || String(analise.versao || '') !== ANALISE_VERSAO
                      )
                      const aberta = detalheAberto === candidato.id
                      return (
                        <article key={candidato.id} className="compatibility-ranking-item">
                          <button
                            type="button"
                            className="compatibility-ranking-summary"
                            onClick={() => analise && setDetalheAberto(aberta ? '' : candidato.id)}
                          >
                            <span className="compatibility-position">{analise ? `${indice + 1}º` : '—'}</span>
                            <span className="compatibility-candidate-name">
                              <strong>{candidato.nome}</strong>
                              <small>{candidato.cargoAtual || candidato.vagaTitulo}</small>
                            </span>
                            {analise ? (
                              <>
                                <span className={`compatibility-score ${analise.nota >= 75 ? 'high' : analise.nota >= 50 ? 'medium' : 'low'}`}>
                                  {analise.nota}%
                                </span>
                                <span className="compatibility-coverage">
                                  {t('compatibility.coverage', { value: analise.cobertura })}
                                </span>
                                {(analise.requerRevisao || desatualizada) && (
                                  <span className="compatibility-review">
                                    {desatualizada ? t('compatibility.outdated') : t('compatibility.review')}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="compatibility-pending">
                                {candidatoAtual === candidato.id ? t('compatibility.processing') : t('compatibility.notAnalyzed')}
                              </span>
                            )}
                          </button>

                          {aberta && analise && (
                            <div className="compatibility-details">
                              <div className="compatibility-criteria-list">
                                {analise.criterios?.map((criterio) => {
                                  const Icone = ICONE_RESULTADO[criterio.resultado] || FaQuestionCircle
                                  return (
                                    <div key={criterio.id} className={`compatibility-criterion ${criterio.resultado}`}>
                                      <Icone />
                                      <div>
                                        <strong>{criterio.titulo}</strong>
                                        <span>{t(`compatibility.results.${criterio.resultado}`)} · {criterio.pontos}/{criterio.peso}</span>
                                        {criterio.evidencias?.[0] && <p>“{criterio.evidencias[0]}”</p>}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>

                              {analise.alertas?.length > 0 && (
                                <div className="compatibility-alert-list">
                                  <strong>{t('compatibility.alerts')}</strong>
                                  {analise.alertas.map((alerta, index) => <p key={`${alerta.descricao}-${index}`}>⚠ {alerta.descricao}</p>)}
                                </div>
                              )}
                              {analise.discrepancias?.length > 0 && (
                                <div className="compatibility-alert-list discrepancies">
                                  <strong>{t('compatibility.discrepancies')}</strong>
                                  {analise.discrepancias.map((item, index) => (
                                    <p key={`${item.campo}-${index}`}>
                                      {t('compatibility.discrepancyLine', { field: item.campo, form: item.formulario, resume: item.curriculo })}
                                    </p>
                                  ))}
                                </div>
                              )}
                              <small className="compatibility-engine">
                                {t('compatibility.engine', {
                                  extraction: analise.extracao?.metodo || 'formulario',
                                  semantic: analise.semantica?.motor || 'lexical'
                                })}
                              </small>
                            </div>
                          )}
                        </article>
                      )
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}

export default PainelRankingCompatibilidade
