// Objetivo do arquivo: renderizar e controlar a página de criação de vaga da empresa.
// O componente valida a sessão da empresa, coleta dados da vaga, aplica formatação
// em valores monetários, valida regras do formulário e envia a nova vaga para o Firestore.

import './styles/EmpresaCriarVaga.css'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import Sidebar from '../../components/layout/Sidebar'
import Footer from '../../components/layout/Footer'
import EstadoDados from '../../components/ui/EstadoDados'
import RubricaCompatibilidadeForm from '../../components/compatibilidade/RubricaCompatibilidadeForm'
import { criarVaga } from '../../services/firestoreVagas'
import { getFirebaseUid } from '../../services/identidadeFirebase'
import { useToast } from '../../hooks/useToast'
import {
  isModoEmpresarial,
  obterSetorAtual,
  podeSolicitarVagaEmpresarial
} from '../../utils/modoEmpresarial'
import {
  criarRubricaCompatibilidadePadrao,
  prepararRubricaParaSalvar,
  validarRubricaCompatibilidade
} from '../../utils/rubricaCompatibilidade'

// Estado inicial do formulário de criação de vaga.
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
}

const getLocalDateInputValue = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatCurrency = (value, language) => {
  const numbers = String(value || '').replace(/\D/g, '')
  const amount = Number(numbers || 0)

  return amount.toLocaleString(language, {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

function CriarVagaEmpresa() {
  const { t, i18n } = useTranslation(['company', 'common'])
  // Hook usado para redirecionar a empresa após criação da vaga ou ausência de sessão.
  const navigate = useNavigate()
  const toast = useToast()
  const language = i18n.resolvedLanguage || i18n.language

  // Recupera a empresa autenticada salva no localStorage.
  const [empresa] = useState(() => {
    const storedEmpresa = localStorage.getItem('empresaUser')
    return storedEmpresa ? JSON.parse(storedEmpresa) : null
  })

  // Controla os campos do formulário de vaga.
  const [form, setForm] = useState(() => ({
    ...initialForm,
    recompensaValor: formatCurrency('2500', language)
  }))
  const [rubrica, setRubrica] = useState(() => criarRubricaCompatibilidadePadrao())

  // Controla o estado de envio da vaga.
  const [loading, setLoading] = useState(false)

  // Armazena mensagens de erro ou sucesso do formulário.
  const [message, setMessage] = useState('')
  const modoEmpresarialAtivo = isModoEmpresarial(empresa)
  const setorAtual = obterSetorAtual(empresa)
  const podeSolicitarVaga = podeSolicitarVagaEmpresarial(empresa)

  useEffect(() => {
    // Regra de acesso: sem empresa autenticada, redireciona para login.
    if (!empresa) {
      navigate('/login')
    }
  }, [empresa, navigate])

  // Responsabilidade: atualizar campos simples do formulário.
  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  // Responsabilidade: transformar texto separado por vírgulas em lista.
  const parseList = (value) => value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  // Responsabilidade: definir o texto da recompensa conforme o tipo selecionado.
  const getRecompensa = () => {
    if (form.recompensaTipo === 'percentual') return '10% Salário'
    if (form.recompensaTipo === 'personalizado') return 'Consultar'
    return form.recompensaValor
  }

  // Responsabilidade: atualizar campos monetários já formatados.
  const handleCurrencyChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: formatCurrency(value, language) }))
  }

  // Responsabilidade: extrair o valor numérico de um texto monetário.
  const getNumberFromCurrency = (value) => Number(value.replace(/\D/g, ''))

  // Responsabilidade: formatar data ISO para exibição no padrão brasileiro.
  const formatDate = (value) => {
    if (!value) return ''
    const [year, month, day] = value.split('-')
    return `${day}/${month}/${year}`
  }

  // Responsabilidade: validar o formulário e enviar a vaga para o Firestore.
  const handleSubmit = async (event, status = 'aberta') => {
    event.preventDefault()
    setMessage('')

    if (!empresa) return

    if (!podeSolicitarVaga) {
      setMessage(t('jobForm.departmentOnly'))
      toast.warning(t('jobForm.departmentOnly'))
      return
    }

    // Validação: campos principais obrigatórios da vaga.
    if (!form.titulo || !form.area || !form.descricaoLonga || !form.localizacao) {
      setMessage(t('jobForm.requiredFields'))
      toast.warning(t('jobForm.requiredFields'))
      return
    }

    // Validação: salário mínimo não pode ser maior que o salário máximo.
    const salarioMin = getNumberFromCurrency(form.salarioMin)
    const salarioMax = getNumberFromCurrency(form.salarioMax)
    if (salarioMin && salarioMax && salarioMin > salarioMax) {
      setMessage(t('jobForm.salaryRangeError'))
      toast.warning(t('jobForm.salaryRangeError'))
      return
    }

    // Validação: contrato temporário exige datas de início e fim.
    if (form.tipo === 'Contrato temporário' && (!form.tipoDataInicio || !form.tipoDataFim)) {
      setMessage(t('jobForm.temporaryDatesRequired'))
      toast.warning(t('jobForm.temporaryDatesRequired'))
      return
    }

    // Validação: data de início não pode ser posterior à data de fim.
    if (
      form.tipo === 'Contrato temporário'
      && form.tipoDataInicio
      && form.tipoDataFim
      && form.tipoDataInicio > form.tipoDataFim
    ) {
      setMessage(t('jobForm.dateOrderError'))
      toast.warning(t('jobForm.dateOrderError'))
      return
    }

    if (form.dataLimite && form.dataLimite < getLocalDateInputValue()) {
      setMessage(t('jobForm.deadlinePast'))
      toast.warning(t('jobForm.deadlinePast'))
      return
    }

    const validacaoRubrica = validarRubricaCompatibilidade(rubrica)
    if (!validacaoRubrica.valida) {
      const mensagem = t(`compatibilityRubric.errors.${validacaoRubrica.motivo}`)
      setMessage(mensagem)
      toast.warning(mensagem)
      return
    }

    // Monta o texto de salário exibido na vaga.
    const salario = form.salarioMin || form.salarioMax
      ? `${form.salarioMin || 'A combinar'} – ${form.salarioMax || 'A combinar'}`
      : 'A combinar'

    const empresaUid = getFirebaseUid(empresa)
    const statusFinal = modoEmpresarialAtivo ? 'pausada' : status

    // Payload enviado ao Firestore com os dados da vaga.
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
        ? `${form.tipo} (${formatDate(form.tipoDataInicio)} – ${formatDate(form.tipoDataFim)})`
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
      imagem: 'https://images.unsplash.com/photo-1497366216548-37526070297c',
      area: form.area,
      status: statusFinal,
      dataLimite: form.dataLimite,
      modoEmpresa: modoEmpresarialAtivo ? 'empresarial' : 'classico',
      statusAprovacao: modoEmpresarialAtivo ? 'solicitada' : '',
      solicitanteSetor: modoEmpresarialAtivo ? {
        id: setorAtual?.id || '',
        nome: setorAtual?.nome || 'Chefe de departamento'
      } : null,
      historicoAprovacao: modoEmpresarialAtivo ? [{
        statusAprovacao: 'solicitada',
        comentario: '',
        setor: setorAtual?.nome || 'Chefe de departamento',
        usuario: empresa.nomeEmpresa || empresa.nome || '',
        criadoEm: new Date().toISOString()
      }] : [],
      rubricaCompatibilidade: prepararRubricaParaSalvar(rubrica),
    }

    try {
      setLoading(true)

      // Integração: envia a nova vaga para cadastro no Firestore.
      await criarVaga(payload)

      const mensagemSucesso = modoEmpresarialAtivo
        ? t('jobForm.requestSent')
        : status === 'pausada'
          ? t('jobForm.savedPaused')
          : t('jobForm.created')

      setMessage(mensagemSucesso)
      toast.success(mensagemSucesso)
      setForm({ ...initialForm, recompensaValor: formatCurrency('2500', language) })
      setRubrica(criarRubricaCompatibilidadePadrao())
      navigate(modoEmpresarialAtivo ? '/painel/empresa?secao=aprovacoes' : '/vagas')
    } catch {
      setMessage(t('jobForm.saveError'))
      toast.error(t('jobForm.saveError'))
    } finally {
      setLoading(false)
    }
  }

  // Evita renderizar o formulário enquanto não há empresa autenticada.
  if (!empresa) {
    return null
  }

  if (modoEmpresarialAtivo && !podeSolicitarVaga) {
    return (
      <div className="empresa-vaga-page">
        <Navbar />

        <div className="empresa-vaga-layout">
          <Sidebar type="empresa" user={empresa} />
          <main className="empresa-vaga-content">
            <EstadoDados
              title={t('jobForm.restrictedTitle')}
              description={t('jobForm.restrictedDescription')}
              actionLabel={t('jobForm.backPanel')}
              onAction={() => navigate('/painel/empresa')}
            />
          </main>
        </div>

        <Footer />
      </div>
    )
  }

  return (
    <div className="empresa-vaga-page">
      {/* Componente de navegação principal. */}
      <Navbar />

      <div className="empresa-vaga-layout">
        {/* Menu lateral do painel da empresa. */}
        <Sidebar type="empresa" user={empresa} />

        <main className="empresa-vaga-content">
          <section className="empresa-vaga-intro">
            <span>{modoEmpresarialAtivo ? t('jobForm.requestEyebrow') : t('jobForm.draftEyebrow')}</span>
            <h1>
              {t('jobForm.createTitleFirst')}
              <br />
              <strong>{t('jobForm.createTitleSecond')}</strong>
            </h1>
            <p>{modoEmpresarialAtivo ? t('jobForm.requestDescription') : t('jobForm.createDescription')}</p>
          </section>

          <form className="empresa-vaga-form" onSubmit={handleSubmit}>
            <RubricaCompatibilidadeForm rubrica={rubrica} onChange={setRubrica} />

            <section className="vaga-step">
              <div className="step-header">
                <h2>{t('jobForm.steps.foundations')}</h2>
                <span>{t('jobForm.steps.step1')}</span>
              </div>

              <label>{t('jobForm.fields.title')}</label>
              <input
                name="titulo"
                placeholder={t('jobForm.placeholders.title')}
                value={form.titulo}
                onChange={handleChange}
              />

              <div className="form-grid three">
                <div>
                  <label>{t('jobForm.fields.area')}</label>
                  <input name="area" placeholder={t('jobForm.placeholders.area')} value={form.area} onChange={handleChange} />
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
                      <button
                        key={option}
                        type="button"
                        className={form.experiencia === option ? 'selected' : ''}
                        onClick={() => setForm((current) => ({ ...current, experiencia: option }))}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {form.experiencia === 'Personalizado' && (
                    <textarea
                      className="small inline-textarea"
                      name="experienciaPersonalizada"
                      placeholder={t('jobForm.placeholders.customExperience')}
                      value={form.experienciaPersonalizada}
                      onChange={handleChange}
                    />
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
                      <button
                        key={option}
                        type="button"
                        className={form.tipo === option ? 'selected outline' : ''}
                        onClick={() => setForm((current) => ({ ...current, tipo: option }))}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {form.tipo === 'Contrato temporário' && (
                    <div className="temporary-contract-grid">
                      <div>
                        <label>{t('jobForm.fields.startDate')}</label>
                        <input
                          className="inline-input"
                          name="tipoDataInicio"
                          type="date"
                          value={form.tipoDataInicio}
                          onChange={handleChange}
                          required
                        />
                      </div>
                      <div>
                        <label>{t('jobForm.fields.endDate')}</label>
                        <input
                          className="inline-input"
                          name="tipoDataFim"
                          type="date"
                          value={form.tipoDataFim}
                          onChange={handleChange}
                          required
                        />
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
              <input
                name="descricaoCurta"
                placeholder={t('jobForm.placeholders.summary')}
                value={form.descricaoCurta}
                onChange={handleChange}
              />

              <label>{t('jobForm.fields.description')}</label>
              <textarea
                name="descricaoLonga"
                placeholder={t('jobForm.placeholders.description')}
                value={form.descricaoLonga}
                onChange={handleChange}
              />

              <div className="form-grid two">
                <div>
                  <label>{t('jobForm.fields.requirements')}</label>
                  <textarea
                    className="small"
                    name="requisitos"
                    placeholder={t('jobForm.placeholders.requirements')}
                    value={form.requisitos}
                    onChange={handleChange}
                  />
                  <TokenPreview items={parseList(form.requisitos)} />
                </div>
                <div>
                  <label>{t('jobForm.fields.skills')}</label>
                  <textarea
                    className="small"
                    name="habilidades"
                    placeholder={t('jobForm.placeholders.skills')}
                    value={form.habilidades}
                    onChange={handleChange}
                  />
                  <TokenPreview items={parseList(form.habilidades)} />
                </div>
              </div>

              <div className="form-grid two">
                <div>
                  <label>{t('jobForm.fields.benefits')}</label>
                  <textarea
                    className="small"
                    name="beneficios"
                    placeholder={t('jobForm.placeholders.benefits')}
                    value={form.beneficios}
                    onChange={handleChange}
                  />
                  <TokenPreview items={parseList(form.beneficios)} />
                </div>
              </div>
            </section>

            <section className="vaga-step">
              <div className="step-header">
                <div>
                  <h2>{t('jobForm.steps.reward')}</h2>
                  <p>{t('jobForm.rewardDescription')}</p>
                </div>
                <span>{t('jobForm.steps.step3')}</span>
              </div>

              <div className="reward-grid">
                {[
                  ['fixo', t('jobForm.fixedValue'), form.recompensaValor],
                  ['percentual', t('jobForm.percentage'), t('jobForm.salaryPercentage')],
                  ['personalizado', t('jobForm.custom'), t('jobForm.consult')],
                ].map(([value, label, text]) => (
                  <button
                    key={value}
                    type="button"
                    className={form.recompensaTipo === value ? 'selected' : ''}
                    onClick={() => setForm((current) => ({ ...current, recompensaTipo: value }))}
                  >
                    <span>{label}</span>
                    <strong>{text}</strong>
                  </button>
                ))}
              </div>
              {form.recompensaTipo === 'fixo' && (
                <input
                  className="reward-value-input"
                  name="recompensaValor"
                  value={form.recompensaValor}
                  onChange={handleCurrencyChange}
                  placeholder={t('jobForm.placeholders.reward')}
                />
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
                  <input
                    name="localizacao"
                    placeholder={t('jobForm.placeholders.location')}
                    value={form.localizacao}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label>{t('jobForm.fields.deadline')}</label>
                  <input
                    name="dataLimite"
                    type="date"
                    value={form.dataLimite}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </section>

            {/* Exibe mensagens de validação, erro ou sucesso do formulário. */}
            {message && <p className="empresa-vaga-message">{message}</p>}

            <div className="form-actions">
              {!modoEmpresarialAtivo && (
                <button
                  type="button"
                  className="draft-btn"
                  disabled={loading}
                  onClick={(event) => handleSubmit(event, 'pausada')}
                >
                  {t('jobForm.savePaused')}
                </button>
              )}
              <button type="submit" className="finish-btn" disabled={loading}>
                {loading ? t('jobForm.saving') : modoEmpresarialAtivo ? t('jobForm.sendAudit') : t('jobForm.finish')}
              </button>
            </div>
          </form>
        </main>
      </div>

      {/* Componente de rodapé. */}
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

export default CriarVagaEmpresa
