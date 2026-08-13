import './LinhaStatusCandidato.css'

import { FaBan, FaBriefcase, FaCheck, FaComments, FaUserCheck } from 'react-icons/fa'
import { useTranslation } from 'react-i18next'

const steps = [
  { value: 'indicado', labelKey: 'candidateStatus.referred', icon: FaUserCheck },
  { value: 'entrevista', labelKey: 'candidateStatus.interview', icon: FaComments },
  { value: 'contratado', labelKey: 'candidateStatus.hired', icon: FaBriefcase }
]

const negativeCopy = {
  cancelado: 'candidateStatus.cancelled',
  recusado: 'candidateStatus.rejected'
}

const normalizeStatus = (status) => {
  if (status === 'recusado') return 'recusado'
  if (status === 'cancelado') return 'cancelado'
  return steps.some((step) => step.value === status) ? status : 'indicado'
}

function LinhaStatusCandidato({
  status,
  editable = false,
  loading = false,
  onChangeStatus,
  variant = 'default'
}) {
  const { t } = useTranslation('common')
  const normalizedStatus = normalizeStatus(status)
  const isNegative = normalizedStatus === 'cancelado' || normalizedStatus === 'recusado'
  const activeIndex = isNegative ? 0 : steps.findIndex((step) => step.value === normalizedStatus)

  const handleClick = (nextStatus) => {
    if (!editable || loading || !onChangeStatus || nextStatus === normalizedStatus) return
    onChangeStatus(nextStatus)
  }

  return (
    <div className={`candidate-status-timeline ${variant} ${isNegative ? 'negative' : ''}`}>
      <div className="timeline-track" aria-label={t('candidateStatus.label')}>
        {steps.map((step, index) => {
          const Icon = step.icon
          const state = isNegative
            ? index === 0 ? 'completed' : 'future'
            : index < activeIndex ? 'completed' : index === activeIndex ? 'active' : 'future'
          const canClick = editable && !loading

          return (
            <button
              key={step.value}
              type="button"
              className={`timeline-step ${state}`}
              onClick={() => handleClick(step.value)}
              disabled={!canClick}
              aria-current={state === 'active' ? 'step' : undefined}
            >
              <span className="timeline-node">
                {state === 'completed' ? <FaCheck /> : <Icon />}
              </span>
              <span className="timeline-label">{t(step.labelKey)}</span>
            </button>
          )
        })}
      </div>

      {isNegative ? (
        <div className="timeline-negative-badge">
          <FaBan />
          {t(negativeCopy[normalizedStatus])}
        </div>
      ) : editable && (
        <div className="timeline-negative-actions">
          <button
            type="button"
            className="timeline-cancel-button"
            onClick={() => handleClick('recusado')}
            disabled={loading}
          >
            {t('candidateStatus.rejectAction')}
          </button>
          <button
            type="button"
            className="timeline-cancel-button"
            onClick={() => handleClick('cancelado')}
            disabled={loading}
          >
            {t('candidateStatus.cancelAction')}
          </button>
        </div>
      )}
    </div>
  )
}

export default LinhaStatusCandidato
