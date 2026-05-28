import './styles/EmpresaPerfil.css'

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FaBriefcase,
  FaBuilding,
  FaCalendarAlt,
  FaCheckCircle,
  FaEdit,
  FaExternalLinkAlt,
  FaMapMarkerAlt,
  FaSave,
  FaUsers
} from 'react-icons/fa'

import PageLoader from '../../components/ui/PageLoader'
import { listarCandidatosPorEmpresa } from '../../services/firestoreCandidatos'
import { getFirebaseUid } from '../../services/firebaseIdentity'
import { atualizarPerfilUsuario } from '../../services/firestoreUsers'
import { listarVagasPorEmpresa } from '../../services/firestoreVagas'
import { useToast } from '../../hooks/useToast'

const emptyValue = 'Nao informado'

const getInitialForm = (empresa) => ({
  nomeEmpresa: empresa?.nomeEmpresa || '',
  telefone: empresa?.telefone || '',
  site: empresa?.site || '',
  setor: empresa?.setor || '',
  tamanho: empresa?.tamanho || '',
  endereco: empresa?.endereco || ''
})

const formatDate = (value) => {
  if (!value) return emptyValue
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return emptyValue

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).replace('.', '')
}

const isActiveJob = (vaga) => {
  const status = String(vaga.status || vaga.situacao || 'ativa').toLowerCase()
  return !['encerrada', 'cancelada', 'fechada', 'inativa'].includes(status)
}

function EmpresaPerfil({ empresa, onUserUpdate }) {
  const toast = useToast()
  const empresaUid = getFirebaseUid(empresa)
  const [vagas, setVagas] = useState([])
  const [candidatos, setCandidatos] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(() => getInitialForm(empresa))

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
        toast.error('Nao foi possivel carregar os dados do perfil da empresa.')
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchProfileData()

    return () => {
      active = false
    }
  }, [empresaUid, toast])

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
      toast.warning('Perfil sem UID do Firebase. Entre novamente antes de salvar.')
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
      toast.success('Perfil da empresa atualizado.')
    } catch {
      toast.error('Nao foi possivel salvar o perfil da empresa.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <PageLoader label="Carregando perfil da empresa..." />
  }

  const companyInitial = (empresa?.nomeEmpresa || empresa?.nome || 'S').charAt(0).toUpperCase()
  const recentJobs = vagas.slice(0, 4)
  const recentCandidates = candidatos.slice(0, 4)

  return (
    <section className="empresa-profile">
      <header className="profile-page-header">
        <span>PERFIL CORPORATIVO</span>
        <h1>Perfil da Empresa</h1>
        <p>Gerencie a identidade e as informacoes corporativas da sua organizacao na plataforma Selectio.</p>
      </header>

      <section className="empresa-profile-hero">
        <div className="empresa-profile-avatar">{companyInitial}</div>
        <div>
          <span>{empresa?.setor || 'Organizacao Selectio'}</span>
          <h2>{empresa?.nomeEmpresa || emptyValue}</h2>
          <p>Na plataforma desde {formatDate(empresa?.criadoEm)}</p>
        </div>
        <div className="empresa-profile-actions">
          <button type="button" onClick={() => setEditing((current) => !current)}>
            <FaEdit /> {editing ? 'Cancelar edicao' : 'Editar informacoes'}
          </button>
          <button type="button" className="ghost" disabled>
            <FaExternalLinkAlt /> Ver perfil publico
          </button>
        </div>
      </section>

      {editing && (
        <form className="empresa-profile-form" onSubmit={handleSave}>
          <ProfileField label="Nome da empresa" name="nomeEmpresa" value={form.nomeEmpresa} onChange={handleChange} />
          <ProfileField label="Telefone" name="telefone" value={form.telefone} onChange={handleChange} />
          <ProfileField label="Site" name="site" value={form.site} onChange={handleChange} />
          <ProfileField label="Setor" name="setor" value={form.setor} onChange={handleChange} />
          <ProfileField label="Tamanho" name="tamanho" value={form.tamanho} onChange={handleChange} />
          <ProfileField label="Endereco" name="endereco" value={form.endereco} onChange={handleChange} />
          <button type="submit" disabled={saving}>
            <FaSave /> {saving ? 'Salvando...' : 'Salvar alteracoes'}
          </button>
        </form>
      )}

      <section className="empresa-profile-metrics">
        <MetricCard icon={FaBriefcase} label="Vagas publicadas" value={metrics.vagasPublicadas} />
        <MetricCard icon={FaCheckCircle} label="Vagas ativas" value={metrics.vagasAtivas} />
        <MetricCard icon={FaUsers} label="Candidatos recebidos" value={metrics.candidatosRecebidos} />
        <MetricCard icon={FaBuilding} label="Contratados" value={metrics.candidatosContratados} />
        <MetricCard icon={FaCalendarAlt} label="Em entrevista" value={metrics.candidatosEntrevista} />
      </section>

      <section className="empresa-profile-grid">
        <InfoCard title="Contato corporativo" items={[
          ['E-mail', empresa?.email],
          ['Telefone', empresa?.telefone],
          ['Site', empresa?.site]
        ]} />
        <InfoCard title="Dados institucionais" items={[
          ['Razao social', empresa?.razaoSocial],
          ['CNPJ', empresa?.cnpj],
          ['Plano', empresa?.plano || 'Plano nao informado']
        ]} />
        <InfoCard title="Setor e estrutura" items={[
          ['Setor', empresa?.setor],
          ['Tamanho', empresa?.tamanho],
          ['Atualizado em', formatDate(empresa?.atualizadoEm)]
        ]} />
        <InfoCard title="Endereco" icon={FaMapMarkerAlt} items={[
          ['Endereco', empresa?.endereco]
        ]} />
      </section>

      <section className="empresa-profile-lists">
        <RecentList
          title="Ultimas vagas publicadas"
          empty="Nenhuma vaga publicada ainda."
          items={recentJobs.map((vaga) => ({
            title: vaga.titulo || 'Vaga sem titulo',
            meta: `${vaga.area || emptyValue} - ${formatDate(vaga.criadoEm)}`,
            to: `/vaga/${vaga.id}`
          }))}
        />
        <RecentList
          title="Ultimos candidatos recebidos"
          empty="Nenhum candidato recebido ainda."
          items={recentCandidates.map((candidato) => ({
            title: candidato.nome || 'Candidato sem nome',
            meta: `${candidato.vagaTitulo || emptyValue} - ${formatDate(candidato.aplicadoEm)}`,
            badge: candidato.status || 'indicado'
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

function InfoCard({ title, icon: Icon = FaBuilding, items }) {
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
