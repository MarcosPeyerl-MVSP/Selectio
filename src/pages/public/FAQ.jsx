import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import InstitutionalLayout from './InstitutionalLayout'
export default function FAQ() {
  const { t } = useTranslation('institutional')
  const groups = t('faq.groups', { returnObjects: true })
  const [opened, setOpened] = useState({})
  return (
    <InstitutionalLayout page="faq">
      <div className="institutional-faq">
        {Object.entries(groups).map(([groupKey, group]) => (
          <section key={groupKey} aria-labelledby={`faq-group-${groupKey}`}>
            <h2 id={`faq-group-${groupKey}`}>{group.title}</h2>
            {Object.entries(group.questions).map(([key, item]) => {
              const id = `faq-${groupKey}-${key}`
              return (
                <div className="institutional-faq-item" key={id}>
                  <h3><button type="button" id={`${id}-button`} aria-expanded={Boolean(opened[id])} aria-controls={id}
                    onClick={() => setOpened((value) => ({ ...value, [id]: !value[id] }))}>
                    {item.question}<span aria-hidden="true">{opened[id] ? '−' : '+'}</span>
                  </button></h3>
                  <div id={id} hidden={!opened[id]} aria-labelledby={`${id}-button`}>
                    <p>{item.answer}</p>
                    {key === 'policy' && <Link to="/privacidade">{t('contact.privacyLink')}</Link>}
                    {key === 'contact' && <Link to="/contato">{t('contactLink')}</Link>}
                  </div>
                </div>
              )
            })}
          </section>
        ))}
      </div>
    </InstitutionalLayout>
  )
}
