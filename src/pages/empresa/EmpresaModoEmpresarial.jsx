import './styles/EmpresaModoEmpresarial.css'

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  FaCheckCircle,
  FaCommentDots,
  FaLock,
  FaRedo,
  FaRocket,
  FaTimesCircle,
  FaUsersCog
} from 'react-icons/fa'

import CardEsqueleto from '../../components/ui/CardEsqueleto'
import EstadoDados from '../../components/ui/EstadoDados'
import {
  atualizarFluxoAprovacaoVaga,
  listarVagasPorEmpresa
} from '../../services/firestoreVagas'
import { atualizarSetoresEmpresariais } from '../../services/firestoreUsers'
import { getFirebaseUid } from '../../services/identidadeFirebase'
import { useToast } from '../../hooks/useToast'
import { formatDate as formatLocalizedDate } from '../../i18n/formatters'
import { formatJobReward, formatJobSalary } from '../../i18n/domainFormatters'
import {
  SETOR_ADMIN_EMPRESA,
  SETOR_CHEFE_DEPARTAMENTO,
  SETOR_REITORIA_AUDITORIA,
  SETOR_RH,
  hashSenhaSetor,
  obterSetorAtual,
  setoresEmpresariais
} from '../../utils/modoEmpresarial'

const getStatusAprovacao = (vaga) => (
  vaga.statusAprovacao || (vaga.status === 'aberta' ? 'publicada' : 'solicitada')
)

const formatDate = (value, fallback) => formatLocalizedDate(value, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }) || fallback

