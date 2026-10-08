import { useTranslation } from 'react-i18next'
import InstitutionalLayout from './InstitutionalLayout'
const members = [
  { key: 'kalil', name: 'Kalil Mitre Tayar Barreto', initials: 'KB' },
  { key: 'marcos', name: 'Marcos Vinícios Souza Peyerl', initials: 'MP' },
  { key: 'gustavo', name: 'Gustavo de Amorim Andrade', initials: 'GA' },
]
export default function Equipe() {
  const { t } = useTranslation('institutional')
  return (
    <InstitutionalLayout page="team">
      <section className="institutional-team" aria-label={t('team.membersLabel')}>
        {members.map((member) => (
          <article key={member.key}>
            <span className="institutional-initials" aria-hidden="true">{member.initials}</span>
            <h2>{member.name}</h2>
            <p className="institutional-role">{t(`team.members.${member.key}.role`)}</p>
            <p>{t(`team.members.${member.key}.description`)}</p>
          </article>
        ))}
      </section>
      <section className="institutional-prose"><h2>{t('team.purposeTitle')}</h2><p>{t('team.purpose')}</p></section>
    </InstitutionalLayout>
  )
}
