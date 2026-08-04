// Objetivo do arquivo: renderizar o formulário de indicação de candidato para uma vaga.
// A página valida a sessão do indicador, busca os dados da vaga, coleta informações
// do candidato indicado e envia a indicação para o Firestore.

import './styles/IndicadorIndicar.css'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import Navbar from '../../components/layout/Navbar'
import Sidebar from '../../components/layout/Sidebar'
import Footer from '../../components/layout/Footer'
import EstadoDados from '../../components/ui/EstadoDados'
import PageLoader from '../../components/ui/PageLoader'
import { buscarVagaPorId, vagaAceitaIndicacoes } from '../../services/firestoreVagas'
import { criarCandidatoIndicado } from '../../services/firestoreCandidatos'
import { listarCandidatosPreSalvos } from '../../services/firestoreCandidatosPreSalvos'
import { getFirebaseUid } from '../../services/identidadeFirebase'
import { useAuth } from '../../hooks/useAuth'
import { useConfirmacao } from '../../hooks/useConfirmacao'
import { useToast } from '../../hooks/useToast'

// Estado inicial do formulário de indicação.
// Contém dados pessoais, profissionais, links, habilidades, preferências e currículo.
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
  hardSkills: [],
  softSkills: [],
  expectativaSalarial: '',
  modeloTrabalho: '',
  avisoPrevio: '',
  curriculoNome: '',
  curriculoTipo: '',
  curriculoTamanho: 0,
  curriculo: null
}

const profileFields = [
  'nome',
  'email',
  'dataNascimento',
  'genero',
  'telefone',
  'cargoAtual',
  'anosExperiencia',
  'escolaridade',
  'proficienciaIdiomas',
  'linkedin',
  'portfolio',
  'github',
  'hardSkills',
  'softSkills',
  'expectativaSalarial',
  'modeloTrabalho',
  'avisoPrevio',
  'curriculoNome',
  'curriculoTipo',
  'curriculoTamanho',
  'curriculo'
]

const indicationFields = ['pontosFortes', 'fitCultural', 'destaquesProjetos', 'narrativa']
const comparableProfileFields = profileFields.filter((field) => field !== 'curriculo')
const maxResumeSize = 10 * 1024 * 1024
const allowedResumeExtensions = new Set(['pdf', 'doc', 'docx', 'rtf'])
const allowedResumeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/rtf',
  'application/x-rtf',
  'text/rtf'
])
const resumeTypeByExtension = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  rtf: 'application/rtf'
}

