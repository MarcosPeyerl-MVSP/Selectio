import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import InstitutionalLayout from './InstitutionalLayout'
export default function Contato() {
  const { t } = useTranslation('institutional')
  const topics = t('contact.topics', { returnObjects: true })
  return (
    <InstitutionalLayout page="contact">
      <section className="institutional-prose">
        <h2>{t('contact.topicsTitle')}</h2>
        <ul>{Object.entries(topics).map(([key, topic]) => <li key={key}>{topic}</li>)}</ul>
      </section>
      <section className="institutional-notice" aria-labelledby="contact-channel">
        <h2 id="contact-channel">{t('contact.channelTitle')}</h2>
        <p>{t('contact.channelBody')}</p><p>{t('contact.sensitiveData')}</p>
      </section>
      <div className="institutional-actions">
        <Link className="btn-primary" to="/faq">{t('contact.faqLink')}</Link>
        <Link className="btn-secondary" to="/privacidade">{t('contact.privacyLink')}</Link>
      </div>
    </InstitutionalLayout>
  )
}
