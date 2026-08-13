import './ModalPerfilCandidato.css'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FaBriefcase,
  FaCalendarAlt,
  FaEnvelope,
  FaFileAlt,
  FaLink,
  FaMoneyBillWave,
  FaPhone,
  FaHistory,
  FaTimes,
  FaUser,
  FaUserTie
} from 'react-icons/fa'

import LinhaStatusCandidato from './LinhaStatusCandidato'
import EstadoDados from './EstadoDados'
import PageLoader from './PageLoader'
import { listarHistoricoCandidato } from '../../services/firestoreHistorico'
import { formatDate as formatLocalizedDate } from '../../i18n/formatters'

const candidateValueKeys = {
  Feminino: 'candidateForm.options.gender.female',
  Masculino: 'candidateForm.options.gender.male',
  'Não binário': 'candidateForm.options.gender.nonBinary',
  Outro: 'candidateForm.options.gender.other',
  'Prefiro não informar': 'candidateForm.options.gender.preferNot',
  'Ensino fundamental': 'candidateForm.options.education.elementary',
  'Ensino médio': 'candidateForm.options.education.highSchool',
  Técnico: 'candidateForm.options.education.technical',
  Superior: 'candidateForm.options.education.higher',
  'Pós-graduação': 'candidateForm.options.education.postgraduate',
  Mestrado: 'candidateForm.options.education.masters',
  Doutorado: 'candidateForm.options.education.doctorate',
  Remoto: 'candidateForm.options.workModel.remote',
  Híbrido: 'candidateForm.options.workModel.hybrid',
  Presencial: 'candidateForm.options.workModel.onsite',
  Imediato: 'candidateForm.options.notice.immediate',
  '15 dias': 'candidateForm.options.notice.days15',
  '30 dias': 'candidateForm.options.notice.days30',
  '45 dias': 'candidateForm.options.notice.days45',
  '60 dias': 'candidateForm.options.notice.days60'
}

function formatValue(value, emptyValue) {
  if (Array.isArray(value)) return value.length ? value : null
  return value || emptyValue
}

function formatDate(value, fallback) {
  return formatLocalizedDate(value, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }) || fallback
}

function formatDateTime(value, fallback) {
  return formatLocalizedDate(value, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) || fallback
}

