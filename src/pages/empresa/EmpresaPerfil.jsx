import './styles/EmpresaPerfil.css'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  FaBriefcase,
  FaBuilding,
  FaCalendarAlt,
  FaCamera,
  FaCheckCircle,
  FaEdit,
  FaExternalLinkAlt,
  FaMapMarkerAlt,
  FaSave,
  FaTrash,
  FaUsers
} from 'react-icons/fa'

import PageLoader from '../../components/ui/PageLoader'
import AvatarProtegido from '../../components/ui/AvatarProtegido'
import { listarCandidatosPorEmpresa } from '../../services/firestoreCandidatos'
import { getFirebaseUid } from '../../services/identidadeFirebase'
import {
  atualizarFotoPerfilUsuario,
  atualizarPerfilUsuario,
  removerFotoPerfilUsuario
} from '../../services/firestoreUsers'
import { listarVagasPorEmpresa } from '../../services/firestoreVagas'
import { useToast } from '../../hooks/useToast'
import { formatDate as formatLocalizedDate } from '../../i18n/formatters'
import { formatCompanyIndustry, formatCompanySize } from '../../i18n/domainFormatters'

const getInitialForm = (empresa) => ({
  nomeEmpresa: empresa?.nomeEmpresa || '',
  telefone: empresa?.telefone || '',
  site: empresa?.site || '',
  setor: empresa?.setor || '',
  tamanho: empresa?.tamanho || '',
  endereco: empresa?.endereco || ''
})

const formatDate = (value, fallback) => formatLocalizedDate(value, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }) || fallback

const isActiveJob = (vaga) => {
  const status = String(vaga.status || vaga.situacao || 'ativa').toLowerCase()
  return !['encerrada', 'cancelada', 'fechada', 'inativa'].includes(status)
}

