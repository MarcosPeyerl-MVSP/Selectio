import './AdminUI.css'

import { FaInbox, FaSearch, FaTimes } from 'react-icons/fa'

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
  const normalized = String(status || 'neutro').toLowerCase().replace(/[^a-z0-9_-]/g, '-')
  return <span className={`admin-status-badge ${normalized}`}>{label || status || 'Não informado'}</span>
}

export function AdminToolbar({ search, onSearch, placeholder = 'Buscar...', children, onClear }) {
  return (
    <section className="admin-toolbar">
      <label className="admin-search">
        <FaSearch />
        <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={placeholder} />
      </label>
      <div className="admin-toolbar-filters">{children}</div>
      {onClear && (
        <button type="button" className="admin-clear-filters" onClick={onClear}>
          Limpar filtros
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

export function AdminEmptyState({ title = 'Nenhum registro encontrado', description }) {
  return (
    <section className="admin-empty-state">
      <FaInbox />
      <strong>{title}</strong>
      {description && <p>{description}</p>}
    </section>
  )
}

export function AdminLoading({ label = 'Carregando dados administrativos...' }) {
  return (
    <section className="admin-loading">
      <PageLoader label={label} compact />
    </section>
  )
}

export function AdminError({ message, onRetry }) {
  return (
    <section className="admin-error">
      <strong>Não foi possível carregar esta área</strong>
      <p>{message}</p>
      {onRetry && <button type="button" onClick={onRetry}>Tentar novamente</button>}
    </section>
  )
}

export function AdminModal({ title, eyebrow = 'Detalhes', onClose, children }) {
  return (
    <div className="admin-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Fechar">
          <FaTimes />
        </button>
        <header>
          <span>{eyebrow}</span>
          <h2 id="admin-modal-title">{title}</h2>
        </header>
        <div className="admin-modal-content">{children}</div>
      </section>
    </div>
  )
}

export function AdminDetailGrid({ items }) {
  return (
    <dl className="admin-detail-grid">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value || 'Não informado'}</dd>
        </div>
      ))}
    </dl>
  )
}
