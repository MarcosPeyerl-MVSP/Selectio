import './ThemeSwitcher.css'

import { LuMoonStar, LuSunMedium } from 'react-icons/lu'
import { useTranslation } from 'react-i18next'

import { useTema } from '../../hooks/useTema'

const themeOptions = [
  {
    value: 'light',
    labelKey: 'theme.light',
    descriptionKey: 'theme.lightDescription',
    Icon: LuSunMedium,
    colors: ['#ffffff', '#efefef', '#b61c2f']
  },
  {
    value: 'dark',
    labelKey: 'theme.dark',
    descriptionKey: 'theme.darkDescription',
    Icon: LuMoonStar,
    colors: ['#181818', '#111111', '#d73549']
  }
]

function ThemeSwitcher() {
  const { t } = useTranslation('common')
  const { theme, changeTheme } = useTema()

  return (
    <div className="theme-settings-options" role="radiogroup" aria-label={t('theme.selectorLabel')}>
      {themeOptions.map(({ value, labelKey, descriptionKey, Icon, colors }) => (
        <button
          type="button"
          className={`theme-option ${theme === value ? 'selected' : ''}`}
          key={value}
          onClick={() => changeTheme(value)}
          role="radio"
          aria-checked={theme === value}
        >
          <span className="theme-option-preview" aria-hidden="true">
            {colors.map((color) => (
              <span key={color} style={{ backgroundColor: color }} />
            ))}
          </span>
          <span className="theme-option-icon">
            <Icon aria-hidden="true" />
          </span>
          <span className="theme-option-copy">
            <strong>{t(labelKey)}</strong>
            <small>{t(descriptionKey)}</small>
          </span>
          <span className="theme-option-check" aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}

export default ThemeSwitcher