function EmpresaPerfil({ empresa, onUserUpdate }) {
  const { t } = useTranslation(['company', 'common'])
  const toast = useToast()
  const empresaUid = getFirebaseUid(empresa)
  const [vagas, setVagas] = useState([])
  const [candidatos, setCandidatos] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingPhoto, setSavingPhoto] = useState(false)
  const photoInputRef = useRef(null)
  const [form, setForm] = useState(() => getInitialForm(empresa))
  const emptyValue = t('profile.notProvided')

  useEffect(() => {
    let active = true

    const fetchProfileData = async () => {
      if (!empresaUid) {
        setLoading(false)
        return
      }

      try {
        const [vagasData, candidatosData] = await Promise.all([
          listarVagasPorEmpresa(empresaUid),
          listarCandidatosPorEmpresa(empresaUid)
        ])

        if (!active) return
        setVagas(vagasData)
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
  }, [empresaUid, t, toast])

  const metrics = useMemo(() => {
    const contratados = candidatos.filter((candidato) => candidato.status === 'contratado').length
    const emEntrevista = candidatos.filter((candidato) => candidato.status === 'entrevista').length

    return {
      vagasPublicadas: vagas.length,
      vagasAtivas: vagas.filter(isActiveJob).length,
      candidatosRecebidos: candidatos.length,
      candidatosContratados: contratados,
      candidatosEntrevista: emEntrevista
    }
  }, [candidatos, vagas])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSave = async (event) => {
    event.preventDefault()

    if (!empresaUid) {
      toast.warning(t('profile.missingUid'))
      return
    }

    try {
      setSaving(true)
      const updatedFields = await atualizarPerfilUsuario({
        uid: empresaUid,
        tipo: 'empresa',
        dados: form
      })
      const updatedEmpresa = {
        ...empresa,
        ...updatedFields,
        id: empresa?.id || empresaUid,
        uid: empresaUid,
        firebaseUid: empresaUid
      }

      localStorage.setItem('empresaUser', JSON.stringify(updatedEmpresa))
      onUserUpdate?.(updatedEmpresa)
      setEditing(false)
      toast.success(t('profile.saved'))
    } catch {
      toast.error(t('profile.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const updateLocalPhoto = (fotoPerfil) => {
    const updatedEmpresa = { ...empresa, fotoPerfil }
    localStorage.setItem('empresaUser', JSON.stringify(updatedEmpresa))
    onUserUpdate?.(updatedEmpresa)
  }

  const handlePhoto = async (event) => {
    const arquivo = event.target.files?.[0]
    event.target.value = ''
    if (!arquivo || !empresaUid) return

    try {
      setSavingPhoto(true)
      const fotoPerfil = await atualizarFotoPerfilUsuario({
        uid: empresaUid,
        tipo: 'empresa',
        arquivo,
        fotoAtual: empresa?.fotoPerfil
      })
      updateLocalPhoto(fotoPerfil)
      toast.success(t('common:profilePhoto.updated'))
    } catch (error) {
      toast.error(error?.message || t('common:profilePhoto.updateError'))
    } finally {
      setSavingPhoto(false)
    }
  }

  const handleRemovePhoto = async () => {
    if (!empresaUid || !empresa?.fotoPerfil?.caminho) return
    try {
      setSavingPhoto(true)
      await removerFotoPerfilUsuario({ uid: empresaUid, tipo: 'empresa', fotoAtual: empresa.fotoPerfil })
      updateLocalPhoto({})
      toast.success(t('common:profilePhoto.removed'))
    } catch {
      toast.error(t('common:profilePhoto.removeError'))
    } finally {
      setSavingPhoto(false)
    }
  }

  if (loading) {
    return <PageLoader label={t('profile.loading')} />
  }

  const companyInitial = (empresa?.nomeEmpresa || empresa?.nome || 'S').charAt(0).toUpperCase()
  const recentJobs = vagas.slice(0, 4)
  const recentCandidates = candidatos.slice(0, 4)

  return (
    <section className="empresa-profile">
      <header className="profile-page-header">
        <span>{t('profile.eyebrow')}</span>
        <h1>{t('profile.title')}</h1>
        <p>{t('profile.description')}</p>
      </header>

      <section className="empresa-profile-hero">
        <AvatarProtegido
          className="empresa-profile-avatar"
          foto={empresa?.fotoPerfil}
          alt={empresa?.nomeEmpresa || t('profile.title')}
          fallback={companyInitial}
        />
        <div>
          <span>{formatCompanyIndustry(empresa?.setor, t) || t('profile.defaultOrganization')}</span>
          <h2>{empresa?.nomeEmpresa || emptyValue}</h2>
          <p>{t('profile.memberSince', { date: formatDate(empresa?.criadoEm, emptyValue) })}</p>
        </div>
        <div className="empresa-profile-actions">
          <input ref={photoInputRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhoto} />
          <button type="button" disabled={savingPhoto} onClick={() => photoInputRef.current?.click()}>
            <FaCamera /> {savingPhoto ? t('common:profilePhoto.saving') : t('common:profilePhoto.change')}
          </button>
          {empresa?.fotoPerfil?.caminho && (
            <button type="button" className="ghost" disabled={savingPhoto} onClick={handleRemovePhoto}>
              <FaTrash /> {t('common:profilePhoto.remove')}
            </button>
          )}
          <button type="button" onClick={() => setEditing((current) => !current)}>
            <FaEdit /> {editing ? t('profile.cancelEdit') : t('profile.edit')}
          </button>
          <button type="button" className="ghost" disabled>
            <FaExternalLinkAlt /> {t('profile.viewPublic')}
          </button>
        </div>
      </section>

      {editing && (
        <form className="empresa-profile-form" onSubmit={handleSave}>
          <ProfileField label={t('profile.companyName')} name="nomeEmpresa" value={form.nomeEmpresa} onChange={handleChange} />
          <ProfileField label={t('profile.phone')} name="telefone" value={form.telefone} onChange={handleChange} />
          <ProfileField label="Site" name="site" value={form.site} onChange={handleChange} />
          <ProfileField label={t('profile.sector')} name="setor" value={form.setor} onChange={handleChange} />
          <ProfileField label={t('profile.size')} name="tamanho" value={form.tamanho} onChange={handleChange} />
          <ProfileField label={t('profile.address')} name="endereco" value={form.endereco} onChange={handleChange} />
          <button type="submit" disabled={saving}>
            <FaSave /> {saving ? t('profile.saving') : t('profile.save')}
          </button>
        </form>
      )}

      <section className="empresa-profile-metrics">
        <MetricCard icon={FaBriefcase} label={t('profile.publishedJobs')} value={metrics.vagasPublicadas} />
        <MetricCard icon={FaCheckCircle} label={t('profile.activeJobs')} value={metrics.vagasAtivas} />
        <MetricCard icon={FaUsers} label={t('profile.candidatesReceived')} value={metrics.candidatosRecebidos} />
        <MetricCard icon={FaBuilding} label={t('profile.hired')} value={metrics.candidatosContratados} />
        <MetricCard icon={FaCalendarAlt} label={t('profile.inInterview')} value={metrics.candidatosEntrevista} />
      </section>

      <section className="empresa-profile-grid">
        <InfoCard title={t('profile.corporateContact')} emptyValue={emptyValue} items={[
          [t('profile.email'), empresa?.email],
          [t('profile.phone'), empresa?.telefone],
          ['Site', empresa?.site]
        ]} />
        <InfoCard title={t('profile.institutionalData')} emptyValue={emptyValue} items={[
          [t('profile.legalName'), empresa?.razaoSocial],
          ['CNPJ', empresa?.cnpj],
          [t('profile.plan'), empresa?.plano || t('profile.planNotProvided')]
        ]} />
        <InfoCard title={t('profile.sectorStructure')} emptyValue={emptyValue} items={[
          [t('profile.sector'), formatCompanyIndustry(empresa?.setor, t)],
          [t('profile.size'), formatCompanySize(empresa?.tamanho, t)],
          [t('profile.updatedAt'), formatDate(empresa?.atualizadoEm, emptyValue)]
        ]} />
        <InfoCard title={t('profile.address')} icon={FaMapMarkerAlt} emptyValue={emptyValue} items={[
          [t('profile.address'), empresa?.endereco]
        ]} />
      </section>

      <section className="empresa-profile-lists">
        <RecentList
          title={t('profile.recentJobs')}
          empty={t('profile.noJobs')}
          items={recentJobs.map((vaga) => ({
            title: vaga.titulo || t('profile.untitledJob'),
            meta: `${vaga.area || emptyValue} - ${formatDate(vaga.criadoEm, emptyValue)}`,
            to: `/vaga/${vaga.id}`
          }))}
        />
        <RecentList
          title={t('profile.recentCandidates')}
          empty={t('profile.noCandidates')}
          items={recentCandidates.map((candidato) => ({
            title: candidato.nome || t('profile.unnamedCandidate'),
            meta: `${candidato.vagaTitulo || emptyValue} - ${formatDate(candidato.aplicadoEm, emptyValue)}`,
            badge: t(`common:statuses.candidates.${candidato.status || 'indicado'}`, { defaultValue: candidato.status || t('common:statuses.candidates.indicado') })
          }))}
        />
      </section>
    </section>
  )
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

function InfoCard({ title, icon: Icon = FaBuilding, items, emptyValue }) {
  return (
    <article className="empresa-info-card">
      <div>
        <Icon />
        <h3>{title}</h3>
      </div>
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

function RecentList({ title, empty, items }) {
  return (
    <article className="empresa-recent-card">
      <h3>{title}</h3>
      {items.length ? (
        <div>
          {items.map((item) => (
            item.to ? (
              <Link key={`${item.title}-${item.meta}`} to={item.to}>
                <strong>{item.title}</strong>
                <span>{item.meta}</span>
              </Link>
            ) : (
              <div key={`${item.title}-${item.meta}`}>
                <strong>{item.title}</strong>
                <span>{item.meta}</span>
                {item.badge && <em>{item.badge}</em>}
              </div>
            )
          ))}
        </div>
      ) : (
        <p>{empty}</p>
      )}
    </article>
  )
}

export default EmpresaPerfil
