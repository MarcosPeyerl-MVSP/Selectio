import './styles/IndicadorPerfil.css'

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FaAward,
  FaBriefcase,
  FaCheckCircle,
  FaExternalLinkAlt,
  FaIdCard,
  FaLinkedin,
  FaSave,
  FaUserTie
} from 'react-icons/fa'

import PageLoader from '../../components/ui/PageLoader'
import { auth } from '../../services/firebase'
import { listarCandidatosPorIndicador } from '../../services/firestoreCandidatos'
import { getFirebaseUid } from '../../services/identidadeFirebase'
import { listarIndicacoesPorIndicador } from '../../services/firestoreIndicacoes'
import { atualizarPerfilUsuario } from '../../services/firestoreUsers'
import { useToast } from '../../hooks/useToast'
import { formatDate, formatPercent } from '../../i18n/formatters'

const getInitialForm = (indicador) => ({
  nome: indicador?.nome || '',
  telefone: indicador?.telefone || '',
  pix: indicador?.pix || '',
  linkedin: indicador?.linkedin || '',
  portfolio: indicador?.portfolio || '',
  especialidades: Array.isArray(indicador?.especialidades)
    ? indicador.especialidades.join(', ')
    : indicador?.especialidades || ''
})

const splitSpecialties = (value) => String(value || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

function IndicadorPerfil({ user, onUserUpdate }) {
  const { t } = useTranslation(['referrer', 'common'])
  const toast = useToast()
  const indicadorUid = getFirebaseUid(user)
  const [indicacoes, setIndicacoes] = useState([])
  const [candidatos, setCandidatos] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(() => getInitialForm(user))
  const emailVerified = Boolean(auth.currentUser?.emailVerified)
  const emptyValue = t('profile.notProvided')
  const formatProfileDate = (value) => formatDate(value, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }) || emptyValue

  useEffect(() => {
    let active = true

    const fetchProfileData = async () => {
      if (!indicadorUid) {
        setLoading(false)
        return
      }

      try {
        const [indicacoesData, candidatosData] = await Promise.all([
          listarIndicacoesPorIndicador(indicadorUid),
          listarCandidatosPorIndicador(indicadorUid)
        ])

        if (!active) return
        setIndicacoes(indicacoesData)
        setCandidatos(candidatosData)
      } catch {
        toast.error(t('profile.loadError'))
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchProfileData()

    return () => {
      active = false
    }
  }, [indicadorUid, t, toast])

  const metrics = useMemo(() => {
    const total = indicacoes.length || candidatos.length
    const source = indicacoes.length ? indicacoes : candidatos
    const contratados = source.filter((item) => item.status === 'contratado').length
    const entrevistas = source.filter((item) => item.status === 'entrevista').length
    const canceladas = source.filter((item) => ['cancelado', 'recusado'].includes(item.status)).length
    const andamento = source.filter((item) => !['contratado', 'cancelado', 'recusado'].includes(item.status)).length

    return {
      totalIndicacoes: total,
      contratados,
      entrevistas,
      canceladas,
      andamento,
      taxaConversao: total ? Number(((contratados * 100) / total).toFixed(1)) : 0
    }
  }, [candidatos, indicacoes])

  const specialties = Array.isArray(user?.especialidades)
    ? user.especialidades
    : splitSpecialties(user?.especialidades)

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSave = async (event) => {
    event.preventDefault()

    if (!indicadorUid) {
      toast.warning(t('profile.missingUid'))
      return
    }

    const payload = {
      ...form,
      especialidades: splitSpecialties(form.especialidades)
    }

    try {
      setSaving(true)
      const updatedFields = await atualizarPerfilUsuario({
        uid: indicadorUid,
        tipo: 'indicador',
        dados: payload
      })
      const updatedUser = {
        ...user,
        ...updatedFields,
        id: user?.id || indicadorUid,
        uid: indicadorUid,
        firebaseUid: indicadorUid
      }

      localStorage.setItem('indicadorUser', JSON.stringify(updatedUser))
      onUserUpdate?.(updatedUser)
      setEditing(false)
      toast.success(t('profile.saved'))
    } catch {
      toast.error(t('profile.saveError'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <PageLoader label={t('profile.loading')} />
  }

  const initial = (user?.nome || t('profile.defaultRole')).charAt(0).toUpperCase()
  const recentIndications = (indicacoes.length ? indicacoes : candidatos).slice(0, 5)

  return (
    <section className="indicador-profile">
      <header className="profile-page-header">
        <span>{t('profile.eyebrow')}</span>
        <h1>{t('profile.title')}</h1>
        <p>{t('profile.description')}</p>
      </header>

      <div className="indicador-profile-layout">
        <aside className="indicador-profile-card">
          <div className="indicador-avatar">{initial}</div>
          <h2>{user?.nome || emptyValue}</h2>
          <p>{user?.tituloProfissional || t('profile.defaultRole')}</p>
          {emailVerified && <span className="verified-badge"><FaCheckCircle /> {t('profile.verified')}</span>}
          <div className="indicador-links">
            {user?.linkedin && <a href={formatExternalLink(user.linkedin)} target="_blank" rel="noreferrer"><FaLinkedin /> LinkedIn</a>}
            {user?.portfolio && <a href={formatExternalLink(user.portfolio)} target="_blank" rel="noreferrer"><FaExternalLinkAlt /> Portfolio</a>}
          </div>
          <button type="button" onClick={() => setEditing((current) => !current)}>
            <FaUserTie /> {editing ? t('profile.cancelEdit') : t('profile.edit')}
          </button>
        </aside>

        <main className="indicador-profile-main">
          {editing && (
            <form className="indicador-profile-form" onSubmit={handleSave}>
              <ProfileField label={t('profile.name')} name="nome" value={form.nome} onChange={handleChange} />
              <ProfileField label={t('profile.phone')} name="telefone" value={form.telefone} onChange={handleChange} />
              <ProfileField label="Pix" name="pix" value={form.pix} onChange={handleChange} />
              <ProfileField label="LinkedIn" name="linkedin" value={form.linkedin} onChange={handleChange} />
              <ProfileField label="Portfolio" name="portfolio" value={form.portfolio} onChange={handleChange} />
              <ProfileField label={t('profile.specialties')} name="especialidades" value={form.especialidades} onChange={handleChange} placeholder={t('profile.specialtiesPlaceholder')} />
              <button type="submit" disabled={saving}>
                <FaSave /> {saving ? t('profile.saving') : t('profile.save')}
              </button>
            </form>
          )}

          <section className="indicador-profile-metrics">
            <MetricCard icon={FaAward} label={t('profile.totalReferrals')} value={metrics.totalIndicacoes} />
            <MetricCard icon={FaCheckCircle} label={t('profile.hired')} value={metrics.contratados} />
            <MetricCard icon={FaBriefcase} label={t('profile.conversionRate')} value={formatPercent(metrics.taxaConversao)} />
            <MetricCard icon={FaUserTie} label={t('profile.inProgress')} value={metrics.andamento} />
            <MetricCard icon={FaIdCard} label={t('profile.inInterview')} value={metrics.entrevistas} />
          </section>

          <section className="indicador-profile-grid">
            <InfoCard title={t('profile.personalData')} emptyValue={emptyValue} items={[
              [t('profile.email'), user?.email],
              [t('profile.phone'), user?.telefone],
              [t('profile.cpf'), user?.cpf],
              [t('profile.birthDate'), user?.dataNascimento]
            ]} />
            <InfoCard title={t('profile.paymentLinks')} emptyValue={emptyValue} items={[
              ['Pix', user?.pix],
              ['LinkedIn', user?.linkedin],
              ['Portfolio', user?.portfolio],
              [t('profile.updatedAt'), formatProfileDate(user?.atualizadoEm)]
            ]} />
          </section>

          <section className="indicador-specialties-card">
            <h3>{t('profile.specialties')}</h3>
            {specialties.length ? (
              <div>
                {specialties.map((item) => <span key={item}>{item}</span>)}
              </div>
            ) : (
              <p>{t('profile.noSpecialties')}</p>
            )}
          </section>

          <section className="indicador-empty-card">
            <h3>{t('profile.experience')}</h3>
            <p>{t('profile.noExperience')}</p>
          </section>

          <section className="indicador-recent-card">
            <h3>{t('profile.recentReferrals')}</h3>
            {recentIndications.length ? (
              <div>
                {recentIndications.map((item) => (
                  <article key={item.id}>
                    <strong>{item.candidatoNome || item.nome || t('profile.unnamedCandidate')}</strong>
                    <span>{item.vagaTitulo || emptyValue}</span>
                    <em>{t(`common:statuses.candidates.${item.status || 'indicado'}`, { defaultValue: item.status || t('common:statuses.candidates.indicado') })}</em>
                    <small>{formatProfileDate(item.criadoEm || item.aplicadoEm)}</small>
                  </article>
                ))}
              </div>
            ) : (
              <p>{t('profile.noReferrals')}</p>
            )}
          </section>
        </main>
      </div>
    </section>
  )
}

function formatExternalLink(value) {
  return String(value).startsWith('http') ? value : `https://${value}`
}

function ProfileField({ label, ...props }) {
  return (
    <label>
      {label}
      <input {...props} />
    </label>
  )
}

function MetricCard({ icon: Icon, label, value }) {
  return (
    <article>
      <Icon />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function InfoCard({ title, items, emptyValue }) {
  return (
    <article className="indicador-info-card">
      <h3>{title}</h3>
      <dl>
        {items.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || emptyValue}</dd>
          </div>
        ))}
      </dl>
    </article>
  )
}

export default IndicadorPerfil
