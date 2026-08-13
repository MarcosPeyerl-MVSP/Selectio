import './LanguageSwitcher.css'

import { MdTranslate } from 'react-icons/md'
import { useTranslation } from 'react-i18next'

const languageOptions = [
  { value: 'pt-BR', labelKey: 'language.portuguese' },
  { value: 'en-US', labelKey: 'language.english' }
]

function LanguageSwitcher({ variant = 'icon', onLanguageChange }) {
  const { t, i18n } = useTranslation('common')
  const activeLanguage = String(i18n.resolvedLanguage || i18n.language).startsWith('en')
    ? 'en-US'
    : 'pt-BR'
  const nextLanguage = activeLanguage === 'pt-BR' ? 'en-US' : 'pt-BR'
  const activeLanguageLabel = activeLanguage === 'en-US'
    ? t('language.english')
    : t('language.portuguese')
  const nextLanguageLabel = nextLanguage === 'en-US'
    ? t('language.english')
    : t('language.portuguese')

  const changeLanguage = async (language) => {
    await i18n.changeLanguage(language)
    onLanguageChange?.(language)
  }

  if (variant === 'menu') {
    return (
      <button
        type="button"
        className="language-menu-item"
        role="menuitem"
        onClick={() => changeLanguage(nextLanguage)}
        aria-label={`${t('language.selectorLabel')}: ${nextLanguageLabel}`}
      >
        <MdTranslate aria-hidden="true" />
        <span>{t('language.menuLabel')}</span>
        <small>{activeLanguageLabel}</small>
      </button>
    )
  }

  if (variant === 'settings') {
    return (
      <div className="language-settings-options" role="group" aria-label={t('language.selectorLabel')}>
        {languageOptions.map((option) => (
          <button
            type="button"
            className={activeLanguage === option.value ? 'selected' : ''}
            key={option.value}
            onClick={() => changeLanguage(option.value)}
            aria-pressed={activeLanguage === option.value}
          >
            <span className="language-option-code">{option.value === 'pt-BR' ? 'PT' : 'EN'}</span>
            <span>{t(option.labelKey)}</span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <button
      type="button"
      className="icon-button language-switcher"
      onClick={() => changeLanguage(nextLanguage)}
      aria-label={`${t('language.selectorLabel')}: ${nextLanguageLabel}`}
      title={nextLanguageLabel}
    >
      <MdTranslate aria-hidden="true" />
    </button>
  )
}

export default LanguageSwitcher
