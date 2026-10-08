import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import InstitutionalLayout from './InstitutionalLayout'
export default function NotFound() {
  const { t } = useTranslation('institutional')
  return (
    <InstitutionalLayout page="notFound">
      <p className="institutional-not-found-help">{t('notFound.help')}</p>
      <div className="institutional-actions">
        <Link className="btn-primary" to="/">{t('notFound.home')}</Link>
      </div>
    </InstitutionalLayout>
  )
}
