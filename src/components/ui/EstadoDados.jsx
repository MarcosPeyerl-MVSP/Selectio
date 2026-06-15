import './EstadoDados.css'

import { FaExclamationTriangle, FaInbox, FaWifi } from 'react-icons/fa'

const icons = {
  empty: FaInbox,
  error: FaExclamationTriangle,
  offline: FaWifi
}

function EstadoDados({
  actionLabel = '',
  compact = false,
  description,
  onAction,
  title,
  tone = 'empty'
}) {
  const Icon = icons[tone] || icons.empty

  return (
    <section
      className={`data-state ${tone} ${compact ? 'compact' : ''}`}
      role={tone === 'error' || tone === 'offline' ? 'alert' : 'status'}
    >
      <Icon aria-hidden="true" />
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {actionLabel && onAction && (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </section>
  )
}

export default EstadoDados