export function EmpresaFluxoEmpresarial({ empresa }) {
  const { t } = useTranslation(['company', 'common'])
  const toast = useToast()
  const empresaUid = getFirebaseUid(empresa)
  const setorAtual = obterSetorAtual(empresa)
  const setorId = setorAtual?.id
  const [vagas, setVagas] = useState([])
  const [comentarios, setComentarios] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState('')

  useEffect(() => {
    let ativo = true

    const carregarVagas = async () => {
      if (!empresaUid) {
        setLoading(false)
        return
      }

      try {
        setError('')
        const data = await listarVagasPorEmpresa(empresaUid)
        if (ativo) setVagas(data)
      } catch {
        if (ativo) setError(t('enterprise.loadError'))
      } finally {
        if (ativo) setLoading(false)
      }
    }

    carregarVagas()

    return () => {
      ativo = false
    }
  }, [empresaUid, t])

  const vagasFluxo = useMemo(() => (
    vagas
      .filter((vaga) => vaga.modoEmpresa === 'empresarial' || vaga.statusAprovacao)
      .sort((a, b) => {
        const order = { solicitada: 1, devolvida: 2, aprovada: 3, publicada: 4 }
        return (order[getStatusAprovacao(a)] || 9) - (order[getStatusAprovacao(b)] || 9)
      })
  ), [vagas])

  const atualizarComentario = (vagaId, value) => {
    setComentarios((current) => ({
      ...current,
      [vagaId]: value
    }))
  }

  const moverVaga = async ({ vaga, statusAprovacao, status, sucesso, exigeComentario = false }) => {
    const comentario = comentarios[vaga.id] || ''

    if (exigeComentario && !comentario.trim()) {
      toast.warning(t('enterprise.commentRequired'))
      return
    }

    try {
      setUpdatingId(vaga.id)
      await atualizarFluxoAprovacaoVaga({
        vagaId: vaga.id,
        statusAprovacao,
        status,
        comentario,
        setor: setorAtual?.nome || '',
        usuario: empresa.nomeEmpresa || empresa.nome || ''
      })

      setVagas((current) => current.map((item) => (
        item.id === vaga.id
          ? {
            ...item,
            statusAprovacao,
            status: status || item.status,
            comentarioAuditoria: comentario.trim() || item.comentarioAuditoria
          }
          : item
      )))
      atualizarComentario(vaga.id, '')
      toast.success(sucesso)
    } catch {
      toast.error(t('enterprise.updateError'))
    } finally {
      setUpdatingId('')
    }
  }

  const tentarNovamente = () => {
    setLoading(true)
    setError('')
    listarVagasPorEmpresa(empresaUid)
      .then(setVagas)
      .catch(() => setError(t('enterprise.passwordsError')))
      .finally(() => setLoading(false))
  }

  const podeAuditar = setorId === SETOR_REITORIA_AUDITORIA
  const podePublicar = setorId === SETOR_RH
  const podeReenviar = setorId === SETOR_CHEFE_DEPARTAMENTO

  return (
    <section className="empresa-flow">
      <header className="empresa-flow-header">
        <span>{t('enterprise.eyebrow')}</span>
        <h1>{t('enterprise.title')}</h1>
        <p>{t('enterprise.description')}</p>
      </header>

      {loading && (
        <div className="empresa-flow-grid">
          <CardEsqueleto count={4} />
        </div>
      )}

      {!loading && error && (
        <EstadoDados
          actionLabel={t('enterprise.retry')}
          description={error}
          onAction={tentarNovamente}
          title={t('enterprise.loadError')}
          tone="error"
        />
      )}

      {!loading && !error && !vagasFluxo.length && (
        <EstadoDados
          title={t('enterprise.emptyTitle')}
          description={t('enterprise.emptyDescription')}
        />
      )}

      {!loading && !error && vagasFluxo.length > 0 && (
        <div className="empresa-flow-grid">
          {vagasFluxo.map((vaga) => {
            const statusAprovacao = getStatusAprovacao(vaga)
            const isUpdating = updatingId === vaga.id

            return (
              <article className={`empresa-flow-card status-${statusAprovacao}`} key={vaga.id}>
                <header>
                  <span>{t(`common:statuses.jobApproval.${statusAprovacao}`, { defaultValue: statusAprovacao })}</span>
                  <h2>{vaga.titulo}</h2>
                  <p>{vaga.area || t('enterprise.areaNotProvided')} - {vaga.localizacao || t('enterprise.locationNotProvided')}</p>
                </header>

                <dl>
                  <div>
                    <dt>{t('enterprise.salary')}</dt>
                    <dd>{formatJobSalary(vaga, t)}</dd>
                  </div>
                  <div>
                    <dt>{t('enterprise.reward')}</dt>
                    <dd>{formatJobReward(vaga, t)}</dd>
                  </div>
                  <div>
                    <dt>{t('enterprise.deadline')}</dt>
                    <dd>{formatDate(vaga.dataLimite || vaga.expiraEm, t('enterprise.noDeadline'))}</dd>
                  </div>
                </dl>

                {vaga.comentarioAuditoria && (
                  <div className="empresa-flow-comment">
                    <FaCommentDots />
                    <p>{vaga.comentarioAuditoria}</p>
                  </div>
                )}

                {podeAuditar && statusAprovacao === 'solicitada' && (
                  <div className="empresa-flow-actions">
                    <textarea
                      placeholder={t('enterprise.auditPlaceholder')}
                      value={comentarios[vaga.id] || ''}
                      onChange={(event) => atualizarComentario(vaga.id, event.target.value)}
                    />
                    <div>
                      <button
                        type="button"
                        className="flow-approve"
                        disabled={isUpdating}
                        onClick={() => moverVaga({
                          vaga,
                          statusAprovacao: 'aprovada',
                          status: 'pausada',
                          sucesso: t('enterprise.approvedSentHr')
                        })}
                      >
                        <FaCheckCircle /> {t('enterprise.approve')}
                      </button>
                      <button
                        type="button"
                        className="flow-return"
                        disabled={isUpdating}
                        onClick={() => moverVaga({
                          vaga,
                          statusAprovacao: 'devolvida',
                          status: 'pausada',
                          sucesso: t('enterprise.returnedDepartment'),
                          exigeComentario: true
                        })}
                      >
                        <FaTimesCircle /> {t('enterprise.return')}
                      </button>
                    </div>
                  </div>
                )}

                {podePublicar && statusAprovacao === 'aprovada' && (
                  <div className="empresa-flow-actions compact">
                    <button
                      type="button"
                      className="flow-publish"
                      disabled={isUpdating}
                      onClick={() => moverVaga({
                        vaga,
                        statusAprovacao: 'publicada',
                        status: 'aberta',
                        sucesso: t('enterprise.published')
                      })}
                    >
                      <FaRocket /> {t('enterprise.publish')}
                    </button>
                  </div>
                )}

                {podeReenviar && statusAprovacao === 'devolvida' && (
                  <div className="empresa-flow-actions compact">
                    <Link to={`/editar-vaga/empresa/${vaga.id}`}>{t('enterprise.editRequest')}</Link>
                    <button
                      type="button"
                      className="flow-approve"
                      disabled={isUpdating}
                      onClick={() => moverVaga({
                        vaga,
                        statusAprovacao: 'solicitada',
                        status: 'pausada',
                        sucesso: t('enterprise.resent')
                      })}
                    >
                      <FaRedo /> {t('enterprise.resend')}
                    </button>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export function EmpresaSetoresEmpresariais({ empresa, onUserUpdate }) {
  const { t } = useTranslation('company')
  const toast = useToast()
  const empresaUid = getFirebaseUid(empresa)
  const setorAtual = obterSetorAtual(empresa)
  const [senhas, setSenhas] = useState(() => setoresEmpresariais.reduce((mapa, setor) => ({
    ...mapa,
    [setor.id]: ''
  }), {}))
  const [loading, setLoading] = useState(false)

  if (setorAtual?.id !== SETOR_ADMIN_EMPRESA) {
    return (
      <EstadoDados
        title={t('enterprise.restricted')}
        description={t('enterprise.restrictedDescription')}
      />
    )
  }

  const handleChange = (setorId, value) => {
    setSenhas((current) => ({
      ...current,
      [setorId]: value
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    try {
      setLoading(true)
      const setoresAtuais = empresa.setoresEmpresariais || {}
      const entradas = await Promise.all(setoresEmpresariais.map(async (setor) => {
        const senha = senhas[setor.id]?.trim()
        const senhaHashAtual = setoresAtuais[setor.id]?.senhaHash || ''

        return [
          setor.id,
          {
            id: setor.id,
            nome: setor.nome,
            resumo: setor.resumo,
            senhaHash: senha ? await hashSenhaSetor(senha, empresaUid) : senhaHashAtual,
            senhaDefinida: Boolean(senha || senhaHashAtual)
          }
        ]
      }))
      const setoresEmpresariaisAtualizados = Object.fromEntries(entradas)

      await atualizarSetoresEmpresariais({
        uid: empresaUid,
        setoresEmpresariais: setoresEmpresariaisAtualizados
      })

      const empresaAtualizada = {
        ...empresa,
        setoresEmpresariais: setoresEmpresariaisAtualizados
      }

      localStorage.setItem('empresaUser', JSON.stringify(empresaAtualizada))
      onUserUpdate?.(empresaAtualizada)
      setSenhas(setoresEmpresariais.reduce((mapa, setor) => ({
        ...mapa,
        [setor.id]: ''
      }), {}))
      toast.success(t('enterprise.passwordsUpdated'))
    } catch {
      toast.error(t('enterprise.passwordsError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="empresa-setores">
      <header className="empresa-flow-header">
        <span>{t('enterprise.adminEyebrow')}</span>
        <h1>{t('enterprise.sectorsTitle')}</h1>
        <p>{t('enterprise.sectorsDescription')}</p>
      </header>

      <form className="empresa-setores-grid" onSubmit={handleSubmit}>
        {setoresEmpresariais.map((setor) => {
          const senhaDefinida = empresa.setoresEmpresariais?.[setor.id]?.senhaDefinida

          return (
            <article className="empresa-setor-card" key={setor.id}>
              <FaUsersCog />
              <div>
                <h2>{t(`enterprise.sectors.${setor.id}.name`)}</h2>
                <p>{t(`enterprise.sectors.${setor.id}.description`)}</p>
                <span>{senhaDefinida ? t('enterprise.passwordDefined') : t('enterprise.passwordPending')}</span>
              </div>

              <label>
                <FaLock />
                <input
                  type="password"
                  placeholder={t('enterprise.newPassword')}
                  value={senhas[setor.id]}
                  onChange={(event) => handleChange(setor.id, event.target.value)}
                />
              </label>
            </article>
          )
        })}

        <button type="submit" disabled={loading}>
          {loading ? t('enterprise.saving') : t('enterprise.savePasswords')}
        </button>
      </form>
    </section>
  )
}
