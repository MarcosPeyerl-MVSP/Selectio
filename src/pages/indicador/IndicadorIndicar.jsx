// Objetivo do arquivo: renderizar o formulário de indicação de candidato para uma vaga.
// A página valida a sessão do indicador, busca os dados da vaga, coleta informações
// do candidato indicado e envia a indicação para o Firestore.

import './styles/IndicadorIndicar.css'
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
import Navbar from '../../components/layout/Navbar'
import Sidebar from '../../components/layout/Sidebar'
import Footer from '../../components/layout/Footer'
import EstadoDados from '../../components/ui/EstadoDados'
import PageLoader from '../../components/ui/PageLoader'
import { buscarVagaPorId, vagaAceitaIndicacoes } from '../../services/firestoreVagas'
import { criarCandidatoIndicado } from '../../services/firestoreCandidatos'
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
  hardSkills: ['Figma', 'React'],
  softSkills: ['Liderança', 'Comunicação'],
  expectativaSalarial: '',
  modeloTrabalho: '',
  avisoPrevio: '',
  curriculoNome: ''
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

// Responsabilidade: recuperar o indicador autenticado salvo no localStorage.
function getIndicador() {
  const stored = localStorage.getItem('indicadorUser')
  if (!stored) return null

  try {
    return JSON.parse(stored)
  } catch {
    // Fluxo de segurança: remove a sessão caso o JSON salvo esteja inválido.
    localStorage.removeItem('indicadorUser')
    return null
  }
}

function Indicar() {
  // Identificador da vaga recebido pela rota.
  const { vagaId } = useParams()

  // Hook usado para redirecionar após envio da indicação.
  const navigate = useNavigate()
  const toast = useToast()

  // Mantém os dados do indicador autenticado.
  const [indicador] = useState(getIndicador)

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

  useEffect(() => {
    // Responsabilidade: buscar os dados da vaga selecionada antes de exibir o formulário.
    const fetchVaga = async () => {
      if (!indicador) return

      try {
        setLoadError('')
        const data = await buscarVagaPorId(vagaId)

        if (!data) {
          throw new Error('Vaga não encontrada')
        }

        if (!vagaAceitaIndicacoes(data)) {
          throw new Error('Esta vaga não está aberta para novas indicações.')
        }

        setVaga(data)
      } catch (err) {
        setLoadError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchVaga()
  }, [indicador, vagaId, reloadKey])

  const tentarNovamente = () => {
    setLoading(true)
    setReloadKey((value) => value + 1)
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

  // Responsabilidade: registrar o nome do arquivo de currículo selecionado.
  const handleFile = (event) => {
    const file = event.target.files?.[0]
    setForm((current) => ({ ...current, curriculoNome: file?.name || '' }))
  }

  // Responsabilidade: enviar a indicação do candidato para o Firestore.
  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')

    if (!vaga) {
      setSaving(false)
      setMessage('Vaga não carregada para finalizar a indicação.')
      toast.warning('Vaga não carregada para finalizar a indicação.')
      return
    }

    try {
      await criarCandidatoIndicado({ dados: form, indicador, vaga })
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
                        </>
                      ) : (
                        'PDF, DOCX ou RTF (Máx. 10MB)'
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

              <aside className="saved-candidate-card">
                <div className="saved-icon">
                  <FaSearch />
                </div>
                <h2>Adicionar candidato já pré-salvo</h2>
                <p>Selecione um talento da sua base de indicações anteriores para agilizar o processo.</p>
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
