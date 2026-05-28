import './PageLoader.css'

function PageLoader({ label = 'Carregando...', tone = 'default', compact = false }) {
  return (
    <div className={`page-loader ${tone} ${compact ? 'compact' : ''}`} role="status" aria-live="polite">
      <span className="page-loader-mark" aria-hidden="true" />
      <strong>{label}</strong>
    </div>
  )
}

export default PageLoader
