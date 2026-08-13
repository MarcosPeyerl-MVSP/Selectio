import { useTranslation } from 'react-i18next'

function PanelPlaceholder({ title, description }) {
  const { t } = useTranslation('common')

  return (
    <section className="panel-placeholder">
      <p className="dashboard-breadcrumb">{t('panel.underConstruction')}</p>
      <h1>
        {title}
        <span>.</span>
      </h1>
      <p>{description}</p>
    </section>
  )
}

export default PanelPlaceholder