function ModalPerfilCandidato({
  candidato,
  onClose,
  variant = 'processo',
  editableStatus = false,
  onChangeStatus,
  loadingStatus = false
}) {
  const { t } = useTranslation('common')
  const isPreSalvo = variant === 'preSalvo'
  const emptyValue = t('candidateProfile.notProvided')
  const [historico, setHistorico] = useState([])
  const [loadingHistorico, setLoadingHistorico] = useState(true)
  const [erroHistorico, setErroHistorico] = useState('')
  const [historicoReloadKey, setHistoricoReloadKey] = useState(0)

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    if (!candidato?.id || isPreSalvo) return undefined

    let ativo = true

    listarHistoricoCandidato(candidato.id)
      .then((eventos) => {
        if (ativo) setHistorico(eventos)
      })
      .catch(() => {
        if (ativo) setErroHistorico(t('candidateProfile.historyError'))
      })
      .finally(() => {
        if (ativo) setLoadingHistorico(false)
      })

    return () => {
      ativo = false
    }
  }, [candidato?.id, historicoReloadKey, isPreSalvo, t])

  const carregarHistoricoNovamente = () => {
    setLoadingHistorico(true)
    setErroHistorico('')
    setHistoricoReloadKey((value) => value + 1)
  }

  if (!candidato) return null

  const status = isPreSalvo ? 'pre_salvo' : candidato.status || 'indicado'
  const details = [
    { icon: FaEnvelope, label: t('candidateProfile.email'), value: candidato.email },
    { icon: FaPhone, label: t('candidateProfile.phone'), value: candidato.telefone },
    { icon: FaCalendarAlt, label: t('candidateProfile.birthDate'), value: formatDate(candidato.dataNascimento, emptyValue) },
    { icon: FaUser, label: t('candidateProfile.gender'), value: translateCandidateValue(candidato.genero, t) },
    { icon: FaLink, label: 'LinkedIn', value: candidato.linkedin, link: true },
    { icon: FaLink, label: 'Portfolio', value: candidato.portfolio, link: true },
    { icon: FaLink, label: 'GitHub / Behance', value: candidato.github, link: true },
    { icon: FaBriefcase, label: t('candidateProfile.currentRole'), value: candidato.cargoAtual },
    { icon: FaUserTie, label: t('candidateProfile.experience'), value: candidato.anosExperiencia },
    { icon: FaFileAlt, label: t('candidateProfile.education'), value: translateCandidateValue(candidato.escolaridade, t) },
    { icon: FaFileAlt, label: t('candidateProfile.languages'), value: candidato.proficienciaIdiomas },
    { icon: FaMoneyBillWave, label: t('candidateProfile.salaryExpectation'), value: candidato.expectativaSalarial },
    { icon: FaBriefcase, label: t('candidateProfile.workModel'), value: translateCandidateValue(candidato.modeloTrabalho, t) },
    { icon: FaCalendarAlt, label: t('candidateProfile.noticePeriod'), value: translateCandidateValue(candidato.avisoPrevio, t) },
    ...(!isPreSalvo ? [
      { icon: FaBriefcase, label: t('candidateProfile.relatedJob'), value: candidato.vagaTitulo },
      { icon: FaBriefcase, label: t('candidateProfile.company'), value: candidato.vagaEmpresa || candidato.empresaNome }
    ] : []),
    { icon: FaUser, label: t('candidateProfile.referrer'), value: candidato.indicadorNome },
    {
      icon: FaCalendarAlt,
      label: isPreSalvo ? t('candidateProfile.savedAt') : t('candidateProfile.referralDate'),
      value: formatDate(candidato.aplicadoEm || candidato.criadoEm || candidato.createdAt, emptyValue)
    },
    { icon: FaFileAlt, label: t('candidateProfile.resume'), value: candidato.curriculoNome }
  ]

  return (
    <div className="candidate-profile-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className={`candidate-profile-modal ${isPreSalvo ? 'pre-salvo' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="candidate-profile-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="candidate-profile-close" onClick={onClose} aria-label={t('candidateProfile.close')}>
          <FaTimes />
        </button>

        <header className="candidate-profile-header">
          <span>{t('candidateProfile.eyebrow')}</span>
          <h2 id="candidate-profile-title">{candidato.nome || emptyValue}</h2>
          <p>{candidato.cargoAtual || candidato.vagaTitulo || (isPreSalvo ? t('candidateProfile.preSavedCandidate') : t('candidateProfile.referredCandidate'))}</p>
          <strong>{status === 'pre_salvo' ? t('candidateProfile.preSaved') : t(`statuses.candidates.${status}`, { defaultValue: status })}</strong>
        </header>

        {!isPreSalvo && (
          <section className="candidate-profile-section">
            <div className="candidate-profile-section-title">
              <span>{t('candidateProfile.status')}</span>
              <p>{t('candidateProfile.statusDescription')}</p>
            </div>
            <LinhaStatusCandidato
              status={status}
              editable={editableStatus}
              loading={loadingStatus}
              onChangeStatus={onChangeStatus}
            />
          </section>
        )}

        {!isPreSalvo && <section className="candidate-profile-section">
          <div className="candidate-profile-section-title candidate-history-title">
            <div>
              <span>{t('candidateProfile.history')}</span>
              <p>{t('candidateProfile.historyDescription')}</p>
            </div>
            <FaHistory aria-hidden="true" />
          </div>

          {loadingHistorico ? (
            <PageLoader label={t('candidateProfile.historyLoading')} compact />
          ) : erroHistorico ? (
            <EstadoDados
              actionLabel={t('candidateProfile.retry')}
              compact
              description={erroHistorico}
              onAction={carregarHistoricoNovamente}
              title={t('candidateProfile.historyError')}
              tone="error"
            />
          ) : historico.length ? (
            <ol className="candidate-history">
              {historico.map((evento) => {
                const params = getHistoryParams(evento, t)
                const title = evento.tituloKey
                  ? t(evento.tituloKey, params)
                  : evento.titulo
                const description = evento.descricaoKey
                  ? t(evento.descricaoKey, params)
                  : evento.descricao

                return (
                  <li key={evento.id}>
                    <span className="candidate-history-marker" aria-hidden="true" />
                    <div>
                      <strong>{title}</strong>
                      {description && <p>{description}</p>}
                      <time dateTime={evento.criadoEm || undefined}>
                        {formatDateTime(evento.criadoEm, t('candidateProfile.datePending'))}
                      </time>
                    </div>
                  </li>
                )
              })}
            </ol>
          ) : (
            <EstadoDados
              compact
              description={t('candidateProfile.historyEmptyDescription')}
              title={t('candidateProfile.historyEmpty')}
            />
          )}
        </section>}

        <section className="candidate-profile-grid">
          {details.map((item) => {
            const Icon = item.icon
            const value = formatValue(item.value, emptyValue)

            return (
              <div className="candidate-profile-detail" key={item.label}>
                <Icon />
                <span>{item.label}</span>
                {item.link && item.value ? (
                  <a href={String(item.value).startsWith('http') ? item.value : `https://${item.value}`} target="_blank" rel="noreferrer">
                    {item.value}
                  </a>
                ) : (
                  <strong>{value}</strong>
                )}
              </div>
            )
          })}
        </section>

        <ProfileText title={t('candidateProfile.strengths')} value={candidato.pontosFortes} />
        <ProfileText title={t('candidateProfile.cultureFit')} value={candidato.fitCultural} />
        <ProfileText title={t('candidateProfile.narrative')} value={candidato.narrativa || candidato.mensagem} />
        <ProfileText title={t('candidateProfile.professionalNotes')} value={candidato.observacoes || candidato.observacoesProfissionais} />
        <ProfileTags title={t('candidateProfile.hardSkills')} values={candidato.hardSkills} />
        <ProfileTags title={t('candidateProfile.softSkills')} values={candidato.softSkills} />
      </aside>
    </div>
  )
}

