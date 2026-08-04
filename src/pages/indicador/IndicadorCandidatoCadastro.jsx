import './styles/IndicadorCandidatoCadastro.css'

import { Link, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FaCheckCircle,
  FaCloudUploadAlt,
  FaDownload,
  FaExclamationCircle,
  FaFileAlt,
  FaFileCsv,
  FaTimes,
  FaTrash,
  FaUpload,
} from 'react-icons/fa'

import Footer from '../../components/layout/Footer'
import Navbar from '../../components/layout/Navbar'
import Sidebar from '../../components/layout/Sidebar'
import EstadoDados from '../../components/ui/EstadoDados'
import PageLoader from '../../components/ui/PageLoader'
import { useAuth } from '../../hooks/useAuth'
import { useConfirmacao } from '../../hooks/useConfirmacao'
import { useToast } from '../../hooks/useToast'
import {
  atualizarCandidatoPreSalvo,
  buscarCandidatoPreSalvoPorId,
  criarCandidatoPreSalvo,
  importarCandidatosPreSalvos,
} from '../../services/firestoreCandidatosPreSalvos'
import {
  gerarModeloCandidatosCsv,
  MAX_CANDIDATOS_CSV,
  processarCandidatosCsv,
  validarEmailCandidato,
  validarTelefoneCandidato,
} from '../../utils/candidatoCsv'

const MAX_RESUME_SIZE = 10 * 1024 * 1024
const MAX_CSV_FILE_SIZE = 2 * 1024 * 1024
const RESUME_EXTENSIONS = ['pdf', 'doc', 'docx', 'rtf']
const RESUME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/rtf',
  'application/x-rtf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/rtf',
])

const emptyForm = {
  nome: '',
  email: '',
  telefone: '',
  dataNascimento: '',
  genero: '',
  cargoAtual: '',
  anosExperiencia: '',
  escolaridade: '',
  proficienciaIdiomas: '',
  linkedin: '',
  portfolio: '',
  github: '',
  hardSkills: [],
  softSkills: [],
  expectativaSalarial: '',
  modeloTrabalho: '',
  avisoPrevio: '',
  curriculoNome: '',
  curriculoTipo: '',
  curriculoTamanho: 0,
  observacoesProfissionais: '',
}

const textFormFields = Object.keys(emptyForm).filter((key) => !['hardSkills', 'softSkills', 'curriculoTamanho'].includes(key))

const cloneEmptyForm = () => ({ ...emptyForm, hardSkills: [], softSkills: [] })

const toSkillList = (value) => {
  if (Array.isArray(value)) return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))]
  return [...new Set(String(value || '').split(/[|,;]/).map((item) => item.trim()).filter(Boolean))]
}

const mapCandidateToForm = (candidate) => {
  const mapped = cloneEmptyForm()
  textFormFields.forEach((key) => {
    mapped[key] = candidate?.[key] ?? mapped[key]
  })

  mapped.hardSkills = toSkillList(candidate?.hardSkills)
  mapped.softSkills = toSkillList(candidate?.softSkills)
  mapped.curriculoNome = candidate?.curriculoNome || candidate?.curriculo?.nome || ''
  mapped.curriculoTipo = candidate?.curriculoTipo || candidate?.curriculo?.tipo || ''
  mapped.curriculoTamanho = Number(candidate?.curriculoTamanho || candidate?.curriculo?.tamanho || 0)
  return mapped
}

