import { MdTranslate } from 'react-icons/md'
import { useTranslation } from 'react-i18next'

function LanguageSwitcher() {
  const { t, i18n } = useTranslation('common')
  const activeLanguage = String(i18n.resolvedLanguage || i18n.language).startsWith('en')
    ? 'en-US'
    : 'pt-BR'
  const nextLanguage = activeLanguage === 'pt-BR' ? 'en-US' : 'pt-BR'
  const nextLanguageLabel = nextLanguage === 'en-US'
    ? t('language.english')
    : t('language.portuguese')

  return (
    <button
      type="button"
      className="icon-button language-switcher"
      onClick={() => i18n.changeLanguage(nextLanguage)}
      aria-label={`${t('language.selectorLabel')}: ${nextLanguageLabel}`}
      title={nextLanguageLabel}
    >
      <MdTranslate aria-hidden="true" />
    </button>
  )
}

export default LanguageSwitcher