function translateCandidateValue(value, t) {
  return candidateValueKeys[value] ? t(candidateValueKeys[value]) : value
}

function getHistoryParams(evento, t) {
  const params = { ...(evento.descricaoParams || {}), ...(evento.tituloParams || {}) }
  const isInterview = String(evento.tipo || '').startsWith('entrevista_')
  const statusPath = isInterview ? 'statuses.interviews' : 'statuses.candidates'

  if (params.fromStatus) params.from = t(`${statusPath}.${params.fromStatus}`, { defaultValue: params.fromStatus })
  if (params.toStatus) params.to = t(`${statusPath}.${params.toStatus}`, { defaultValue: params.toStatus })
  if (params.date) {
    params.date = formatLocalizedDate(`${params.date}T12:00:00`, { dateStyle: 'short' }) || params.date
  }

  params.candidate = params.candidate
    || evento.candidatoNome
    || t('candidateProfile.historyEvents.candidateFallback')
  params.job = params.job
    || evento.vagaTitulo
    || t('candidateProfile.historyEvents.jobFallback')

  return params
}

function ProfileText({ title, value }) {
  if (!value) return null

  return (
    <section className="candidate-profile-section">
      <div className="candidate-profile-section-title">
        <span>{title}</span>
      </div>
      <p className="candidate-profile-text">{value}</p>
    </section>
  )
}

function ProfileTags({ title, values }) {
  if (!Array.isArray(values) || !values.length) return null

  return (
    <section className="candidate-profile-section">
      <div className="candidate-profile-section-title">
        <span>{title}</span>
      </div>
      <div className="candidate-profile-tags">
        {values.map((value) => (
          <span key={value}>{value}</span>
        ))}
      </div>
    </section>
  )
}

export default ModalPerfilCandidato
