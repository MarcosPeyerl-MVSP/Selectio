// Objetivo do arquivo: renderizar e controlar a página de edição de vaga da empresa.
// O componente valida a sessão da empresa, carrega os dados da vaga, verifica se a vaga
// pertence à empresa autenticada, permite ajustes no formulário e envia a atualização para o Firestore.

import './styles/EmpresaCriarVaga.css'
import './styles/EmpresaEditarVaga.css'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import Sidebar from '../../components/layout/Sidebar'
import Footer from '../../components/layout/Footer'
import PageLoader from '../../components/ui/PageLoader'
import { buscarVagaPorId, editarVaga } from '../../services/firestoreVagas'
import { getFirebaseUid } from '../../services/identidadeFirebase'
import { useToast } from '../../hooks/useToast'

// Estado inicial do formulário de edição da vaga.
const initialForm = {
  titulo: '',
  area: '',
  salarioMin: '',
  salarioMax: '',
  experiencia: 'Sênior',
  experienciaPersonalizada: '',
  tipo: 'Tempo Integral',
  tipoDataInicio: '',
  tipoDataFim: '',
  descricaoCurta: '',
  descricaoLonga: '',
  requisitos: '',
  habilidades: '',
  beneficios: '',
  recompensaTipo: 'fixo',
  recompensaValor: 'R$ 2.500',
  localizacao: '',
  dataLimite: '',
  status: 'aberta',
  imagem: '',
}

