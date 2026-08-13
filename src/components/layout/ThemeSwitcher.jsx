import './LanguageSwitcher.css'

import { LuMoonStar, LuSunMedium } from 'react-icons/lu'
import { useTranslation } from 'react-i18next'

import { useTema } from '../../hooks/useTema'

const themeOptions = [
  { value: 'light', labelKey: 'theme.light', Icon: LuSunMedium },
  { value: 'dark', labelKey: 'theme.dark', Icon: LuMoonStar }
]

function ThemeSwitcher() {
  const { t } = useTranslation('common')
  const { theme, changeTheme } = useTema()

  return (
    <div className="language-settings-options" role="group" aria-label={t('theme.selectorLabel')}>
      {themeOptions.map(({ value, labelKey, Icon }) => (
        <button
          type="button"
          className={theme === value ? 'selected' : ''}
          key={value}
          onClick={() => changeTheme(value)}
          aria-pressed={theme === value}
        >
          <span className="language-option-code">
            <Icon aria-hidden="true" />
          </span>
          <span>{t(labelKey)}</span>
        </button>
      ))}
    </div>
  )
}

export default ThemeSwitcher
