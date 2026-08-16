import './styles/IndicadorCandidatoCadastro.css'

import { Link, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import SeletorFotoCandidato from '../../components/ui/SeletorFotoCandidato'
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
const RESUME_EXTENSIONS = ['pdf', 'doc', 'docx']
const RESUME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
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
  fotoPerfil: {},
}

const textFormFields = Object.keys(emptyForm).filter((key) => !['hardSkills', 'softSkills', 'curriculoTamanho', 'fotoPerfil'].includes(key))

const cloneEmptyForm = () => ({ ...emptyForm, hardSkills: [], softSkills: [], fotoPerfil: {} })

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
  mapped.fotoPerfil = candidate?.fotoPerfil || {}
  return mapped
}

const formatPhone = (value) => {
  const numbers = String(value || '').replace(/\D/g, '').slice(0, 11)
  if (numbers.length <= 2) return numbers
  if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
  if (numbers.length <= 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`
}

const formatCurrency = (value, language) => {
  const numbers = String(value || '').replace(/\D/g, '')
  if (!numbers) return ''
  return Number(numbers).toLocaleString(language, {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

const formatFileSize = (size, language) => {
  const bytes = Number(size || 0)
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  const formatter = new Intl.NumberFormat(language, { maximumFractionDigits: 1 })
  if (bytes < 1024 * 1024) return `${formatter.format(bytes / 1024)} KB`
  return `${formatter.format(bytes / (1024 * 1024))} MB`
}

const validateManualForm = (form, t) => {
  const errors = {}
  const name = String(form.nome || '').trim()
  const email = String(form.email || '').trim()

  if (!name) errors.nome = t('candidateRegistration.validation.nameRequired')
  else if (name.length < 2) errors.nome = t('candidateRegistration.validation.nameShort')

  if (!email) errors.email = t('candidateRegistration.validation.emailRequired')
  else if (!validarEmailCandidato(email)) errors.email = t('candidateRegistration.validation.emailInvalid')

  if (!validarTelefoneCandidato(form.telefone)) {
    errors.telefone = t('candidateRegistration.validation.phoneInvalid')
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

const getResumeValidationError = (file, t) => {
  if (!file) return ''
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  const browserType = String(file.type || '').toLowerCase()
  const validType = !browserType
    || browserType === 'application/octet-stream'
    || RESUME_TYPES.has(browserType)

  if (!RESUME_EXTENSIONS.includes(extension) || !validType) {
    return t('candidateRegistration.validation.resumeType')
  }
  if (file.size > MAX_RESUME_SIZE) return t('candidateRegistration.validation.resumeSize')
  return ''
}

const genderOptions = [
  { value: 'Feminino', labelKey: 'common:candidateForm.options.gender.female' },
  { value: 'Masculino', labelKey: 'common:candidateForm.options.gender.male' },
  { value: 'Não binário', labelKey: 'common:candidateForm.options.gender.nonBinary' },
  { value: 'Outro', labelKey: 'common:candidateForm.options.gender.other' },
  { value: 'Prefiro não informar', labelKey: 'common:candidateForm.options.gender.preferNot' }
]

const educationOptions = [
  { value: 'Ensino fundamental', labelKey: 'common:candidateForm.options.education.elementary' },
  { value: 'Ensino médio', labelKey: 'common:candidateForm.options.education.highSchool' },
  { value: 'Técnico', labelKey: 'common:candidateForm.options.education.technical' },
  { value: 'Superior', labelKey: 'common:candidateForm.options.education.higher' },
  { value: 'Pós-graduação', labelKey: 'common:candidateForm.options.education.postgraduate' },
  { value: 'Mestrado', labelKey: 'common:candidateForm.options.education.masters' },
  { value: 'Doutorado', labelKey: 'common:candidateForm.options.education.doctorate' }
]

const workModelOptions = [
  { value: 'Remoto', labelKey: 'common:candidateForm.options.workModel.remote' },
  { value: 'Híbrido', labelKey: 'common:candidateForm.options.workModel.hybrid' },
  { value: 'Presencial', labelKey: 'common:candidateForm.options.workModel.onsite' }
]

const noticeOptions = [
  { value: 'Imediato', labelKey: 'common:candidateForm.options.notice.immediate' },
  { value: '15 dias', labelKey: 'common:candidateForm.options.notice.days15' },
  { value: '30 dias', labelKey: 'common:candidateForm.options.notice.days30' },
  { value: '45 dias', labelKey: 'common:candidateForm.options.notice.days45' },
  { value: '60 dias', labelKey: 'common:candidateForm.options.notice.days60' }
]

const translateOptions = (options, t) => options.map((option) => ({
  value: option.value,
  label: t(option.labelKey)
}))

function IndicadorCandidatoCadastro() {
  const { t, i18n } = useTranslation(['referrer', 'common'])
  const { candidatoId } = useParams()
  const isEditing = Boolean(candidatoId)
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirmacao()
  const { firebaseUser, perfil, carregando, carregandoPerfil } = useAuth()
  const indicador = perfil?.tipo === 'indicador' ? perfil : null
  const indicadorId = firebaseUser?.uid || ''
  const language = i18n.resolvedLanguage || i18n.language

  const [activeTab, setActiveTab] = useState('manual')
  const [form, setForm] = useState(cloneEmptyForm)
  const [origin, setOrigin] = useState('manual')
  const [formErrors, setFormErrors] = useState({})
  const [resumeError, setResumeError] = useState('')
  const [resumeFile, setResumeFile] = useState(null)
  const [originalResumePresent, setOriginalResumePresent] = useState(false)
  const [photoFile, setPhotoFile] = useState(null)
  const [originalPhotoPresent, setOriginalPhotoPresent] = useState(false)
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
        if (!candidate) throw new Error(t('candidateRegistration.candidateNotFound'))
        if (!active) return

        setForm(mapCandidateToForm(candidate))
        setOriginalResumePresent(Boolean(candidate.curriculoNome || candidate.curriculo?.nome))
        setOriginalPhotoPresent(Boolean(candidate.fotoPerfil?.caminho))
        setOrigin(candidate.origem || 'manual')
      } catch {
        if (active) setLoadError(t('candidateRegistration.loadError'))
      } finally {
        if (active) setLoadingCandidate(false)
      }
    }

    loadCandidate()
    return () => {
      active = false
    }
  }, [candidatoId, indicadorId, isEditing, reloadKey, t])

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
    const value = formatCurrency(event.target.value, language)
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
    const error = getResumeValidationError(file, t)

    if (error) {
      setResumeError(error)
      event.target.value = ''
      toast.warning(error)
      return
    }

    setResumeError('')
    setResumeFile(file)
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
    setResumeFile(null)
    if (resumeInputRef.current) resumeInputRef.current.value = ''
  }

  const handleManualSubmit = async (event) => {
    event.preventDefault()
    if (saving) return

    const errors = validateManualForm(form, t)
    setFormErrors(errors)

    if (Object.keys(errors).length) {
      toast.warning(t('candidateRegistration.validation.reviewRequired'))
      const firstInvalidField = Object.keys(errors)[0]
      window.requestAnimationFrame(() => document.querySelector(`[name="${firstInvalidField}"]`)?.focus())
      return
    }

    setSaving(true)
    try {
      const data = buildManualPayload(form, isEditing ? origin : 'manual')

      if (isEditing) {
        await atualizarCandidatoPreSalvo({
          candidatoId,
          dados: data,
          indicadorId,
          arquivoCurriculo: resumeFile,
          removerCurriculo: originalResumePresent && !form.curriculoNome,
          arquivoFoto: photoFile,
          removerFoto: originalPhotoPresent && !form.fotoPerfil?.caminho && !photoFile
        })
        toast.success(t('candidateRegistration.updated'))
      } else {
        await criarCandidatoPreSalvo({
          dados: data,
          indicadorId,
          arquivoCurriculo: resumeFile,
          arquivoFoto: photoFile
        })
        toast.success(t('candidateRegistration.saved'))
      }

      navigate('/candidatos/indicador')
    } catch {
      toast.error(t('candidateRegistration.saveError'))
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
      const message = t('candidateRegistration.csvType')
      setCsvError(message)
      setCsvPreview(null)
      toast.warning(message)
      return
    }

    if (file.size > MAX_CSV_FILE_SIZE) {
      const message = t('candidateRegistration.csvSize')
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
      const preview = processarCandidatosCsv(content, {
        translate: (key, params) => t(`candidateRegistration.csvErrors.${key}`, params)
      })
      setCsvPreview(preview)

      if (preview.errosGerais.length) {
        toast.warning(t('candidateRegistration.csvBlockingErrors'))
      }
    } catch {
      setCsvPreview(null)
      setCsvError(t('candidateRegistration.csvReadError'))
      toast.error(t('candidateRegistration.csvReadError'))
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
    toast.info(t('candidateRegistration.csvModelDownloaded'))
  }

  const handleCsvImport = async () => {
    if (csvImporting || !csvPreview?.validos.length || csvPreview.errosGerais.length) return

    const approved = await confirm({
      title: t('candidateRegistration.csvConfirmTitle'),
      description: t('candidateRegistration.csvConfirmDescription', { count: csvPreview.validos.length }),
      confirmLabel: t('candidateRegistration.csvConfirm'),
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
        toast.success(t('candidateRegistration.csvImported', { count: imported.length }))
      } else {
        toast.warning(t('candidateRegistration.csvNoneImported'))
      }
    } catch {
      toast.error(t('candidateRegistration.csvImportError'))
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
    if (authLoading) return { type: 'loading', message: t('candidateRegistration.validatingSession') }
    if (!indicador || !indicadorId) return { type: 'access' }
    if (loadingCandidate) return { type: 'loading', message: t('candidateRegistration.loadingCandidate') }
    if (loadError) return { type: 'error' }
    return { type: 'ready' }
  }, [authLoading, indicador, indicadorId, loadError, loadingCandidate, t])

  return (
    <>
      <Navbar />

      <div className="candidate-registration-layout">
        <Sidebar type="indicador" user={indicador || perfil} />

        <main className="candidate-registration-page">
          <header className="candidate-registration-header">
            <span>{t('candidateRegistration.eyebrow')}</span>
            <h1>{isEditing ? t('candidateRegistration.editTitle') : t('candidateRegistration.createTitle')}</h1>
            <p>
              {isEditing
                ? t('candidateRegistration.editDescription')
                : t('candidateRegistration.createDescription')}
            </p>
            <Link to="/candidatos/indicador">{t('candidateRegistration.backToCandidates')}</Link>
          </header>

          {content.type === 'loading' ? (
            <PageLoader label={content.message} compact />
          ) : content.type === 'access' ? (
            <EstadoDados
              description={t('candidateRegistration.accessDescription')}
              title={t('candidateRegistration.unavailable')}
              tone="error"
            />
          ) : content.type === 'error' ? (
            <EstadoDados
              actionLabel={t('candidateRegistration.retry')}
              description={loadError}
              onAction={retryLoad}
              title={navigator.onLine ? t('candidateRegistration.loadTitle') : t('candidateRegistration.offline')}
              tone={navigator.onLine ? 'error' : 'offline'}
            />
          ) : (
            <section className="candidate-registration-panel">
              <div className="candidate-registration-tabs" role="tablist" aria-label={t('candidateRegistration.registrationMethod')}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'manual'}
                  className={activeTab === 'manual' ? 'active' : ''}
                  onClick={() => setActiveTab('manual')}
                >
                  <FaFileAlt aria-hidden="true" /> {t('candidateRegistration.manualTab')}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'csv'}
                  aria-disabled={isEditing}
                  className={activeTab === 'csv' ? 'active' : ''}
                  disabled={isEditing}
                  title={isEditing ? t('candidateRegistration.csvOnlyNew') : undefined}
                  onClick={() => setActiveTab('csv')}
                >
                  <FaFileCsv aria-hidden="true" /> {t('candidateRegistration.csvTab')}
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
                  photoFile={photoFile}
                  onPhotoChange={(file) => setPhotoFile(file)}
                  onPhotoRemove={() => {
                    setPhotoFile(null)
                    setForm((current) => ({ ...current, fotoPerfil: {} }))
                  }}
                  onPhotoError={(message) => toast.warning(message)}
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
  onPhotoChange,
  onPhotoError,
  onPhotoRemove,
  onRemoveSkill,
  onResume,
  onSubmit,
  resumeError,
  resumeInputRef,
  photoFile,
  saving,
}) {
  const { t, i18n } = useTranslation(['referrer', 'common'])
  const language = i18n.resolvedLanguage || i18n.language

  return (
    <form className="candidate-registration-form" onSubmit={onSubmit} noValidate>
      <FormSection title={t('common:candidateForm.sections.personal')}>
        <SeletorFotoCandidato
          fotoAtual={form.fotoPerfil}
          arquivo={photoFile}
          nome={form.nome}
          onChange={onPhotoChange}
          onRemove={onPhotoRemove}
          onError={onPhotoError}
        />
        <div className="candidate-registration-grid">
          <Field label={t('common:candidateForm.fields.name')} name="nome" value={form.nome} onChange={onChange} error={errors.nome} placeholder={t('common:candidateForm.placeholders.name')} required autoComplete="name" />
          <Field label={t('common:candidateForm.fields.email')} name="email" type="email" value={form.email} onChange={onChange} error={errors.email} placeholder={t('common:candidateForm.placeholders.email')} required autoComplete="email" />
          <Field label={t('common:candidateForm.fields.phone')} name="telefone" value={form.telefone} onChange={onPhoneChange} error={errors.telefone} placeholder={t('common:candidateForm.placeholders.phone')} inputMode="tel" autoComplete="tel" />
          <Field label={t('common:candidateForm.fields.birthDate')} name="dataNascimento" type="date" value={form.dataNascimento} onChange={onChange} />
          <SelectField emptyLabel={t('common:candidateForm.options.select')} label={t('common:candidateForm.fields.genderOptional')} name="genero" value={form.genero} onChange={onChange} options={translateOptions(genderOptions, t)} />
        </div>
      </FormSection>

      <FormSection title={t('common:candidateForm.sections.professional')}>
        <div className="candidate-registration-grid">
          <Field label={t('common:candidateForm.fields.currentRole')} name="cargoAtual" value={form.cargoAtual} onChange={onChange} placeholder={t('common:candidateForm.placeholders.currentRole')} />
          <Field label={t('common:candidateForm.fields.experience')} name="anosExperiencia" type="number" min="0" max="80" value={form.anosExperiencia} onChange={onChange} placeholder={t('common:candidateForm.placeholders.experience')} />
          <SelectField emptyLabel={t('common:candidateForm.options.select')} label={t('common:candidateForm.fields.education')} name="escolaridade" value={form.escolaridade} onChange={onChange} options={translateOptions(educationOptions, t)} />
          <Field label={t('common:candidateForm.fields.languages')} name="proficienciaIdiomas" value={form.proficienciaIdiomas} onChange={onChange} placeholder={t('common:candidateForm.placeholders.languages')} />
        </div>
      </FormSection>

      <FormSection title={t('candidateRegistration.linksSection')}>
        <div className="candidate-registration-grid">
          <Field label="LinkedIn" name="linkedin" value={form.linkedin} onChange={onChange} placeholder={t('common:candidateForm.placeholders.linkedin')} />
          <Field label="Portfolio" name="portfolio" value={form.portfolio} onChange={onChange} placeholder={t('common:candidateForm.placeholders.portfolio')} />
          <Field className="full" label="GitHub / Behance" name="github" value={form.github} onChange={onChange} placeholder={t('common:candidateForm.placeholders.github')} />
        </div>
      </FormSection>

      <FormSection title={t('candidateRegistration.skillsSection')}>
        <p className="candidate-registration-help">{t('common:candidateForm.skillHelp')}</p>
        <SkillField label="Hard skills" skills={form.hardSkills} onAdd={(value) => onAddSkill('hardSkills', value)} onRemove={(value) => onRemoveSkill('hardSkills', value)} />
        <SkillField label="Soft skills" skills={form.softSkills} onAdd={(value) => onAddSkill('softSkills', value)} onRemove={(value) => onRemoveSkill('softSkills', value)} />
      </FormSection>

      <FormSection title={t('common:candidateForm.sections.preferences')}>
        <div className="candidate-registration-grid three-columns">
          <Field label={t('common:candidateForm.fields.salaryExpectation')} name="expectativaSalarial" value={form.expectativaSalarial} onChange={onCurrencyChange} placeholder={formatCurrency('8000', language)} inputMode="numeric" />
          <SelectField emptyLabel={t('common:candidateForm.options.select')} label={t('common:candidateForm.fields.workModel')} name="modeloTrabalho" value={form.modeloTrabalho} onChange={onChange} options={translateOptions(workModelOptions, t)} />
          <SelectField emptyLabel={t('common:candidateForm.options.select')} label={t('common:candidateForm.fields.noticePeriod')} name="avisoPrevio" value={form.avisoPrevio} onChange={onChange} options={translateOptions(noticeOptions, t)} />
        </div>
      </FormSection>

      <FormSection title={t('common:candidateForm.sections.resume')}>
        <div className={`candidate-registration-resume ${form.curriculoNome ? 'has-file' : ''} ${resumeError ? 'has-error' : ''}`}>
          {form.curriculoNome ? <FaCheckCircle aria-hidden="true" /> : <FaCloudUploadAlt aria-hidden="true" />}
          <div>
            <strong>{form.curriculoNome || t('common:candidateForm.attachResume')}</strong>
            <p>
              {form.curriculoNome
                ? [form.curriculoTipo, formatFileSize(form.curriculoTamanho, language)].filter(Boolean).join(' • ')
                : t('common:candidateForm.fileHelp')}
            </p>
          </div>
          <label className="candidate-registration-file-button">
            {form.curriculoNome ? t('candidateRegistration.replaceFile') : t('candidateRegistration.chooseFile')}
            <input ref={resumeInputRef} type="file" accept=".pdf,.doc,.docx" onChange={onResume} />
          </label>
          {form.curriculoNome && (
            <button type="button" className="candidate-registration-remove-file" onClick={onRemoveResume} aria-label={t('common:candidateForm.removeResume')}>
              <FaTrash aria-hidden="true" />
            </button>
          )}
        </div>
        {resumeError && <p className="candidate-registration-inline-error" role="alert">{resumeError}</p>}
        <TextareaField label={t('common:candidateForm.fields.professionalNotes')} name="observacoesProfissionais" value={form.observacoesProfissionais} onChange={onChange} placeholder={t('common:candidateForm.placeholders.professionalNotes')} />
      </FormSection>

      {Object.values(errors).some(Boolean) && (
        <div className="candidate-registration-alert" role="alert">
          <FaExclamationCircle aria-hidden="true" />
          <div>
            <strong>{t('candidateRegistration.reviewTitle')}</strong>
            <p>{t('candidateRegistration.reviewDescription')}</p>
          </div>
        </div>
      )}

      <div className="candidate-registration-actions">
        <Link to="/candidatos/indicador" className="candidate-registration-secondary-button">{t('common:candidateForm.cancel')}</Link>
        <button type="submit" className="candidate-registration-primary-button" disabled={saving}>
          {saving ? t('common:candidateForm.saving') : isEditing ? t('candidateRegistration.saveChanges') : t('candidateRegistration.saveCandidate')}
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
  const { t } = useTranslation('referrer')
  const hasBlockingErrors = Boolean(csvPreview?.errosGerais.length)

  return (
    <div className="candidate-csv-panel" role="tabpanel">
      <div className="candidate-csv-intro">
        <div>
          <span>{t('candidateRegistration.csv.eyebrow')}</span>
          <h2>{t('candidateRegistration.csv.title', { count: MAX_CANDIDATOS_CSV })}</h2>
          <p>{t('candidateRegistration.csv.description')}</p>
        </div>
        <button type="button" className="candidate-registration-secondary-button" onClick={onDownloadModel}>
          <FaDownload aria-hidden="true" /> {t('candidateRegistration.csv.downloadModel')}
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
          <strong>{t('candidateRegistration.csv.dropzone')}</strong>
          <small>{t('candidateRegistration.csv.fileHelp')}</small>
          <input ref={csvInputRef} type="file" accept=".csv,text/csv" onChange={onFileInput} />
        </label>
      )}

      {csvReading && <PageLoader label={t('candidateRegistration.csv.reading')} compact />}

      {csvError && !csvReading && (
        <EstadoDados
          actionLabel={t('candidateRegistration.csv.selectAnother')}
          compact
          description={csvError}
          onAction={onReset}
          title={t('candidateRegistration.csv.invalidFile')}
          tone="error"
        />
      )}

      {csvPreview && !csvReading && (
        <>
          <section className="candidate-csv-summary" aria-label={t('candidateRegistration.csv.summary')}>
            <div>
              <FaFileCsv aria-hidden="true" />
              <span><strong>{csvFileName}</strong><small>{t('candidateRegistration.csv.records', { count: csvPreview.totalRegistros })}</small></span>
            </div>
            <dl>
              <div><dt>{t('candidateRegistration.csv.valid')}</dt><dd>{csvPreview.validos.length}</dd></div>
              <div><dt>{t('candidateRegistration.csv.invalid')}</dt><dd>{csvPreview.invalidos.length}</dd></div>
            </dl>
            <button type="button" onClick={onReset} disabled={csvImporting}>{t('candidateRegistration.csv.changeFile')}</button>
          </section>

          {hasBlockingErrors && (
            <div className="candidate-registration-alert" role="alert">
              <FaExclamationCircle aria-hidden="true" />
              <div>
                <strong>{t('candidateRegistration.csv.fixBefore')}</strong>
                <ul>{csvPreview.errosGerais.map((error) => <li key={error}>{error}</li>)}</ul>
              </div>
            </div>
          )}

          <div className="candidate-csv-table-wrap">
            <table className="candidate-csv-table">
              <caption className="candidate-registration-sr-only">{t('candidateRegistration.csv.previewCaption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('candidateRegistration.csv.line')}</th>
                  <th scope="col">{t('candidateRegistration.csv.name')}</th>
                  <th scope="col">{t('candidateRegistration.csv.email')}</th>
                  <th scope="col">{t('candidateRegistration.csv.phone')}</th>
                  <th scope="col">{t('candidateRegistration.csv.validation')}</th>
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
                        <span className="candidate-csv-status valid"><FaCheckCircle aria-hidden="true" /> {t('candidateRegistration.csv.ready')}</span>
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
            <Link to="/candidatos/indicador" className="candidate-registration-secondary-button">{t('candidateRegistration.backToCandidates')}</Link>
            {importResult ? (
              <button type="button" className="candidate-registration-primary-button" onClick={onReset}>{t('candidateRegistration.csv.importAnother')}</button>
            ) : (
              <button
                type="button"
                className="candidate-registration-primary-button"
                disabled={csvImporting || hasBlockingErrors || !csvPreview.validos.length}
                onClick={onImport}
              >
                {csvImporting ? t('candidateRegistration.csv.importing') : t('candidateRegistration.csv.importCount', { count: csvPreview.validos.length })}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function CsvImportResult({ result }) {
  const { t } = useTranslation('referrer')

  return (
    <section className="candidate-csv-result" aria-live="polite">
      <div>
        <FaCheckCircle aria-hidden="true" />
        <span><strong>{t('candidateRegistration.csv.complete')}</strong><small>{t('candidateRegistration.csv.completeDescription')}</small></span>
      </div>
      <dl>
        <div><dt>{t('candidateRegistration.csv.imported')}</dt><dd>{result.importados.length}</dd></div>
        <div><dt>{t('candidateRegistration.csv.rejected')}</dt><dd>{result.rejeitados.length}</dd></div>
      </dl>
      {result.rejeitados.length > 0 && (
        <details>
          <summary>{t('candidateRegistration.csv.viewRejected')}</summary>
          <ul>
            {result.rejeitados.map((item, index) => (
              <li key={`${item.linha || 'registro'}-${index}`}>
                <strong>{t('candidateRegistration.csv.lineValue', { line: item.linha || t('candidateRegistration.csv.lineUnknown') })}</strong>{' '}
                {item.motivoKey ? t(item.motivoKey) : item.motivo || t('candidateRegistration.csv.recordRejected')}
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

function SelectField({ emptyLabel, label, options, name, ...props }) {
  return (
    <label className="candidate-registration-field">
      <span>{label}</span>
      <select name={name} {...props}>
        <option value="">{emptyLabel}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
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
  const { t } = useTranslation('referrer')
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
          <button type="button" key={skill} onClick={() => onRemove(skill)} aria-label={t('candidateRegistration.removeSkill', { skill })}>
            {skill} <FaTimes aria-hidden="true" />
          </button>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          placeholder={t('candidateRegistration.skillPlaceholder')}
        />
      </div>
    </label>
  )
}

export default IndicadorCandidatoCadastro
