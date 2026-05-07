import './Indicar.css'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  FaBold,
  FaCheckCircle,
  FaCloudUploadAlt,
  FaExclamationCircle,
  FaFilePdf,
  FaItalic,
  FaLink,
  FaSearch,
} from 'react-icons/fa'
import Navbar from '../../../components/Navbar/Navbar/Navbar'
import Sidebar from '../../../components/Sidebar/Sidebar'
import Footer from '../../../components/Footer/Footer'

const initialForm = {
  nome: '',
  email: '',
  dataNascimento: '',
  genero: '',
  telefone: '',
  cargoAtual: '',
  anosExperiencia: '',
  escolaridade: '',
  proficienciaIdiomas: '',
  linkedin: '',
  portfolio: '',
  github: '',
  pontosFortes: '',
  fitCultural: '',
  destaquesProjetos: '',
  narrativa: '',
  hardSkills: ['Figma', 'React'],
  softSkills: ['Lideranca', 'Comunicacao'],
  expectativaSalarial: '',
  modeloTrabalho: '',
  avisoPrevio: '',
  curriculoNome: ''
}

const formatCurrency = (value) => {
  const numbers = value.replace(/\D/g, '')
  if (!numbers) return ''

  return Number(numbers).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

const formatPhone = (value) => {
  const numbers = value.replace(/\D/g, '').slice(0, 11)

  if (numbers.length <= 2) return numbers
  if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
  if (numbers.length <= 10) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`
  }

  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`
}

function getIndicador() {
  const stored = localStorage.getItem('indicadorUser')
  if (!stored) return null

  try {
    return JSON.parse(stored)
  } catch {
    localStorage.removeItem('indicadorUser')
    return null
  }
}

function Indicar() {
  const { vagaId } = useParams()
  const navigate = useNavigate()
  const [indicador] = useState(getIndicador)
  const [vaga, setVaga] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const fetchVaga = async () => {
      if (!indicador) return

      try {
        const response = await fetch(`http://localhost:3333/vagas/${vagaId}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.erro || 'Vaga nao encontrada')
        }

        setVaga(data)
      } catch (err) {
        setMessage(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchVaga()
  }, [indicador, vagaId])

  if (!indicador) {
    return <Navigate to={`/login?redirect=/indicar/${vagaId}`} replace />
  }

  const updateField = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const updateCurrencyField = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: formatCurrency(value) }))
  }

  const updatePhoneField = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: formatPhone(value) }))
  }

  const removeSkill = (type, skill) => {
    setForm((current) => ({
      ...current,
      [type]: current[type].filter((item) => item !== skill)
    }))
  }

  const addSkill = (event, type) => {
    if (event.key !== 'Enter') return
    event.preventDefault()

    const value = event.currentTarget.value.trim()
    if (!value) return

    setForm((current) => ({
      ...current,
      [type]: current[type].includes(value) ? current[type] : [...current[type], value]
    }))
    event.currentTarget.value = ''
  }

  const handleFile = (event) => {
    const file = event.target.files?.[0]
    setForm((current) => ({ ...current, curriculoNome: file?.name || '' }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      const response = await fetch('http://localhost:3333/candidatos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          indicadorId: indicador.id,
          vagaId
        })
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.erro || 'Erro ao finalizar indicacao')
      }

      navigate(`/vaga/${vagaId}`)
    } catch (err) {
      setMessage(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Navbar />

      <div className="indicar-layout">
        <Sidebar type="indicador" user={indicador} />

        <main className="indicar-page">
          <header className="indicar-header">
            <span>Fluxo de indicacao</span>
            <h1>Indicar um<br />Novo Candidato</h1>
            <Link to={`/vaga/${vagaId}`}>Voltar para vaga selecionada</Link>
            {vaga && <p>{vaga.titulo} - {vaga.empresa}</p>}
          </header>

          {loading ? (
            <p className="indicar-feedback">Carregando vaga...</p>
          ) : (
            <form className="indicar-form" onSubmit={handleSubmit}>
              <div className="indicar-main">
                <section className="form-section">
                  <h2>Dados Pessoais</h2>
                  <div className="form-grid">
                    <Field label="Nome completo" name="nome" value={form.nome} onChange={updateField} placeholder="Ex: Joao da Silva" required />
                    <Field label="E-mail" name="email" type="email" value={form.email} onChange={updateField} placeholder="joao@exemplo.com" required />
                    <Field label="Data de nascimento" name="dataNascimento" type="date" value={form.dataNascimento} onChange={updateField} />
                    <SelectField label="Genero (opcional)" name="genero" value={form.genero} onChange={updateField} options={['Feminino', 'Masculino', 'Outro', 'Prefiro nao informar']} />
                    <Field
                      label="Telefone"
                      name="telefone"
                      value={form.telefone}
                      onChange={updatePhoneField}
                      placeholder="(11) 98765-4321"
                      inputMode="tel"
                    />
                  </div>
                </section>

                <section className="form-section">
                  <h2>Perfil Profissional</h2>
                  <div className="form-grid">
                    <Field label="Cargo atual" name="cargoAtual" value={form.cargoAtual} onChange={updateField} placeholder="Ex: Senior UX Designer" />
                    <Field label="Anos de experiencia" name="anosExperiencia" value={form.anosExperiencia} onChange={updateField} placeholder="Ex: 5" />
                    <SelectField label="Nivel de escolaridade" name="escolaridade" value={form.escolaridade} onChange={updateField} options={['Ensino medio', 'Tecnico', 'Superior', 'Pos-graduacao', 'Mestrado', 'Doutorado']} />
                    <Field label="Proficiencia em idiomas" name="proficienciaIdiomas" value={form.proficienciaIdiomas} onChange={updateField} placeholder="Ingles (Avancado), Espanhol (Basico)..." />
                  </div>
                </section>

                <section className="form-section">
                  <h2>Links & Redes Sociais</h2>
                  <div className="form-grid">
                    <Field label="LinkedIn profile URL" name="linkedin" value={form.linkedin} onChange={updateField} placeholder="linkedin.com/in/perfil" />
                    <Field label="Portfolio URL" name="portfolio" value={form.portfolio} onChange={updateField} placeholder="behance.net/perfil ou seudominio.com" />
                    <Field className="full-field" label="Github / Behance (opcional)" name="github" value={form.github} onChange={updateField} placeholder="Links adicionais de repositorios ou portfolios" />
                  </div>
                </section>

                <section className="form-section">
                  <h2>Por que indicar?</h2>
                  <Textarea label="Principais pontos fortes" name="pontosFortes" value={form.pontosFortes} onChange={updateField} placeholder="Quais as maiores fortalezas deste candidato?" />
                  <Textarea label="Fit cultural com a Selectio" name="fitCultural" value={form.fitCultural} onChange={updateField} placeholder="Por que ele se daria bem com nossa cultura?" />
                  <Textarea label="Destaques em projetos" name="destaquesProjetos" value={form.destaquesProjetos} onChange={updateField} placeholder="Mencione projetos relevantes que ele entregou..." />

                  <label className="field-label full-field">
                    Narrativa completa da indicacao
                    <div className="editor-toolbar">
                      <FaBold />
                      <FaItalic />
                      <FaLink />
                    </div>
                    <textarea
                      className="large-textarea"
                      name="narrativa"
                      value={form.narrativa}
                      onChange={updateField}
                      placeholder="Uma visao geral do motivo da indicacao..."
                    />
                  </label>
                </section>

                <section className="form-section">
                  <h2>Habilidades & Expertise</h2>
                  <p className="skill-help">Digite uma habilidade e pressione Enter para criar tokens.</p>
                  <SkillInput label="Hard skills (competencias tecnicas)" skills={form.hardSkills} onRemove={(skill) => removeSkill('hardSkills', skill)} onAdd={(event) => addSkill(event, 'hardSkills')} />
                  <SkillInput label="Soft skills (competencias interpessoais)" skills={form.softSkills} onRemove={(skill) => removeSkill('softSkills', skill)} onAdd={(event) => addSkill(event, 'softSkills')} />
                </section>

                <section className="form-section">
                  <h2>Preferencias</h2>
                  <div className="form-grid three-columns">
                    <Field
                      label="Expectativa salarial"
                      name="expectativaSalarial"
                      value={form.expectativaSalarial}
                      onChange={updateCurrencyField}
                      placeholder="R$ 8.000"
                      inputMode="numeric"
                    />
                    <SelectField label="Modelo de trabalho" name="modeloTrabalho" value={form.modeloTrabalho} onChange={updateField} options={['Remoto', 'Hibrido', 'Presencial']} />
                    <SelectField label="Aviso previo" name="avisoPrevio" value={form.avisoPrevio} onChange={updateField} options={['Imediato', '15 dias', '30 dias', '45 dias', '60 dias']} />
                  </div>

                  <label className={`upload-box ${form.curriculoNome ? 'has-file' : ''}`}>
                    {form.curriculoNome ? <FaFilePdf /> : <FaCloudUploadAlt />}
                    <strong>
                      {form.curriculoNome ? 'Arquivo anexado' : (
                        <>Arraste seu arquivo aqui ou <span>clique para buscar</span></>
                      )}
                    </strong>
                    <small>
                      {form.curriculoNome ? (
                        <>
                          <FaCheckCircle /> {form.curriculoNome}
                        </>
                      ) : (
                        'PDF, DOCX ou RTF (Max. 10MB)'
                      )}
                    </small>
                    <input type="file" accept=".pdf,.doc,.docx,.rtf" onChange={handleFile} />
                  </label>
                </section>

                {message && (
                  <div className="indicar-alert" role="alert">
                    <FaExclamationCircle />
                    <div>
                      <strong>Nao foi possivel finalizar a indicacao</strong>
                      <p>{message}</p>
                    </div>
                  </div>
                )}

                <div className="form-actions">
                  <button type="button" className="draft-button">Salvar como Rascunho</button>
                  <button type="submit" className="submit-button" disabled={saving}>
                    {saving ? 'Finalizando...' : 'Finalizar Indicacao'}
                  </button>
                </div>
              </div>

              <aside className="saved-candidate-card">
                <div className="saved-icon">
                  <FaSearch />
                </div>
                <h2>Adicionar candidato ja pre-salvo</h2>
                <p>Selecione um talento da sua base de indicacoes anteriores para agilizar o processo.</p>
                <label>
                  Selecionar candidato
                  <select>
                    <option>Escolha na lista...</option>
                  </select>
                </label>
              </aside>
            </form>
          )}
        </main>
      </div>

      <Footer />
    </>
  )
}

function Field({ className = '', label, ...props }) {
  return (
    <label className={`field-label ${className}`}>
      {label}
      <input {...props} />
    </label>
  )
}

function SelectField({ label, options, ...props }) {
  return (
    <label className="field-label">
      {label}
      <select {...props}>
        <option value="">Selecione</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  )
}

function Textarea({ label, ...props }) {
  return (
    <label className="field-label full-field">
      {label}
      <textarea {...props} />
    </label>
  )
}

function SkillInput({ label, skills, onRemove, onAdd }) {
  return (
    <label className="field-label full-field">
      {label}
      <div className="skill-input">
        {skills.map((skill) => (
          <button type="button" key={skill} onClick={() => onRemove(skill)}>
            {skill} x
          </button>
        ))}
        <input onKeyDown={onAdd} placeholder="Pressione enter para adicionar..." />
      </div>
    </label>
  )
}

export default Indicar
