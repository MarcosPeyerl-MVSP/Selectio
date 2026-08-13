import './AdminUI.css'

import { FaInbox, FaSearch, FaTimes } from 'react-icons/fa'
import { useTranslation } from 'react-i18next'

import PageLoader from '../ui/PageLoader'

export function AdminPageHeader({ eyebrow, title, description, action }) {
  return (
    <header className="admin-page-header">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  )
}

export function AdminMetrics({ children, className = '' }) {
  return <section className={`admin-metrics ${className}`.trim()}>{children}</section>
}

export function AdminMetricCard({ icon: Icon, label, value, helper, tone = '' }) {
  return (
    <article className={`admin-metric-card ${tone}`}>
      <div>
        {Icon && <span><Icon /></span>}
        <small>{label}</small>
      </div>
      <strong>{value}</strong>
      {helper && <p>{helper}</p>}
    </article>
  )
}

export function AdminStatusBadge({ status, label }) {
  const { t } = useTranslation('common')
  const normalized = String(status || 'neutro').toLowerCase().replace(/[^a-z0-9_-]/g, '-')
  return <span className={`admin-status-badge ${normalized}`}>{label || status || t('generic.notProvided')}</span>
}

export function AdminToolbar({ search, onSearch, placeholder, children, onClear }) {
  const { t } = useTranslation('common')

  return (
    <section className="admin-toolbar">
      <label className="admin-search">
        <FaSearch />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={placeholder || t('generic.search')}
        />
      </label>
      <div className="admin-toolbar-filters">{children}</div>
      {onClear && (
        <button type="button" className="admin-clear-filters" onClick={onClear}>
          {t('generic.clearFilters')}
        </button>
      )}
    </section>
  )
}

export function AdminTable({ columns, rows, rowKey = 'id', emptyTitle, emptyDescription }) {
  if (!rows.length) {
    return <AdminEmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div className="admin-table-shell">
      <div className="admin-table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={typeof rowKey === 'function' ? rowKey(row) : row[rowKey]}>
                {columns.map((column) => (
                  <td key={column.key}>
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function AdminEmptyState({ title, description }) {
  const { t } = useTranslation('common')

  return (
    <section className="admin-empty-state">
      <FaInbox />
      <strong>{title || t('generic.noRecords')}</strong>
      {description && <p>{description}</p>}
    </section>
  )
}

export function AdminLoading({ label }) {
  const { t } = useTranslation('common')

  return (
    <section className="admin-loading">
      <PageLoader label={label || t('generic.loadingAdminData')} compact />
    </section>
  )
}

export function AdminError({ message, onRetry }) {
  const { t } = useTranslation('common')

  return (
    <section className="admin-error">
      <strong>{t('generic.loadAreaError')}</strong>
      <p>{message}</p>
      {onRetry && <button type="button" onClick={onRetry}>{t('generic.retry')}</button>}
    </section>
  )
}

export function AdminModal({ title, eyebrow, onClose, children }) {
  const { t } = useTranslation('common')

  return (
    <div className="admin-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="admin-modal-close" onClick={onClose} aria-label={t('generic.close')}>
          <FaTimes />
        </button>
        <header>
          <span>{eyebrow || t('generic.details')}</span>
          <h2 id="admin-modal-title">{title}</h2>
        </header>
        <div className="admin-modal-content">{children}</div>
      </section>
    </div>
  )
}

export function AdminDetailGrid({ items }) {
  const { t } = useTranslation('common')

  return (
    <dl className="admin-detail-grid">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value || t('generic.notProvided')}</dd>
        </div>
      ))}
    </dl>
  )
}
