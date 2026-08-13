import './PageLoader.css'

import { useTranslation } from 'react-i18next'

function PageLoader({ label, tone = 'default', compact = false }) {
  const { t } = useTranslation('common')

  return (
    <div className={`page-loader ${tone} ${compact ? 'compact' : ''}`} role="status" aria-live="polite">
      <span className="page-loader-mark" aria-hidden="true" />
      <strong>{label || t('loading.default')}</strong>
    </div>
  )
}

export default PageLoader