const formatPhone = (value) => {
  const numbers = String(value || '').replace(/\D/g, '').slice(0, 11)
  if (numbers.length <= 2) return numbers
  if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
  if (numbers.length <= 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`
}

const formatCurrency = (value) => {
  const numbers = String(value || '').replace(/\D/g, '')
  if (!numbers) return ''
  return Number(numbers).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

const formatFileSize = (size) => {
  const bytes = Number(size || 0)
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const validateManualForm = (form) => {
  const errors = {}
  const name = String(form.nome || '').trim()
  const email = String(form.email || '').trim()

  if (!name) errors.nome = 'Informe o nome completo.'
  else if (name.length < 2) errors.nome = 'O nome deve ter pelo menos 2 caracteres.'

  if (!email) errors.email = 'Informe o e-mail.'
  else if (!validarEmailCandidato(email)) errors.email = 'Informe um e-mail válido.'

  if (!validarTelefoneCandidato(form.telefone)) {
    errors.telefone = 'Informe um telefone com 10 ou 11 dígitos.'
  }

  return errors
}

const buildManualPayload = (form, origin) => {
  const payload = {}
  Object.keys(emptyForm).forEach((key) => {
    const value = form[key]
    payload[key] = typeof value === 'string' ? value.trim() : value
  })

  return {
    ...payload,
    email: payload.email.toLowerCase(),
    hardSkills: toSkillList(payload.hardSkills),
    softSkills: toSkillList(payload.softSkills),
    curriculoTamanho: Number(payload.curriculoTamanho || 0),
    origem: origin,
  }
}

const getResumeValidationError = (file) => {
  if (!file) return ''
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  const browserType = String(file.type || '').toLowerCase()
  const validType = !browserType
    || browserType === 'application/octet-stream'
    || RESUME_TYPES.has(browserType)

  if (!RESUME_EXTENSIONS.includes(extension) || !validType) {
    return 'Use um arquivo PDF, DOC, DOCX ou RTF.'
  }
  if (file.size > MAX_RESUME_SIZE) return 'O currículo deve ter no máximo 10 MB.'
  return ''
}

function IndicadorCandidatoCadastro() {
  const { candidatoId } = useParams()
  const isEditing = Boolean(candidatoId)
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirmacao()
  const { firebaseUser, perfil, carregando, carregandoPerfil } = useAuth()
  const indicador = perfil?.tipo === 'indicador' ? perfil : null
  const indicadorId = firebaseUser?.uid || ''

  const [activeTab, setActiveTab] = useState('manual')
  const [form, setForm] = useState(cloneEmptyForm)
  const [origin, setOrigin] = useState('manual')
  const [formErrors, setFormErrors] = useState({})
  const [resumeError, setResumeError] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingCandidate, setLoadingCandidate] = useState(isEditing)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const [csvReading, setCsvReading] = useState(false)
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvDragActive, setCsvDragActive] = useState(false)
  const [csvFileName, setCsvFileName] = useState('')
  const [csvError, setCsvError] = useState('')
  const [csvPreview, setCsvPreview] = useState(null)
  const [importResult, setImportResult] = useState(null)
  const csvInputRef = useRef(null)
  const resumeInputRef = useRef(null)

  useEffect(() => {
    if (!isEditing || !indicadorId) return undefined

    let active = true

    const loadCandidate = async () => {
      try {
        setLoadError('')
        const candidate = await buscarCandidatoPreSalvoPorId({ candidatoId, indicadorId })
        if (!candidate) throw new Error('Candidato pré-salvo não encontrado.')
        if (!active) return

        setForm(mapCandidateToForm(candidate))
        setOrigin(candidate.origem || 'manual')
      } catch (error) {
        if (active) setLoadError(error.message || 'Não foi possível carregar o candidato.')
      } finally {
        if (active) setLoadingCandidate(false)
      }
    }

    loadCandidate()
    return () => {
      active = false
    }
  }, [candidatoId, indicadorId, isEditing, reloadKey])

  const handleFieldChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    if (formErrors[name]) {
      setFormErrors((current) => ({ ...current, [name]: '' }))
    }
  }

  const handlePhoneChange = (event) => {
    const value = formatPhone(event.target.value)
    setForm((current) => ({ ...current, telefone: value }))
    if (formErrors.telefone) setFormErrors((current) => ({ ...current, telefone: '' }))
  }

  const handleCurrencyChange = (event) => {
    const value = formatCurrency(event.target.value)
    setForm((current) => ({ ...current, expectativaSalarial: value }))
  }

  const addSkill = (type, value) => {
    const skill = String(value || '').trim()
    if (!skill) return

    setForm((current) => {
      const alreadyExists = current[type].some((item) => item.toLowerCase() === skill.toLowerCase())
      return alreadyExists ? current : { ...current, [type]: [...current[type], skill] }
    })
  }

  const removeSkill = (type, skill) => {
    setForm((current) => ({
      ...current,
      [type]: current[type].filter((item) => item !== skill),
    }))
  }

  const handleResume = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const error = getResumeValidationError(file)

    if (error) {
      setResumeError(error)
      event.target.value = ''
      toast.warning(error)
      return
    }

    setResumeError('')
    setForm((current) => ({
      ...current,
      curriculoNome: file.name,
      curriculoTipo: file.type || `application/${file.name.split('.').pop()?.toLowerCase() || 'octet-stream'}`,
      curriculoTamanho: file.size,
    }))
  }

  const removeResume = () => {
    setForm((current) => ({
      ...current,
      curriculoNome: '',
      curriculoTipo: '',
      curriculoTamanho: 0,
    }))
    setResumeError('')
    if (resumeInputRef.current) resumeInputRef.current.value = ''
  }

  const handleManualSubmit = async (event) => {
    event.preventDefault()
    if (saving) return

    const errors = validateManualForm(form)
    setFormErrors(errors)

    if (Object.keys(errors).length) {
      toast.warning('Revise os campos obrigatórios antes de salvar.')
      const firstInvalidField = Object.keys(errors)[0]
      window.requestAnimationFrame(() => document.querySelector(`[name="${firstInvalidField}"]`)?.focus())
      return
    }

    setSaving(true)
    try {
      const data = buildManualPayload(form, isEditing ? origin : 'manual')

      if (isEditing) {
        await atualizarCandidatoPreSalvo({ candidatoId, dados: data, indicadorId })
        toast.success('Candidato atualizado com sucesso.')
      } else {
        await criarCandidatoPreSalvo({ dados: data, indicadorId })
        toast.success('Candidato pré-salvo com sucesso.')
      }

      navigate('/candidatos/indicador')
    } catch (error) {
      toast.error(error.message || 'Não foi possível salvar o candidato.')
    } finally {
      setSaving(false)
    }
  }

  const resetCsv = () => {
    setCsvFileName('')
    setCsvError('')
    setCsvPreview(null)
    setImportResult(null)
    if (csvInputRef.current) csvInputRef.current.value = ''
  }

  const processCsvFile = async (file) => {
    if (!file) return
    const isCsv = file.name.toLowerCase().endsWith('.csv') || ['text/csv', 'application/vnd.ms-excel'].includes(file.type)

    if (!isCsv) {
      const message = 'Selecione um arquivo no formato CSV.'
      setCsvError(message)
      setCsvPreview(null)
      toast.warning(message)
      return
    }

    if (file.size > MAX_CSV_FILE_SIZE) {
      const message = 'O arquivo CSV deve ter no máximo 2 MB.'
      setCsvError(message)
      setCsvPreview(null)
      toast.warning(message)
      return
    }

    setCsvReading(true)
    setCsvError('')
    setImportResult(null)
    setCsvFileName(file.name)

    try {
      const content = await file.text()
      const preview = processarCandidatosCsv(content)
      setCsvPreview(preview)

      if (preview.errosGerais.length) {
        toast.warning('O CSV possui erros que impedem a importação.')
      }
    } catch (error) {
      setCsvPreview(null)
      setCsvError(error.message || 'Não foi possível ler o arquivo CSV.')
      toast.error('Não foi possível ler o arquivo CSV.')
    } finally {
      setCsvReading(false)
    }
  }

  const handleCsvInput = (event) => {
    processCsvFile(event.target.files?.[0])
  }

  const handleCsvDrop = (event) => {
    event.preventDefault()
    setCsvDragActive(false)
    processCsvFile(event.dataTransfer.files?.[0])
  }

  const downloadCsvModel = () => {
    const content = `\uFEFF${gerarModeloCandidatosCsv()}`
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'modelo-candidatos-selectio.csv'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    toast.info('Modelo CSV baixado.')
  }

  const handleCsvImport = async () => {
    if (csvImporting || !csvPreview?.validos.length || csvPreview.errosGerais.length) return

    const approved = await confirm({
      title: 'Importar candidatos?',
      description: `${csvPreview.validos.length} candidato(s) válido(s) serão adicionados à sua base. Linhas inválidas serão ignoradas.`,
      confirmLabel: 'Importar candidatos',
    })
    if (!approved) return

    setCsvImporting(true)
    try {
      const candidates = csvPreview.validos.map((row) => ({
        linha: row.linha,
        dados: { ...row.dados, origem: 'csv' },
      }))
      const result = await importarCandidatosPreSalvos({ candidatos: candidates, indicadorId })
      const imported = Array.isArray(result?.importados) ? result.importados : []
      const serviceRejected = Array.isArray(result?.rejeitados) ? result.rejeitados : []
      const localRejected = csvPreview.invalidos.map((row) => ({
        linha: row.linha,
        candidato: row.dados,
        motivo: row.erros.join(' '),
      }))
      const rejected = [...localRejected, ...serviceRejected]

      setImportResult({ importados: imported, rejeitados: rejected })
      if (imported.length) {
        toast.success(`${imported.length} candidato(s) importado(s) com sucesso.`)
      } else {
        toast.warning('Nenhum candidato foi importado.')
      }
    } catch (error) {
      toast.error(error.message || 'Não foi possível importar os candidatos.')
    } finally {
      setCsvImporting(false)
    }
  }

  const retryLoad = () => {
    setLoadingCandidate(true)
    setReloadKey((current) => current + 1)
  }

  const authLoading = carregando || carregandoPerfil
  const content = useMemo(() => {
    if (authLoading) return { type: 'loading', message: 'Validando sua sessão...' }
    if (!indicador || !indicadorId) return { type: 'access' }
    if (loadingCandidate) return { type: 'loading', message: 'Carregando candidato...' }
    if (loadError) return { type: 'error' }
    return { type: 'ready' }
  }, [authLoading, indicador, indicadorId, loadError, loadingCandidate])

  return (
    <>
      <Navbar />

      <div className="candidate-registration-layout">
        <Sidebar type="indicador" user={indicador || perfil} />

        <main className="candidate-registration-page">
          <header className="candidate-registration-header">
            <span>Base de talentos</span>
            <h1>{isEditing ? 'Editar candidato' : 'Pré-salvar candidato'}</h1>
            <p>
              {isEditing
                ? 'Atualize os dados do talento sem alterar indicações já enviadas.'
                : 'Cadastre um talento agora e indique-o para uma vaga quando desejar.'}
            </p>
            <Link to="/candidatos/indicador">Voltar para candidatos</Link>
          </header>

          {content.type === 'loading' ? (
            <PageLoader label={content.message} compact />
          ) : content.type === 'access' ? (
            <EstadoDados
              description="Entre com uma conta de indicador para acessar este cadastro."
              title="Cadastro indisponível"
              tone="error"
            />
          ) : content.type === 'error' ? (
            <EstadoDados
              actionLabel="Tentar novamente"
              description={loadError}
              onAction={retryLoad}
              title={navigator.onLine ? 'Não foi possível carregar o candidato' : 'Você está sem conexão'}
              tone={navigator.onLine ? 'error' : 'offline'}
            />
          ) : (
            <section className="candidate-registration-panel">
              <div className="candidate-registration-tabs" role="tablist" aria-label="Forma de cadastro">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'manual'}
                  className={activeTab === 'manual' ? 'active' : ''}
                  onClick={() => setActiveTab('manual')}
                >
                  <FaFileAlt aria-hidden="true" /> Cadastro manual
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'csv'}
                  aria-disabled={isEditing}
                  className={activeTab === 'csv' ? 'active' : ''}
                  disabled={isEditing}
                  title={isEditing ? 'A importação CSV está disponível apenas em novos cadastros.' : undefined}
                  onClick={() => setActiveTab('csv')}
                >
                  <FaFileCsv aria-hidden="true" /> Importar CSV
                </button>
              </div>

              {activeTab === 'manual' ? (
                <ManualCandidateForm
                  form={form}
                  errors={formErrors}
                  resumeError={resumeError}
                  saving={saving}
                  isEditing={isEditing}
                  resumeInputRef={resumeInputRef}
                  onChange={handleFieldChange}
                  onPhoneChange={handlePhoneChange}
                  onCurrencyChange={handleCurrencyChange}
                  onAddSkill={addSkill}
                  onRemoveSkill={removeSkill}
                  onResume={handleResume}
                  onRemoveResume={removeResume}
                  onSubmit={handleManualSubmit}
                />
              ) : (
                <CsvImportPanel
                  csvDragActive={csvDragActive}
                  csvError={csvError}
                  csvFileName={csvFileName}
                  csvImporting={csvImporting}
                  csvInputRef={csvInputRef}
                  csvPreview={csvPreview}
                  csvReading={csvReading}
                  importResult={importResult}
                  onDownloadModel={downloadCsvModel}
                  onDragActive={setCsvDragActive}
                  onDrop={handleCsvDrop}
                  onFileInput={handleCsvInput}
                  onImport={handleCsvImport}
                  onReset={resetCsv}
                />
              )}
            </section>
          )}
        </main>
      </div>

      <Footer />
    </>
  )
}

function ManualCandidateForm({
  errors,
  form,
  isEditing,
  onAddSkill,
  onChange,
  onCurrencyChange,
  onPhoneChange,
  onRemoveResume,
  onRemoveSkill,
  onResume,
  onSubmit,
  resumeError,
  resumeInputRef,
  saving,
}) {
  return (
    <form className="candidate-registration-form" onSubmit={onSubmit} noValidate>
      <FormSection title="Dados pessoais">
        <div className="candidate-registration-grid">
          <Field label="Nome completo" name="nome" value={form.nome} onChange={onChange} error={errors.nome} placeholder="Ex: João da Silva" required autoComplete="name" />
          <Field label="E-mail" name="email" type="email" value={form.email} onChange={onChange} error={errors.email} placeholder="joao@exemplo.com" required autoComplete="email" />
          <Field label="Telefone" name="telefone" value={form.telefone} onChange={onPhoneChange} error={errors.telefone} placeholder="(11) 98765-4321" inputMode="tel" autoComplete="tel" />
          <Field label="Data de nascimento" name="dataNascimento" type="date" value={form.dataNascimento} onChange={onChange} />
          <SelectField label="Gênero (opcional)" name="genero" value={form.genero} onChange={onChange} options={['Feminino', 'Masculino', 'Não binário', 'Outro', 'Prefiro não informar']} />
        </div>
      </FormSection>

      <FormSection title="Perfil profissional">
        <div className="candidate-registration-grid">
          <Field label="Cargo atual" name="cargoAtual" value={form.cargoAtual} onChange={onChange} placeholder="Ex: Desenvolvedor Front-end" />
          <Field label="Anos de experiência" name="anosExperiencia" type="number" min="0" max="80" value={form.anosExperiencia} onChange={onChange} placeholder="Ex: 5" />
          <SelectField label="Escolaridade" name="escolaridade" value={form.escolaridade} onChange={onChange} options={['Ensino fundamental', 'Ensino médio', 'Técnico', 'Superior', 'Pós-graduação', 'Mestrado', 'Doutorado']} />
          <Field label="Idiomas" name="proficienciaIdiomas" value={form.proficienciaIdiomas} onChange={onChange} placeholder="Inglês (Avançado), Espanhol (Básico)" />
        </div>
      </FormSection>

      <FormSection title="Links profissionais">
        <div className="candidate-registration-grid">
          <Field label="LinkedIn" name="linkedin" value={form.linkedin} onChange={onChange} placeholder="linkedin.com/in/perfil" />
          <Field label="Portfólio" name="portfolio" value={form.portfolio} onChange={onChange} placeholder="behance.net/perfil ou seudominio.com" />
          <Field className="full" label="GitHub / Behance" name="github" value={form.github} onChange={onChange} placeholder="Links adicionais de repositórios ou portfólios" />
        </div>
      </FormSection>

      <FormSection title="Habilidades">
        <p className="candidate-registration-help">Digite uma habilidade e pressione Enter ou vírgula para adicioná-la.</p>
        <SkillField label="Hard skills" skills={form.hardSkills} onAdd={(value) => onAddSkill('hardSkills', value)} onRemove={(value) => onRemoveSkill('hardSkills', value)} />
        <SkillField label="Soft skills" skills={form.softSkills} onAdd={(value) => onAddSkill('softSkills', value)} onRemove={(value) => onRemoveSkill('softSkills', value)} />
      </FormSection>

      <FormSection title="Preferências profissionais">
        <div className="candidate-registration-grid three-columns">
          <Field label="Expectativa salarial" name="expectativaSalarial" value={form.expectativaSalarial} onChange={onCurrencyChange} placeholder="R$ 8.000" inputMode="numeric" />
          <SelectField label="Modelo de trabalho" name="modeloTrabalho" value={form.modeloTrabalho} onChange={onChange} options={['Remoto', 'Híbrido', 'Presencial']} />
          <SelectField label="Aviso prévio" name="avisoPrevio" value={form.avisoPrevio} onChange={onChange} options={['Imediato', '15 dias', '30 dias', '45 dias', '60 dias']} />
        </div>
      </FormSection>

      <FormSection title="Currículo e observações">
        <div className={`candidate-registration-resume ${form.curriculoNome ? 'has-file' : ''} ${resumeError ? 'has-error' : ''}`}>
          {form.curriculoNome ? <FaCheckCircle aria-hidden="true" /> : <FaCloudUploadAlt aria-hidden="true" />}
          <div>
            <strong>{form.curriculoNome || 'Anexar currículo'}</strong>
            <p>
              {form.curriculoNome
                ? [form.curriculoTipo, formatFileSize(form.curriculoTamanho)].filter(Boolean).join(' • ')
                : 'PDF, DOC, DOCX ou RTF • máximo de 10 MB'}
            </p>
          </div>
          <label className="candidate-registration-file-button">
            {form.curriculoNome ? 'Substituir' : 'Escolher arquivo'}
            <input ref={resumeInputRef} type="file" accept=".pdf,.doc,.docx,.rtf" onChange={onResume} />
          </label>
          {form.curriculoNome && (
            <button type="button" className="candidate-registration-remove-file" onClick={onRemoveResume} aria-label="Remover currículo">
              <FaTrash aria-hidden="true" />
            </button>
          )}
        </div>
        {resumeError && <p className="candidate-registration-inline-error" role="alert">{resumeError}</p>}
        <TextareaField label="Observações profissionais" name="observacoesProfissionais" value={form.observacoesProfissionais} onChange={onChange} placeholder="Inclua contexto profissional, disponibilidade ou outras informações relevantes." />
      </FormSection>

      {Object.values(errors).some(Boolean) && (
        <div className="candidate-registration-alert" role="alert">
          <FaExclamationCircle aria-hidden="true" />
          <div>
            <strong>Revise os dados informados</strong>
            <p>Existem campos que precisam ser corrigidos antes de salvar.</p>
          </div>
        </div>
      )}

      <div className="candidate-registration-actions">
        <Link to="/candidatos/indicador" className="candidate-registration-secondary-button">Cancelar</Link>
        <button type="submit" className="candidate-registration-primary-button" disabled={saving}>
          {saving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Pré-salvar candidato'}
        </button>
      </div>
    </form>
  )
}

function CsvImportPanel({
  csvDragActive,
  csvError,
  csvFileName,
  csvImporting,
  csvInputRef,
  csvPreview,
  csvReading,
  importResult,
  onDownloadModel,
  onDragActive,
  onDrop,
  onFileInput,
  onImport,
  onReset,
}) {
  const hasBlockingErrors = Boolean(csvPreview?.errosGerais.length)

  return (
    <div className="candidate-csv-panel" role="tabpanel">
      <div className="candidate-csv-intro">
        <div>
          <span>Importação em lote</span>
          <h2>Adicione até {MAX_CANDIDATOS_CSV} candidatos</h2>
          <p>Use o modelo para manter os cabeçalhos corretos. Nome e e-mail são obrigatórios.</p>
        </div>
        <button type="button" className="candidate-registration-secondary-button" onClick={onDownloadModel}>
          <FaDownload aria-hidden="true" /> Baixar modelo CSV
        </button>
      </div>

      {!csvPreview && !csvReading && (
        <label
          className={`candidate-csv-dropzone ${csvDragActive ? 'drag-active' : ''}`}
          onDragEnter={(event) => {
            event.preventDefault()
            onDragActive(true)
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            event.preventDefault()
            if (!event.currentTarget.contains(event.relatedTarget)) onDragActive(false)
          }}
          onDrop={onDrop}
        >
          <FaUpload aria-hidden="true" />
          <strong>Arraste o CSV aqui ou clique para selecionar</strong>
          <small>CSV com vírgula ou ponto-e-vírgula • até 2 MB</small>
          <input ref={csvInputRef} type="file" accept=".csv,text/csv" onChange={onFileInput} />
        </label>
      )}

      {csvReading && <PageLoader label="Lendo e validando o CSV..." compact />}

      {csvError && !csvReading && (
        <EstadoDados
          actionLabel="Selecionar outro arquivo"
          compact
          description={csvError}
          onAction={onReset}
          title="Arquivo CSV inválido"
          tone="error"
        />
      )}

      {csvPreview && !csvReading && (
        <>
          <section className="candidate-csv-summary" aria-label="Resumo do arquivo CSV">
            <div>
              <FaFileCsv aria-hidden="true" />
              <span><strong>{csvFileName}</strong><small>{csvPreview.totalRegistros} registro(s) encontrado(s)</small></span>
            </div>
            <dl>
              <div><dt>Válidos</dt><dd>{csvPreview.validos.length}</dd></div>
              <div><dt>Inválidos</dt><dd>{csvPreview.invalidos.length}</dd></div>
            </dl>
            <button type="button" onClick={onReset} disabled={csvImporting}>Trocar arquivo</button>
          </section>

          {hasBlockingErrors && (
            <div className="candidate-registration-alert" role="alert">
              <FaExclamationCircle aria-hidden="true" />
              <div>
                <strong>Corrija o arquivo antes de importar</strong>
                <ul>{csvPreview.errosGerais.map((error) => <li key={error}>{error}</li>)}</ul>
              </div>
            </div>
          )}

          <div className="candidate-csv-table-wrap">
            <table className="candidate-csv-table">
              <caption className="candidate-registration-sr-only">Pré-visualização e validação dos candidatos do CSV</caption>
              <thead>
                <tr>
                  <th scope="col">Linha</th>
                  <th scope="col">Nome</th>
                  <th scope="col">E-mail</th>
                  <th scope="col">Telefone</th>
                  <th scope="col">Validação</th>
                </tr>
              </thead>
              <tbody>
                {csvPreview.linhas.map((row) => (
                  <tr key={row.linha} className={row.valido ? 'valid' : 'invalid'}>
                    <td>{row.linha}</td>
                    <td>{row.dados.nome || '—'}</td>
                    <td>{row.dados.email || '—'}</td>
                    <td>{row.dados.telefone || '—'}</td>
                    <td>
                      {row.valido ? (
                        <span className="candidate-csv-status valid"><FaCheckCircle aria-hidden="true" /> Pronto</span>
                      ) : (
                        <span className="candidate-csv-errors">
                          {row.erros.map((error) => <small key={error}>{error}</small>)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {importResult && <CsvImportResult result={importResult} />}

          <div className="candidate-registration-actions">
            <Link to="/candidatos/indicador" className="candidate-registration-secondary-button">Voltar para candidatos</Link>
            {importResult ? (
              <button type="button" className="candidate-registration-primary-button" onClick={onReset}>Importar outro arquivo</button>
            ) : (
              <button
                type="button"
                className="candidate-registration-primary-button"
                disabled={csvImporting || hasBlockingErrors || !csvPreview.validos.length}
                onClick={onImport}
              >
                {csvImporting ? 'Importando...' : `Importar ${csvPreview.validos.length} candidato(s)`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function CsvImportResult({ result }) {
  return (
    <section className="candidate-csv-result" aria-live="polite">
      <div>
        <FaCheckCircle aria-hidden="true" />
        <span><strong>Importação concluída</strong><small>Os registros válidos já estão na sua base.</small></span>
      </div>
      <dl>
        <div><dt>Importados</dt><dd>{result.importados.length}</dd></div>
        <div><dt>Rejeitados</dt><dd>{result.rejeitados.length}</dd></div>
      </dl>
      {result.rejeitados.length > 0 && (
        <details>
          <summary>Ver registros rejeitados</summary>
          <ul>
            {result.rejeitados.map((item, index) => (
              <li key={`${item.linha || 'registro'}-${index}`}>
                <strong>Linha {item.linha || 'não informada'}:</strong> {item.motivo || 'Registro rejeitado.'}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

function FormSection({ children, title }) {
  return (
    <section className="candidate-registration-section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

function Field({ className = '', error, label, name, required = false, ...props }) {
  const errorId = `${name}-error`
  return (
    <label className={`candidate-registration-field ${className} ${error ? 'has-error' : ''}`}>
      <span>{label}{required && <small aria-hidden="true"> *</small>}</span>
      <input
        {...props}
        name={name}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      {error && <small className="candidate-registration-field-error" id={errorId}>{error}</small>}
    </label>
  )
}

function SelectField({ label, options, name, ...props }) {
  return (
    <label className="candidate-registration-field">
      <span>{label}</span>
      <select name={name} {...props}>
        <option value="">Selecione</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  )
}

function TextareaField({ label, name, ...props }) {
  return (
    <label className="candidate-registration-field full">
      <span>{label}</span>
      <textarea name={name} {...props} />
    </label>
  )
}

function SkillField({ label, onAdd, onRemove, skills }) {
  const [draft, setDraft] = useState('')

  const commit = () => {
    const value = draft.trim().replace(/,$/, '').trim()
    if (!value) return
    onAdd(value)
    setDraft('')
  }

  const handleKeyDown = (event) => {
    if (event.key !== 'Enter' && event.key !== ',') return
    event.preventDefault()
    commit()
  }

  return (
    <label className="candidate-registration-field full">
      <span>{label}</span>
      <div className="candidate-registration-skills">
        {skills.map((skill) => (
          <button type="button" key={skill} onClick={() => onRemove(skill)} aria-label={`Remover ${skill}`}>
            {skill} <FaTimes aria-hidden="true" />
          </button>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          placeholder="Adicionar habilidade..."
        />
      </div>
    </label>
  )
}

export default IndicadorCandidatoCadastro
