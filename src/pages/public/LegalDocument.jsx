import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import InstitutionalLayout from './InstitutionalLayout'

export default function LegalDocument({ page }) {
  const { t, i18n } = useTranslation('institutional')
  const sections = t(`${page}.sections`, { returnObjects: true })
  const updated = new Intl.DateTimeFormat(i18n.resolvedLanguage || i18n.language, { dateStyle: 'long', timeZone: 'UTC' })
    .format(new Date('2026-10-08T12:00:00Z'))
  return (
    <InstitutionalLayout page={page}>
      <p className="institutional-updated">{t('updated', { date: updated })}</p>
      <div className="institutional-prose">
        {Object.entries(sections).map(([key, section]) => (
          <section key={key} aria-labelledby={`legal-${key}`}>
            <h2 id={`legal-${key}`}>{section.title}</h2>
            {section.body && <p>{section.body}</p>}
            {section.items && <ul>{Object.entries(section.items).map(([itemKey, item]) => <li key={itemKey}>{item}</li>)}</ul>}
            {page === 'privacy' && key === 'rights' && <a href="https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados/direito-dos-titulares">{t('rightsLink')}</a>}
          </section>
        ))}
        <section>
          <h2>{t('contact.title')}</h2>
          <p>{t('legalContact')}</p>
          <Link to="/contato">{t('contactLink')}</Link>
        </section>
      </div>
    </InstitutionalLayout>
  )
}