const getLocalDateInputValue = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Responsabilidade: formatar valores numéricos como moeda brasileira.
const formatCurrency = (value, language) => {
  const numbers = String(value || '').replace(/\D/g, '')
  const amount = Number(numbers || 0)

  return amount.toLocaleString(language, {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

// Responsabilidade: extrair número de um texto monetário.
const getNumberFromCurrency = (value) => Number(String(value || '').replace(/\D/g, ''))

// Responsabilidade: transformar texto separado por vírgulas em lista.
const parseList = (value) => String(value || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

// Responsabilidade: transformar uma lista em texto separado por vírgulas para preencher o formulário.
const listToText = (value) => Array.isArray(value) ? value.join(', ') : ''

// Responsabilidade: normalizar partes do salário para o formato monetário usado no formulário.
const formatSalaryPart = (value, language) => {
  const text = String(value || '').trim()
  if (!text || text === 'A combinar') return ''

  const match = text.match(/(\d[\d.,]*)\s*k?/i)
  if (!match) return ''

  const amount = Number(match[1].replace(/\./g, '').replace(',', '.'))
  const normalizedAmount = /k/i.test(match[0]) ? amount * 1000 : amount

  return formatCurrency(String(normalizedAmount), language)
}

// Responsabilidade: separar salário mínimo e máximo a partir do texto salvo na vaga.
const getSalaryParts = (value, language) => {
  if (!value || value === 'A combinar') return ['', '']

  const parts = String(value)
    .split(/[–-]/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length >= 2) {
    return parts.map((part) => formatSalaryPart(part, language)).slice(0, 2)
  }

  return [formatSalaryPart(parts[0], language), '']
}

// Responsabilidade: converter o texto de recompensa salvo na vaga para os campos do formulário.
const getRecompensaForm = (value, tipoSalvo = '', language = 'pt-BR') => {
  const defaultReward = formatCurrency('2500', language)

  if (tipoSalvo === 'percentual') {
    return { recompensaTipo: 'percentual', recompensaValor: defaultReward }
  }

  if (tipoSalvo === 'personalizado') {
    return { recompensaTipo: 'personalizado', recompensaValor: defaultReward }
  }

  if (value === '10% Salário') {
    return { recompensaTipo: 'percentual', recompensaValor: defaultReward }
  }

  if (value === 'Consultar') {
    return { recompensaTipo: 'personalizado', recompensaValor: defaultReward }
  }

  return {
    recompensaTipo: 'fixo',
    recompensaValor: value ? formatCurrency(String(getNumberFromCurrency(value)), language) : defaultReward
  }
}

// Responsabilidade: converter o tipo salvo da vaga para os campos do formulário,
// incluindo datas quando o tipo for contrato temporário.
const getTipoForm = (value) => {
  const temporaryMatch = String(value || '').match(/^Contrato temporário \((\d{2})\/(\d{2})\/(\d{4}) [–-] (\d{2})\/(\d{2})\/(\d{4})\)$/)

  if (!temporaryMatch) {
    return { tipo: value || 'Tempo Integral', tipoDataInicio: '', tipoDataFim: '' }
  }

  const [, startDay, startMonth, startYear, endDay, endMonth, endYear] = temporaryMatch
  return {
    tipo: 'Contrato temporário',
    tipoDataInicio: `${startYear}-${startMonth}-${startDay}`,
    tipoDataFim: `${endYear}-${endMonth}-${endDay}`,
  }
}

function EditarVagaEmpresa() {
  const { t, i18n } = useTranslation(['company', 'common'])
  // Identificador da vaga recebido pela rota.
  const { id } = useParams()

  // Hook usado para redirecionar a empresa em fluxos de login e pós-atualização.
  const navigate = useNavigate()
  const toast = useToast()
  const language = i18n.resolvedLanguage || i18n.language

  // Recupera a empresa autenticada salva no localStorage.
  const [empresa] = useState(() => {
    const storedEmpresa = localStorage.getItem('empresaUser')
    return storedEmpresa ? JSON.parse(storedEmpresa) : null
  })

  // Controla os campos do formulário de edição.
  const [form, setForm] = useState(() => ({
    ...initialForm,
    recompensaValor: formatCurrency('2500', language)
  }))

  // Controla o envio da atualização.
  const [loading, setLoading] = useState(false)

  // Controla o carregamento inicial dos dados da vaga.
  const [loadingVaga, setLoadingVaga] = useState(true)

  // Armazena mensagens de erro, bloqueio ou sucesso.
  const [message, setMessage] = useState('')

  // Define se a empresa autenticada pode editar a vaga carregada.
  const [canEdit, setCanEdit] = useState(false)

  useEffect(() => {
    // Regra de acesso: sem empresa autenticada, redireciona para login.
    if (!empresa) {
      navigate(`/login?redirect=/editar-vaga/empresa/${id}`)
    }
  }, [empresa, id, navigate])

  useEffect(() => {
    if (!empresa) return

    // Responsabilidade: buscar a vaga e validar se ela pertence à empresa autenticada.
    const fetchVaga = async () => {
      try {
        const data = await buscarVagaPorId(id)

        if (!data) {
          setMessage(t('jobForm.notFound'))
          toast.error(t('jobForm.notFound'))
          return
        }

        if (String(data.empresaId || data.empresaUid || '') !== String(getFirebaseUid(empresa))) {
          setMessage(t('jobForm.notOwned'))
          toast.warning(t('jobForm.notOwned'))
          setCanEdit(false)
          return
        }

        const [salarioMin, salarioMax] = data.salarioMinValor || data.salarioMaxValor
          ? [
              data.salarioMinValor ? formatCurrency(String(data.salarioMinValor), language) : '',
              data.salarioMaxValor ? formatCurrency(String(data.salarioMaxValor), language) : ''
            ]
          : getSalaryParts(data.salario, language)
        const recompensa = getRecompensaForm(data.recompensa, data.recompensaTipo, language)
        const tipo = data.tipoBase
          ? {
              tipo: data.tipoBase,
              tipoDataInicio: data.tipoDataInicio || '',
              tipoDataFim: data.tipoDataFim || ''
            }
          : getTipoForm(data.tipo)

        // Preenche o formulário com os dados carregados da vaga.
        setForm({
          ...initialForm,
          titulo: data.titulo || '',
          area: data.area || '',
          salarioMin,
          salarioMax,
          ...tipo,
          descricaoCurta: data.descricaoCurta || '',
          descricaoLonga: data.descricaoLonga || '',
          requisitos: listToText(data.requisitos),
          beneficios: listToText(data.beneficios),
          ...recompensa,
          localizacao: data.localizacao || '',
          dataLimite: data.dataLimite || '',
          status: data.status === 'expirada' ? 'aberta' : data.status || 'aberta',
          imagem: data.imagem || '',
        })
        setCanEdit(true)
      } catch {
        setMessage(t('jobForm.loadError'))
        toast.error(t('jobForm.loadError'))
        setCanEdit(false)
      } finally {
        setLoadingVaga(false)
      }
    }

    fetchVaga()
  }, [empresa, id, language, t, toast])

  // Responsabilidade: atualizar campos simples do formulário.
  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  // Responsabilidade: atualizar campos monetários com formatação de moeda.
  const handleCurrencyChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: formatCurrency(value, language) }))
  }

  // Responsabilidade: definir o texto de recompensa conforme o tipo selecionado.
  const getRecompensa = () => {
    if (form.recompensaTipo === 'percentual') return '10% Salário'
    if (form.recompensaTipo === 'personalizado') return 'Consultar'
    return form.recompensaValor
  }

  // Responsabilidade: formatar data ISO para o padrão brasileiro.
  const formatDate = (value) => {
    if (!value) return ''
    const [year, month, day] = value.split('-')
    return `${day}/${month}/${year}`
  }

  // Responsabilidade: validar dados e enviar a atualização da vaga para o Firestore.
  const handleSubmit = async (event) => {
    event.preventDefault()
    setMessage('')

    if (!empresa) return

    if (!form.titulo || !form.area || !form.descricaoLonga || !form.localizacao) {
      setMessage(t('jobForm.requiredFields'))
      toast.warning(t('jobForm.requiredFields'))
      return
    }

    const salarioMin = getNumberFromCurrency(form.salarioMin)
    const salarioMax = getNumberFromCurrency(form.salarioMax)
    if (salarioMin && salarioMax && salarioMin > salarioMax) {
      setMessage(t('jobForm.salaryRangeError'))
      toast.warning(t('jobForm.salaryRangeError'))
      return
    }

    if (form.tipo === 'Contrato temporário' && (!form.tipoDataInicio || !form.tipoDataFim)) {
      setMessage(t('jobForm.temporaryDatesRequired'))
      toast.warning(t('jobForm.temporaryDatesRequired'))
      return
    }

    if (
      form.status === 'aberta'
      && form.dataLimite
      && form.dataLimite < getLocalDateInputValue()
    ) {
      setMessage(t('jobForm.deadlineReopen'))
      toast.warning(t('jobForm.deadlineReopen'))
      return
    }

    const salario = form.salarioMin || form.salarioMax
      ? `${form.salarioMin || 'A combinar'} - ${form.salarioMax || 'A combinar'}`
      : 'A combinar'

    const empresaUid = getFirebaseUid(empresa)

    // Payload enviado ao Firestore com os dados atualizados da vaga.
    const payload = {
      titulo: form.titulo,
      empresa: empresa.nomeEmpresa || empresa.nome || 'Empresa Selectio',
      empresaNome: empresa.nomeEmpresa || empresa.nome || 'Empresa Selectio',
      empresaId: empresaUid,
      empresaUid,
      localizacao: form.localizacao,
      salario,
      salarioMinValor: salarioMin || null,
      salarioMaxValor: salarioMax || null,
      tipo: form.tipo === 'Contrato temporário'
        ? `${form.tipo} (${formatDate(form.tipoDataInicio)} - ${formatDate(form.tipoDataFim)})`
        : form.tipo,
      tipoBase: form.tipo,
      tipoDataInicio: form.tipo === 'Contrato temporário' ? form.tipoDataInicio : '',
      tipoDataFim: form.tipo === 'Contrato temporário' ? form.tipoDataFim : '',
      recompensa: getRecompensa(),
      recompensaTipo: form.recompensaTipo,
      recompensaValorFixo: form.recompensaTipo === 'fixo'
        ? getNumberFromCurrency(form.recompensaValor)
        : null,
      descricaoCurta: form.descricaoCurta || form.descricaoLonga.slice(0, 160),
      descricaoLonga: form.descricaoLonga,
      beneficios: parseList(form.beneficios),
      requisitos: [
        ...parseList(form.requisitos),
        ...parseList(form.habilidades),
        form.experiencia === 'Personalizado' ? form.experienciaPersonalizada : form.experiencia,
      ].filter(Boolean),
      imagem: form.imagem || 'https://images.unsplash.com/photo-1497366216548-37526070297c',
      area: form.area,
      status: form.status,
      dataLimite: form.dataLimite,
    }

    try {
      setLoading(true)
      await editarVaga(id, payload)

      setMessage(t('jobForm.updated'))
      toast.success(t('jobForm.updated'))
      navigate(`/vaga/${id}`)
    } catch {
      setMessage(t('jobForm.saveError'))
      toast.error(t('jobForm.saveError'))
    } finally {
      setLoading(false)
    }
  }

  // Evita renderizar a página enquanto não há empresa autenticada.
  if (!empresa) return null

  return (
    <div className="empresa-vaga-page">
      <Navbar />

      <div className="empresa-vaga-layout">
        <Sidebar type="empresa" user={empresa} />

        <main className="empresa-vaga-content editar-vaga-content">
          <section className="empresa-vaga-intro">
            <span>{t('jobForm.editEyebrow')}</span>
            <h1>
              {t('jobForm.editTitleFirst')}
              <br />
              <strong>{t('jobForm.editTitleSecond')}</strong>
            </h1>
            <p>{t('jobForm.editDescription')}</p>
            <Link className="editar-vaga-back" to="/vagas">{t('jobForm.backJobs')}</Link>
          </section>

          {loadingVaga ? (
            <PageLoader label={t('jobForm.loading')} compact />
          ) : !canEdit ? (
            <section className="vaga-step">
              <p>{message || t('jobForm.editUnavailable')}</p>
              <Link className="editar-vaga-back" to="/vagas">{t('jobForm.backJobs')}</Link>
            </section>
          ) : (
            <form className="empresa-vaga-form" onSubmit={handleSubmit}>
              <section className="vaga-step">
                <div className="step-header">
                  <h2>{t('jobForm.steps.foundations')}</h2>
                  <span>{t('jobForm.steps.step1')}</span>
                </div>

                <label>{t('jobForm.fields.title')}</label>
                <input name="titulo" value={form.titulo} onChange={handleChange} />

                <div className="form-grid three">
                  <div>
                    <label>{t('jobForm.fields.area')}</label>
                    <input name="area" value={form.area} onChange={handleChange} />
                  </div>
                  <div>
                    <label>{t('jobForm.fields.salaryRange')}</label>
                    <input name="salarioMin" placeholder={t('jobForm.placeholders.minimum')} value={form.salarioMin} onChange={handleCurrencyChange} />
                  </div>
                  <div>
                    <label>&nbsp;</label>
                    <input name="salarioMax" placeholder={t('jobForm.placeholders.maximum')} value={form.salarioMax} onChange={handleCurrencyChange} />
                  </div>
                </div>

                <div className="form-grid two">
                  <div>
                    <label>{t('jobForm.fields.experience')}</label>
                    <div className="option-grid">
                      {[
                        ['Júnior', t('jobForm.experience.junior')],
                        ['Pleno', t('jobForm.experience.mid')],
                        ['Sênior', t('jobForm.experience.senior')],
                        ['Personalizado', t('jobForm.experience.custom')]
                      ].map(([option, label]) => (
                        <button key={option} type="button" className={form.experiencia === option ? 'selected' : ''} onClick={() => setForm((current) => ({ ...current, experiencia: option }))}>
                          {label}
                        </button>
                      ))}
                    </div>
                    {form.experiencia === 'Personalizado' && (
                      <textarea className="small inline-textarea" name="experienciaPersonalizada" placeholder={t('jobForm.placeholders.customExperience')} value={form.experienciaPersonalizada} onChange={handleChange} />
                    )}
                  </div>

                  <div>
                    <label>{t('jobForm.fields.employmentType')}</label>
                    <div className="option-grid">
                      {[
                        ['Tempo Integral', t('jobForm.employment.fullTime')],
                        ['Freelance', t('jobForm.employment.freelance')],
                        ['Meio Período', t('jobForm.employment.partTime')],
                        ['Remoto', t('jobForm.employment.remote')],
                        ['Contrato temporário', t('jobForm.employment.temporary')]
                      ].map(([option, label]) => (
                        <button key={option} type="button" className={form.tipo === option ? 'selected outline' : ''} onClick={() => setForm((current) => ({ ...current, tipo: option }))}>
                          {label}
                        </button>
                      ))}
                    </div>
                    {form.tipo === 'Contrato temporário' && (
                      <div className="temporary-contract-grid">
                        <div>
                          <label>{t('jobForm.fields.startDate')}</label>
                          <input className="inline-input" name="tipoDataInicio" type="date" value={form.tipoDataInicio} onChange={handleChange} />
                        </div>
                        <div>
                          <label>{t('jobForm.fields.endDate')}</label>
                          <input className="inline-input" name="tipoDataFim" type="date" value={form.tipoDataFim} onChange={handleChange} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="vaga-step">
                <div className="step-header">
                  <h2>{t('jobForm.steps.description')}</h2>
                  <span>{t('jobForm.steps.step2')}</span>
                </div>

                <label>{t('jobForm.fields.summary')}</label>
                <input name="descricaoCurta" value={form.descricaoCurta} onChange={handleChange} />

                <label>{t('jobForm.fields.description')}</label>
                <textarea name="descricaoLonga" value={form.descricaoLonga} onChange={handleChange} />

                <div className="form-grid two">
                  <div>
                    <label>{t('jobForm.fields.requirements')}</label>
                    <textarea className="small" name="requisitos" value={form.requisitos} onChange={handleChange} />
                    <TokenPreview items={parseList(form.requisitos)} />
                  </div>
                  <div>
                    <label>{t('jobForm.fields.skills')}</label>
                    <textarea className="small" name="habilidades" value={form.habilidades} onChange={handleChange} />
                    <TokenPreview items={parseList(form.habilidades)} />
                  </div>
                </div>

                <div className="form-grid two">
                  <div>
                    <label>{t('jobForm.fields.benefits')}</label>
                    <textarea className="small" name="beneficios" value={form.beneficios} onChange={handleChange} />
                    <TokenPreview items={parseList(form.beneficios)} />
                  </div>
                  <div>
                    <label>{t('jobForm.fields.image')}</label>
                    <input name="imagem" value={form.imagem} onChange={handleChange} />
                  </div>
                </div>
              </section>

              <section className="vaga-step">
                <div className="step-header">
                  <div>
                    <h2>{t('jobForm.steps.reward')}</h2>
                    <p>{t('jobForm.rewardEditDescription')}</p>
                  </div>
                  <span>{t('jobForm.steps.step3')}</span>
                </div>

                <div className="reward-grid">
                  {[
                    ['fixo', t('jobForm.fixedValue'), form.recompensaValor],
                    ['percentual', t('jobForm.percentage'), t('jobForm.salaryPercentage')],
                    ['personalizado', t('jobForm.custom'), t('jobForm.consult')],
                  ].map(([value, label, text]) => (
                    <button key={value} type="button" className={form.recompensaTipo === value ? 'selected' : ''} onClick={() => setForm((current) => ({ ...current, recompensaTipo: value }))}>
                      <span>{label}</span>
                      <strong>{text}</strong>
                    </button>
                  ))}
                </div>
                {form.recompensaTipo === 'fixo' && (
                  <input className="reward-value-input" name="recompensaValor" value={form.recompensaValor} onChange={handleCurrencyChange} />
                )}
              </section>

              <section className="vaga-step">
                <div className="step-header">
                  <h2>{t('jobForm.steps.logistics')}</h2>
                  <span>{t('jobForm.steps.step4')}</span>
                </div>

                <div className="form-grid two">
                  <div>
                    <label>{t('jobForm.fields.location')}</label>
                    <input name="localizacao" value={form.localizacao} onChange={handleChange} />
                  </div>
                  <div>
                    <label>{t('jobForm.fields.deadline')}</label>
                    <input name="dataLimite" type="date" value={form.dataLimite} onChange={handleChange} />
                  </div>
                </div>

                <label>{t('jobForm.fields.status')}</label>
                <div className="option-grid">
                  {[
                    ['aberta', t('common:statuses.jobs.aberta')],
                    ['pausada', t('common:statuses.jobs.pausada')],
                    ['encerrada', t('common:statuses.jobs.encerrada')]
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={form.status === value ? 'selected' : ''}
                      onClick={() => setForm((current) => ({ ...current, status: value }))}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Exibe mensagens de validação, erro ou sucesso. */}
              {message && <p className="empresa-vaga-message">{message}</p>}

              <div className="form-actions">
                <Link className="draft-btn" to={`/vaga/${id}`}>{t('jobForm.cancel')}</Link>
                <button type="submit" className="finish-btn" disabled={loading}>
                  {loading ? t('jobForm.saving') : t('jobForm.saveAdjustments')}
                </button>
              </div>
            </form>
          )}
        </main>
      </div>

      <Footer />
    </div>
  )
}

// Responsabilidade: exibir uma prévia visual dos itens separados por vírgula.
function TokenPreview({ items }) {
  if (!items.length) return null

  return (
    <div className="token-preview">
      {items.map((item) => (
        <label key={item}>
          <input type="checkbox" checked readOnly />
          <span>{item}</span>
        </label>
      ))}
    </div>
  )
}

export default EditarVagaEmpresa