// Responsabilidade: formatar valores monetários como moeda brasileira.
const formatCurrency = (value) => {
  const numbers = value.replace(/\D/g, '')
  if (!numbers) return ''

  return Number(numbers).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

// Responsabilidade: formatar telefone brasileiro conforme a quantidade de dígitos informados.
const formatPhone = (value) => {
  const numbers = value.replace(/\D/g, '').slice(0, 11)

  if (numbers.length <= 2) return numbers
  if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
  if (numbers.length <= 10) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`
  }

  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`
}

const normalizeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim()

const toText = (value) => {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.filter(Boolean).join(', ')
  if (typeof value === 'object') return ''
  return String(value)
}

const firstText = (...values) => {
  const value = values.find((item) => toText(item).trim())
  return value === undefined ? '' : toText(value)
}

const normalizeSkills = (value) => {
  const skills = Array.isArray(value)
    ? value
    : String(value || '').split(/[,;|]/)

  return [...new Set(skills.map((skill) => String(skill).trim()).filter(Boolean))]
}

const getResumeMetadata = (candidato) => {
  const storedResume = candidato?.curriculo
  const resume = storedResume && typeof storedResume === 'object' && !Array.isArray(storedResume)
    ? storedResume
    : {}
  const nome = firstText(
    resume.nome,
    resume.nomeArquivo,
    resume.name,
    candidato?.curriculoNome
  )
  const tipo = firstText(
    resume.tipo,
    resume.contentType,
    resume.type,
    candidato?.curriculoTipo
  )
  const rawSize = resume.tamanho ?? resume.size ?? candidato?.curriculoTamanho ?? 0
  const tamanho = Number.isFinite(Number(rawSize)) ? Number(rawSize) : 0
  const hasStoredResume = Object.values(resume).some((value) => (
    value !== null && value !== undefined && String(value).trim() !== '' && value !== 0
  ))

  if (!nome && !hasStoredResume) {
    return { curriculoNome: '', curriculoTipo: '', curriculoTamanho: 0, curriculo: null }
  }

  return {
    curriculoNome: nome,
    curriculoTipo: tipo,
    curriculoTamanho: tamanho,
    curriculo: {
      ...resume,
      nome,
      tipo,
      tamanho
    }
  }
}

const mapSavedCandidateToForm = (candidato) => {
  const salario = candidato?.expectativaSalarial
  const salarioFormatado = typeof salario === 'number'
    ? formatCurrency(String(salario))
    : toText(salario)

  return {
    ...initialForm,
    nome: firstText(candidato?.nome, candidato?.nomeCompleto),
    email: toText(candidato?.email),
    dataNascimento: toText(candidato?.dataNascimento),
    genero: toText(candidato?.genero),
    telefone: formatPhone(toText(candidato?.telefone)),
    cargoAtual: toText(candidato?.cargoAtual),
    anosExperiencia: toText(candidato?.anosExperiencia),
    escolaridade: toText(candidato?.escolaridade),
    proficienciaIdiomas: firstText(candidato?.proficienciaIdiomas, candidato?.idiomas),
    linkedin: toText(candidato?.linkedin),
    portfolio: toText(candidato?.portfolio),
    github: firstText(candidato?.github, candidato?.githubBehance),
    hardSkills: normalizeSkills(candidato?.hardSkills),
    softSkills: normalizeSkills(candidato?.softSkills),
    expectativaSalarial: salarioFormatado,
    modeloTrabalho: toText(candidato?.modeloTrabalho),
    avisoPrevio: toText(candidato?.avisoPrevio),
    pontosFortes: toText(candidato?.pontosFortes),
    fitCultural: toText(candidato?.fitCultural),
    destaquesProjetos: toText(candidato?.destaquesProjetos),
    narrativa: firstText(candidato?.narrativa, candidato?.observacoesProfissionais),
    ...getResumeMetadata(candidato)
  }
}

const hasValue = (value) => {
  if (Array.isArray(value)) return value.length > 0
  if (value && typeof value === 'object') return Object.keys(value).length > 0
  return String(value ?? '').trim() !== '' && value !== 0
}

const comparableValue = (value) => {
  if (Array.isArray(value)) {
    return [...value].map(normalizeText).sort().join('|')
  }

  return normalizeText(value)
}

const getProfileConflicts = (current, incoming) => comparableProfileFields.filter((field) => (
  hasValue(current[field])
  && hasValue(incoming[field])
  && comparableValue(current[field]) !== comparableValue(incoming[field])
))

const mergeSavedCandidate = (current, incoming) => {
  const next = { ...current }

  profileFields.forEach((field) => {
    if (hasValue(incoming[field])) {
      next[field] = incoming[field]
    }
  })
  indicationFields.forEach((field) => {
    if (!hasValue(current[field]) && hasValue(incoming[field])) {
      next[field] = incoming[field]
    }
  })

  return next
}

const getResumeExtension = (fileName) => String(fileName || '').split('.').pop()?.toLowerCase() || ''

const formatFileSize = (size) => {
  if (!size) return ''
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function Indicar() {
  // Identificador da vaga recebido pela rota.
  const { vagaId } = useParams()

  // Hook usado para redirecionar após envio da indicação.
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { perfil: indicador } = useAuth()
  const confirm = useConfirmacao()
  const toast = useToast()
  const indicadorId = getFirebaseUid(indicador)
  const requestedSavedCandidateId = searchParams.get('candidatoPreSalvoId') || ''
  const automaticSelectionRef = useRef('')

  // Armazena os dados da vaga carregada pelo Firestore.
  const [vaga, setVaga] = useState(null)

  // Controla todos os campos do formulário.
  const [form, setForm] = useState(initialForm)

  // Controla o carregamento inicial da vaga.
  const [loading, setLoading] = useState(true)

  // Controla o estado de envio da indicação.
  const [saving, setSaving] = useState(false)

  // Armazena mensagens de erro do carregamento ou envio.
  const [message, setMessage] = useState('')
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [savedCandidates, setSavedCandidates] = useState([])
  const [savedCandidatesLoading, setSavedCandidatesLoading] = useState(true)
  const [savedCandidatesError, setSavedCandidatesError] = useState('')
  const [savedCandidatesReloadKey, setSavedCandidatesReloadKey] = useState(0)
  const [savedCandidateSearch, setSavedCandidateSearch] = useState('')
  const [selectedSavedId, setSelectedSavedId] = useState('')

  useEffect(() => {
    // Responsabilidade: buscar os dados da vaga selecionada antes de exibir o formulário.
    let active = true

    const fetchVaga = async () => {
      if (!indicadorId) {
        setLoadError('Perfil do indicador sem UID do Firebase.')
        setLoading(false)
        return
      }

      try {
        setLoadError('')
        const data = await buscarVagaPorId(vagaId)

        if (!data) {
          throw new Error('Vaga não encontrada')
        }

        if (!vagaAceitaIndicacoes(data)) {
          throw new Error('Esta vaga não está aberta para novas indicações.')
        }

        if (active) setVaga(data)
      } catch (err) {
        if (active) setLoadError(err.message || 'Não foi possível carregar a vaga.')
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchVaga()

    return () => {
      active = false
    }
  }, [indicadorId, vagaId, reloadKey])

  useEffect(() => {
    let active = true

    const fetchSavedCandidates = async () => {
      if (!indicadorId) {
        setSavedCandidates([])
        setSavedCandidatesError('Perfil do indicador sem UID do Firebase.')
        setSavedCandidatesLoading(false)
        return
      }

      setSavedCandidatesLoading(true)
      setSavedCandidatesError('')

      try {
        const data = await listarCandidatosPreSalvos(indicadorId)

        if (active) {
          setSavedCandidates(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        if (active) {
          setSavedCandidates([])
          setSavedCandidatesError(err.message || 'Não foi possível carregar os candidatos pré-salvos.')
        }
      } finally {
        if (active) setSavedCandidatesLoading(false)
      }
    }

    fetchSavedCandidates()

    return () => {
      active = false
    }
  }, [indicadorId, savedCandidatesReloadKey])

  const visibleSavedCandidates = useMemo(() => {
    const search = normalizeText(savedCandidateSearch)
    if (!search) return savedCandidates

    return savedCandidates.filter((candidate) => [
      candidate.nome,
      candidate.nomeCompleto,
      candidate.email,
      candidate.cargoAtual
    ].some((value) => normalizeText(value).includes(search)))
  }, [savedCandidateSearch, savedCandidates])

  const selectedSavedCandidate = useMemo(() => (
    savedCandidates.find((candidate) => candidate.id === selectedSavedId) || null
  ), [savedCandidates, selectedSavedId])

  const savedCandidateOptions = useMemo(() => {
    if (!selectedSavedCandidate || visibleSavedCandidates.some((candidate) => candidate.id === selectedSavedId)) {
      return visibleSavedCandidates
    }

    return [selectedSavedCandidate, ...visibleSavedCandidates]
  }, [selectedSavedCandidate, selectedSavedId, visibleSavedCandidates])

  const applySavedCandidate = useCallback(async (candidate) => {
    if (!candidate) return false

    const incoming = mapSavedCandidateToForm(candidate)
    const conflicts = getProfileConflicts(form, incoming)

    if (conflicts.length) {
      const confirmed = await confirm({
        title: 'Substituir dados do candidato?',
        description: `${conflicts.length} ${conflicts.length === 1 ? 'campo preenchido possui' : 'campos preenchidos possuem'} valores diferentes. Os dados de perfil serão substituídos, mas os textos específicos desta indicação serão preservados.`,
        confirmLabel: 'Usar pré-salvo',
        cancelLabel: 'Manter formulário'
      })

      if (!confirmed) return false
    }

    setForm((current) => mergeSavedCandidate(current, incoming))
    setSelectedSavedId(candidate.id)
    setSavedCandidateSearch('')
    setMessage('')
    return true
  }, [confirm, form])

  useEffect(() => {
    if (!requestedSavedCandidateId) {
      automaticSelectionRef.current = ''
      return
    }

    if (
      savedCandidatesLoading
      || savedCandidatesError
      || automaticSelectionRef.current === requestedSavedCandidateId
    ) return

    const requestedCandidate = savedCandidates.find((candidate) => candidate.id === requestedSavedCandidateId)

    if (!requestedCandidate) {
      automaticSelectionRef.current = requestedSavedCandidateId
      toast.warning('O candidato pré-salvo solicitado não foi encontrado.')
      return
    }

    const selectionTimer = window.setTimeout(() => {
      automaticSelectionRef.current = requestedSavedCandidateId
      void applySavedCandidate(requestedCandidate)
    }, 0)

    return () => window.clearTimeout(selectionTimer)
  }, [
    applySavedCandidate,
    requestedSavedCandidateId,
    savedCandidates,
    savedCandidatesError,
    savedCandidatesLoading,
    toast
  ])

  const tentarNovamente = () => {
    setLoading(true)
    setReloadKey((value) => value + 1)
  }

  const tentarCarregarPreSalvosNovamente = () => {
    setSavedCandidatesLoading(true)
    setSavedCandidatesReloadKey((value) => value + 1)
  }

  const handleSavedCandidateSelection = async (event) => {
    const candidateId = event.target.value

    if (!candidateId) {
      setSelectedSavedId('')
      return
    }

    const candidate = savedCandidates.find((item) => item.id === candidateId)
    await applySavedCandidate(candidate)
  }

  // Regra de acesso: sem indicador autenticado, redireciona para login.
  if (!indicador) {
    return <Navigate to={`/login?redirect=/indicar/${vagaId}`} replace />
  }

  // Responsabilidade: atualizar campos simples do formulário.
  const updateField = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  // Responsabilidade: atualizar campos monetários já formatados.
  const updateCurrencyField = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: formatCurrency(value) }))
  }

  // Responsabilidade: atualizar o telefone com máscara.
  const updatePhoneField = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: formatPhone(value) }))
  }

  // Responsabilidade: remover uma habilidade da lista informada.
  const removeSkill = (type, skill) => {
    setForm((current) => ({
      ...current,
      [type]: current[type].filter((item) => item !== skill)
    }))
  }

  // Responsabilidade: adicionar habilidade ao pressionar Enter.
  // Regra: não adiciona valores vazios nem duplicados.
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

  // Responsabilidade: validar e registrar os metadados do currículo selecionado.
  const handleFile = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const extension = getResumeExtension(file.name)
    const browserType = String(file.type || '').toLowerCase()
    const contentType = !browserType || browserType === 'application/octet-stream'
      ? resumeTypeByExtension[extension] || ''
      : browserType
    const hasValidExtension = allowedResumeExtensions.has(extension)
    const hasValidType = allowedResumeTypes.has(contentType)

    if (!hasValidExtension || !hasValidType) {
      event.target.value = ''
      toast.warning('Selecione um currículo em PDF, DOC, DOCX ou RTF.')
      return
    }

    if (file.size > maxResumeSize) {
      event.target.value = ''
      toast.warning('O currículo deve ter no máximo 10 MB.')
      return
    }

    const curriculo = {
      nome: file.name,
      tipo: contentType,
      tamanho: file.size
    }

    setForm((current) => ({
      ...current,
      curriculoNome: curriculo.nome,
      curriculoTipo: curriculo.tipo,
      curriculoTamanho: curriculo.tamanho,
      curriculo
    }))
  }

  // Responsabilidade: enviar a indicação do candidato para o Firestore.
  const handleSubmit = async (event) => {
    event.preventDefault()
    if (saving) return

    setSaving(true)
    setMessage('')

    if (!vaga) {
      setSaving(false)
      setMessage('Vaga não carregada para finalizar a indicação.')
      toast.warning('Vaga não carregada para finalizar a indicação.')
      return
    }

    try {
      await criarCandidatoIndicado({
        dados: form,
        indicador,
        vaga,
        candidatoPreSalvoId: selectedSavedId
      })
      toast.success('Indicação enviada com sucesso.')

      // Após criar a indicação, retorna para a página da vaga.
      navigate(`/vaga/${vagaId}`)
    } catch (err) {
      setMessage(err.message)
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Componente de navegação principal. */}
      <Navbar />

      <div className="indicar-layout">
        {/* Menu lateral do painel do indicador. */}
        <Sidebar type="indicador" user={indicador} />

        <main className="indicar-page">
          <header className="indicar-header">
            <span>Fluxo de indicação</span>
            <h1>Indicar um<br />Novo Candidato</h1>
            <Link to={`/vaga/${vagaId}`}>Voltar para vaga selecionada</Link>
            {vaga && <p>{vaga.titulo} - {vaga.empresa}</p>}
          </header>

          {loading ? (
            <PageLoader label="Carregando vaga..." compact />
          ) : loadError || !vaga ? (
            <EstadoDados
              actionLabel="Tentar novamente"
              description={loadError || 'A vaga solicitada não está disponível.'}
              onAction={tentarNovamente}
              title={navigator.onLine ? 'Indicação indisponível' : 'Você está sem conexão'}
              tone={navigator.onLine ? 'error' : 'offline'}
            />
          ) : (
            <form className="indicar-form" onSubmit={handleSubmit}>
              <div className="indicar-main">
                <section className="form-section">
                  <h2>Dados Pessoais</h2>
                  <div className="form-grid">
                    <Field label="Nome completo" name="nome" value={form.nome} onChange={updateField} placeholder="Ex: João da Silva" required />
                    <Field label="E-mail" name="email" type="email" value={form.email} onChange={updateField} placeholder="joao@exemplo.com" required />
                    <Field label="Data de nascimento" name="dataNascimento" type="date" value={form.dataNascimento} onChange={updateField} />
                    <SelectField label="Gênero (opcional)" name="genero" value={form.genero} onChange={updateField} options={['Feminino', 'Masculino', 'Outro', 'Prefiro não informar']} />
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
                    <Field label="Anos de experiência" name="anosExperiencia" value={form.anosExperiencia} onChange={updateField} placeholder="Ex: 5" />
                    <SelectField label="Nível de escolaridade" name="escolaridade" value={form.escolaridade} onChange={updateField} options={['Ensino médio', 'Técnico', 'Superior', 'Pós-graduação', 'Mestrado', 'Doutorado']} />
                    <Field label="Proficiência em idiomas" name="proficienciaIdiomas" value={form.proficienciaIdiomas} onChange={updateField} placeholder="Inglês (Avançado), Espanhol (Básico)..." />
                  </div>
                </section>

                <section className="form-section">
                  <h2>Links & Redes Sociais</h2>
                  <div className="form-grid">
                    <Field label="LinkedIn profile URL" name="linkedin" value={form.linkedin} onChange={updateField} placeholder="linkedin.com/in/perfil" />
                    <Field label="Portfólio URL" name="portfolio" value={form.portfolio} onChange={updateField} placeholder="behance.net/perfil ou seudominio.com" />
                    <Field className="full-field" label="GitHub / Behance (opcional)" name="github" value={form.github} onChange={updateField} placeholder="Links adicionais de repositórios ou portfólios" />
                  </div>
                </section>

                <section className="form-section">
                  <h2>Por que indicar?</h2>
                  <Textarea label="Principais pontos fortes" name="pontosFortes" value={form.pontosFortes} onChange={updateField} placeholder="Quais as maiores fortalezas deste candidato?" />
                  <Textarea label="Fit cultural com a Selectio" name="fitCultural" value={form.fitCultural} onChange={updateField} placeholder="Por que ele se daria bem com nossa cultura?" />
                  <Textarea label="Destaques em projetos" name="destaquesProjetos" value={form.destaquesProjetos} onChange={updateField} placeholder="Mencione projetos relevantes que ele entregou..." />

                  <label className="field-label full-field">
                    Narrativa completa da indicação
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
                      placeholder="Uma visão geral do motivo da indicação..."
                    />
                  </label>
                </section>

                <section className="form-section">
                  <h2>Habilidades & Expertise</h2>
                  <p className="skill-help">Digite uma habilidade e pressione Enter para criar tokens.</p>
                  <SkillInput label="Hard skills (competências técnicas)" skills={form.hardSkills} onRemove={(skill) => removeSkill('hardSkills', skill)} onAdd={(event) => addSkill(event, 'hardSkills')} />
                  <SkillInput label="Soft skills (competências interpessoais)" skills={form.softSkills} onRemove={(skill) => removeSkill('softSkills', skill)} onAdd={(event) => addSkill(event, 'softSkills')} />
                </section>

                <section className="form-section">
                  <h2>Preferências</h2>
                  <div className="form-grid three-columns">
                    <Field
                      label="Expectativa salarial"
                      name="expectativaSalarial"
                      value={form.expectativaSalarial}
                      onChange={updateCurrencyField}
                      placeholder="R$ 8.000"
                      inputMode="numeric"
                    />
                    <SelectField label="Modelo de trabalho" name="modeloTrabalho" value={form.modeloTrabalho} onChange={updateField} options={['Remoto', 'Híbrido', 'Presencial']} />
                    <SelectField label="Aviso prévio" name="avisoPrevio" value={form.avisoPrevio} onChange={updateField} options={['Imediato', '15 dias', '30 dias', '45 dias', '60 dias']} />
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
                          {form.curriculoTamanho ? ` (${formatFileSize(form.curriculoTamanho)})` : ''}
                        </>
                      ) : (
                        'PDF, DOC, DOCX ou RTF (Máx. 10MB)'
                      )}
                    </small>
                    <input type="file" accept=".pdf,.doc,.docx,.rtf" onChange={handleFile} />
                  </label>
                </section>

                {message && (
                  <div className="indicar-alert" role="alert">
                    <FaExclamationCircle />
                    <div>
                      <strong>Não foi possível finalizar a indicação</strong>
                      <p>{message}</p>
                    </div>
                  </div>
                )}

                <div className="form-actions">
                  <button type="button" className="draft-button">Salvar como Rascunho</button>
                  <button type="submit" className="submit-button" disabled={saving}>
                    {saving ? 'Finalizando...' : 'Finalizar Indicação'}
                  </button>
                </div>
              </div>

              <aside className="saved-candidate-card" aria-labelledby="saved-candidate-title">
                <div className="saved-icon">
                  <FaSearch aria-hidden="true" />
                </div>
                <h2 id="saved-candidate-title">Adicionar candidato já pré-salvo</h2>
                <p className="saved-candidate-intro">
                  Selecione um talento da sua base de candidatos para agilizar o processo.
                </p>

                {savedCandidatesLoading ? (
                  <div className="saved-candidate-state" role="status" aria-live="polite">
                    <span className="saved-candidate-spinner" aria-hidden="true" />
                    <p>Carregando candidatos...</p>
                  </div>
                ) : savedCandidatesError ? (
                  <div className="saved-candidate-state saved-candidate-error" role="alert">
                    <p>{savedCandidatesError}</p>
                    <button type="button" onClick={tentarCarregarPreSalvosNovamente}>
                      Tentar novamente
                    </button>
                  </div>
                ) : !savedCandidates.length ? (
                  <div className="saved-candidate-state saved-candidate-empty">
                    <p>Você ainda não possui candidatos pré-salvos.</p>
                    <Link to="/candidatos/indicador/novo">Cadastrar candidato</Link>
                  </div>
                ) : (
                  <>
                    <label className="saved-candidate-search">
                      Buscar candidato
                      <span>
                        <FaSearch aria-hidden="true" />
                        <input
                          type="search"
                          value={savedCandidateSearch}
                          onChange={(event) => setSavedCandidateSearch(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') event.preventDefault()
                          }}
                          placeholder="Nome, e-mail ou cargo"
                          autoComplete="off"
                        />
                      </span>
                    </label>

                    <label className="saved-candidate-select">
                      Selecionar candidato
                      <select
                        value={selectedSavedId}
                        onChange={handleSavedCandidateSelection}
                        aria-describedby="saved-candidate-help"
                      >
                        <option value="">Escolha na lista...</option>
                        {savedCandidateOptions.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {[
                              candidate.nome || candidate.nomeCompleto || 'Sem nome',
                              candidate.email,
                              candidate.cargoAtual
                            ].filter(Boolean).join(' — ')}
                          </option>
                        ))}
                      </select>
                    </label>

                    <p id="saved-candidate-help" className="saved-candidate-help">
                      Os dados poderão ser revisados antes do envio.
                    </p>

                    {savedCandidateSearch.trim() && !visibleSavedCandidates.length && (
                      <p className="saved-candidate-no-results" role="status">
                        Nenhum candidato corresponde à busca.
                      </p>
                    )}

                    {selectedSavedCandidate && (
                      <div className="saved-candidate-selected" aria-live="polite">
                        <span>Candidato selecionado</span>
                        <strong>{selectedSavedCandidate.nome || selectedSavedCandidate.nomeCompleto}</strong>
                        <small>
                          {[selectedSavedCandidate.email, selectedSavedCandidate.cargoAtual]
                            .filter(Boolean)
                            .join(' · ')}
                        </small>
                      </div>
                    )}
                  </>
                )}
              </aside>
            </form>
          )}
        </main>
      </div>

      {/* Componente de rodapé. */}
      <Footer />
    </>
  )
}

// Responsabilidade: renderizar um campo de texto reutilizável com label.
function Field({ className = '', label, ...props }) {
  return (
    <label className={`field-label ${className}`}>
      {label}
      <input {...props} />
    </label>
  )
}

// Responsabilidade: renderizar um campo select reutilizável com opção inicial padrão.
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

// Responsabilidade: renderizar uma área de texto reutilizável com label.
function Textarea({ label, ...props }) {
  return (
    <label className="field-label full-field">
      {label}
      <textarea {...props} />
    </label>
  )
}

// Responsabilidade: renderizar o campo de habilidades com tokens removíveis.
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
