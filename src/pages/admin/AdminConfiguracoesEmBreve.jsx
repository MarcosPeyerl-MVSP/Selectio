import './styles/AdminPages.css'

import { FaCog } from 'react-icons/fa'
import { MdTranslate } from 'react-icons/md'
import { LuSunMoon } from 'react-icons/lu'
import { useTranslation } from 'react-i18next'

import LanguageSwitcher from '../../components/layout/LanguageSwitcher'
import ThemeSwitcher from '../../components/layout/ThemeSwitcher'

function AdminConfiguracoesEmBreve() {
  const { t } = useTranslation(['admin', 'common'])

  return (
    <section className="admin-settings-page">
      <article className="admin-language-settings">
        <div className="admin-settings-title">
          <MdTranslate aria-hidden="true" />
          <div>
            <span>{t('common:accountSettings.preferences')}</span>
            <h1>{t('common:accountSettings.languageTitle')}</h1>
          </div>
        </div>
        <p>{t('common:accountSettings.languageDescription')}</p>
        <LanguageSwitcher variant="settings" />
      </article>

      <article className="admin-language-settings">
        <div className="admin-settings-title">
          <LuSunMoon aria-hidden="true" />
          <div>
            <span>{t('common:accountSettings.preferences')}</span>
            <h1>{t('common:accountSettings.appearanceTitle')}</h1>
          </div>
        </div>
        <p>{t('common:accountSettings.appearanceDescription')}</p>
        <ThemeSwitcher />
      </article>

      <article className="admin-coming-soon">
        <FaCog />
        <h2>{t('comingSoon.title')}</h2>
        <p>{t('comingSoon.description')}</p>
      </article>
    </section>
  )
}

export default AdminConfiguracoesEmBreve
