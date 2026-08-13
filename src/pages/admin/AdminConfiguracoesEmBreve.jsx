import './styles/AdminPages.css'

import { FaCog } from 'react-icons/fa'
import { useTranslation } from 'react-i18next'

function AdminConfiguracoesEmBreve() {
  const { t } = useTranslation('admin')

  return (
    <section className="admin-coming-soon">
      <FaCog />
      <h1>{t('comingSoon.title')}</h1>
      <p>{t('comingSoon.description')}</p>
    </section>
  )
}

export default AdminConfiguracoesEmBreve
