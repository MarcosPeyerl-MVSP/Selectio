import './LinhaStatusCandidato.css'

import { FaBan, FaBriefcase, FaCheck, FaComments, FaUserCheck } from 'react-icons/fa'

const steps = [
  { value: 'indicado', label: 'Indicado', icon: FaUserCheck },
  { value: 'entrevista', label: 'Entrevista', icon: FaComments },
  { value: 'contratado', label: 'Contratado', icon: FaBriefcase }
]

const negativeCopy = {
  cancelado: 'Processo cancelado',
  recusado: 'Candidato recusado'
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
  const normalizedStatus = normalizeStatus(status)
  const isNegative = normalizedStatus === 'cancelado' || normalizedStatus === 'recusado'
  const activeIndex = isNegative ? 0 : steps.findIndex((step) => step.value === normalizedStatus)

  const handleClick = (nextStatus) => {
    if (!editable || loading || !onChangeStatus || nextStatus === normalizedStatus) return
    onChangeStatus(nextStatus)
  }

  return (
    <div className={`candidate-status-timeline ${variant} ${isNegative ? 'negative' : ''}`}>
      <div className="timeline-track" aria-label="Status do candidato">
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
              <span className="timeline-label">{step.label}</span>
            </button>
          )
        })}
      </div>

      {isNegative ? (
        <div className="timeline-negative-badge">
          <FaBan />
          {negativeCopy[normalizedStatus]}
        </div>
      ) : editable && (
        <button
          type="button"
          className="timeline-cancel-button"
          onClick={() => handleClick('cancelado')}
          disabled={loading}
        >
          Cancelar processo
        </button>
      )}
    </div>
  )
}

export default LinhaStatusCandidato
