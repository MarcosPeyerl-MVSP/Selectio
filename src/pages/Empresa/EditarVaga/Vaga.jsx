// Objetivo do arquivo: renderizar e controlar a página de edição de vaga da empresa.
// O componente valida a sessão da empresa, carrega os dados da vaga, verifica se a vaga
// pertence à empresa autenticada, permite ajustes no formulário e envia a atualização para o Firestore.

import '../CriarVaga/Vaga.css'
import './Vaga.css'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Navbar from '../../../components/Navbar/Navbar/Navbar'
import Sidebar from '../../../components/Sidebar/Sidebar'
import Footer from '../../../components/Footer/Footer'
import { buscarVagaPorId, editarVaga } from '../../../services/firestoreVagas'
import { getFirebaseUid } from '../../../services/firebaseIdentity'

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
  imagem: '',
}

// Responsabilidade: formatar valores numéricos como moeda brasileira.
const formatCurrency = (value) => {
  const numbers = String(value || '').replace(/\D/g, '')
  const amount = Number(numbers || 0)

  return amount.toLocaleString('pt-BR', {
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
const formatSalaryPart = (value) => {
  const text = String(value || '').trim()
  if (!text || text === 'A combinar') return ''

  const match = text.match(/(\d[\d.,]*)\s*k?/i)
  if (!match) return ''

  const amount = Number(match[1].replace(/\./g, '').replace(',', '.'))
  const normalizedAmount = /k/i.test(match[0]) ? amount * 1000 : amount

  return formatCurrency(String(normalizedAmount))
}

// Responsabilidade: separar salário mínimo e máximo a partir do texto salvo na vaga.
const getSalaryParts = (value) => {
  if (!value || value === 'A combinar') return ['', '']

  const parts = String(value)
    .split(/[–-]/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length >= 2) {
    return parts.map(formatSalaryPart).slice(0, 2)
  }

  return [formatSalaryPart(parts[0]), '']
}

// Responsabilidade: converter o texto de recompensa salvo na vaga para os campos do formulário.
const getRecompensaForm = (value) => {
  if (value === '10% Salário') {
    return { recompensaTipo: 'percentual', recompensaValor: 'R$ 2.500' }
  }

  if (value === 'Consultar') {
    return { recompensaTipo: 'personalizado', recompensaValor: 'R$ 2.500' }
  }

  return { recompensaTipo: 'fixo', recompensaValor: value || 'R$ 2.500' }
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
  // Identificador da vaga recebido pela rota.
  const { id } = useParams()

  // Hook usado para redirecionar a empresa em fluxos de login e pós-atualização.
  const navigate = useNavigate()

  // Recupera a empresa autenticada salva no localStorage.
  const [empresa] = useState(() => {
    const storedEmpresa = localStorage.getItem('empresaUser')
    return storedEmpresa ? JSON.parse(storedEmpresa) : null
  })

  // Controla os campos do formulário de edição.
  const [form, setForm] = useState(initialForm)

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
          setMessage('Vaga não encontrada.')
          return
        }

        if (String(data.empresaId || data.empresaUid || '') !== String(getFirebaseUid(empresa))) {
          setMessage('Esta vaga não pertence à sua empresa.')
          setCanEdit(false)
          return
        }

        const [salarioMin, salarioMax] = getSalaryParts(data.salario)
        const recompensa = getRecompensaForm(data.recompensa)
        const tipo = getTipoForm(data.tipo)

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
          imagem: data.imagem || '',
        })
        setCanEdit(true)
      } catch {
        setMessage('Não foi possível carregar a vaga.')
        setCanEdit(false)
      } finally {
        setLoadingVaga(false)
      }
    }

    fetchVaga()
  }, [empresa, id])

  // Responsabilidade: atualizar campos simples do formulário.
  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  // Responsabilidade: atualizar campos monetários com formatação de moeda.
  const handleCurrencyChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: formatCurrency(value) }))
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
      setMessage('Preencha título, área, descrição e localização.')
      return
    }

    const salarioMin = getNumberFromCurrency(form.salarioMin)
    const salarioMax = getNumberFromCurrency(form.salarioMax)
    if (salarioMin && salarioMax && salarioMin > salarioMax) {
      setMessage('O salário mínimo não pode ser maior que o máximo.')
      return
    }

    if (form.tipo === 'Contrato temporário' && (!form.tipoDataInicio || !form.tipoDataFim)) {
      setMessage('Informe a data de início e a data de fim do contrato temporário.')
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
      tipo: form.tipo === 'Contrato temporário'
        ? `${form.tipo} (${formatDate(form.tipoDataInicio)} - ${formatDate(form.tipoDataFim)})`
        : form.tipo,
      recompensa: getRecompensa(),
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
    }

    try {
      setLoading(true)
      await editarVaga(id, payload)

      setMessage('Vaga atualizada com sucesso.')
      navigate(`/vaga/${id}`)
    } catch {
      setMessage('Nao foi possivel salvar a vaga no Firestore.')
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
            <span>EDIÇÃO DE VAGA</span>
            <h1>
              Ajustar
              <br />
              uma <strong>Vaga.</strong>
            </h1>
            <p>Atualize informações da oportunidade, recompensa, requisitos e detalhes de contratação.</p>
            <Link className="editar-vaga-back" to="/vagas">Voltar para vagas</Link>
          </section>

          {loadingVaga ? (
            <section className="vaga-step">
              <p>Carregando vaga...</p>
            </section>
          ) : !canEdit ? (
            <section className="vaga-step">
              <p>{message || 'Não foi possível editar esta vaga.'}</p>
              <Link className="editar-vaga-back" to="/vagas">Voltar para vagas</Link>
            </section>
          ) : (
            <form className="empresa-vaga-form" onSubmit={handleSubmit}>
              <section className="vaga-step">
                <div className="step-header">
                  <h2>Fundamentos da Vaga</h2>
                  <span>PASSO 1 DE 4</span>
                </div>

                <label>Título do cargo / função</label>
                <input name="titulo" value={form.titulo} onChange={handleChange} />

                <div className="form-grid three">
                  <div>
                    <label>Indústria / Área</label>
                    <input name="area" value={form.area} onChange={handleChange} />
                  </div>
                  <div>
                    <label>Faixa salarial</label>
                    <input name="salarioMin" placeholder="Mín." value={form.salarioMin} onChange={handleCurrencyChange} />
                  </div>
                  <div>
                    <label>&nbsp;</label>
                    <input name="salarioMax" placeholder="Máx." value={form.salarioMax} onChange={handleCurrencyChange} />
                  </div>
                </div>

                <div className="form-grid two">
                  <div>
                    <label>Experiência requerida</label>
                    <div className="option-grid">
                      {['Júnior', 'Pleno', 'Sênior', 'Personalizado'].map((option) => (
                        <button key={option} type="button" className={form.experiencia === option ? 'selected' : ''} onClick={() => setForm((current) => ({ ...current, experiencia: option }))}>
                          {option}
                        </button>
                      ))}
                    </div>
                    {form.experiencia === 'Personalizado' && (
                      <textarea className="small inline-textarea" name="experienciaPersonalizada" value={form.experienciaPersonalizada} onChange={handleChange} />
                    )}
                  </div>

                  <div>
                    <label>Tipo de contratação</label>
                    <div className="option-grid">
                      {['Tempo Integral', 'Freelance', 'Meio Período', 'Remoto', 'Contrato temporário'].map((option) => (
                        <button key={option} type="button" className={form.tipo === option ? 'selected outline' : ''} onClick={() => setForm((current) => ({ ...current, tipo: option }))}>
                          {option}
                        </button>
                      ))}
                    </div>
                    {form.tipo === 'Contrato temporário' && (
                      <div className="temporary-contract-grid">
                        <div>
                          <label>Data de início</label>
                          <input className="inline-input" name="tipoDataInicio" type="date" value={form.tipoDataInicio} onChange={handleChange} />
                        </div>
                        <div>
                          <label>Data de fim</label>
                          <input className="inline-input" name="tipoDataFim" type="date" value={form.tipoDataFim} onChange={handleChange} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="vaga-step">
                <div className="step-header">
                  <h2>Descrição da vaga</h2>
                  <span>PASSO 2 DE 4</span>
                </div>

                <label>Resumo da vaga</label>
                <input name="descricaoCurta" value={form.descricaoCurta} onChange={handleChange} />

                <label>Descrição da vaga</label>
                <textarea name="descricaoLonga" value={form.descricaoLonga} onChange={handleChange} />

                <div className="form-grid two">
                  <div>
                    <label>Requisitos</label>
                    <textarea className="small" name="requisitos" value={form.requisitos} onChange={handleChange} />
                    <TokenPreview items={parseList(form.requisitos)} />
                  </div>
                  <div>
                    <label>Habilidades</label>
                    <textarea className="small" name="habilidades" value={form.habilidades} onChange={handleChange} />
                    <TokenPreview items={parseList(form.habilidades)} />
                  </div>
                </div>

                <div className="form-grid two">
                  <div>
                    <label>Benefícios</label>
                    <textarea className="small" name="beneficios" value={form.beneficios} onChange={handleChange} />
                    <TokenPreview items={parseList(form.beneficios)} />
                  </div>
                  <div>
                    <label>Imagem da vaga</label>
                    <input name="imagem" value={form.imagem} onChange={handleChange} />
                  </div>
                </div>
              </section>

              <section className="vaga-step">
                <div className="step-header">
                  <div>
                    <h2>Premiação por Indicação</h2>
                    <p>Ajuste o incentivo exibido para indicadores.</p>
                  </div>
                  <span>PASSO 3 DE 4</span>
                </div>

                <div className="reward-grid">
                  {[
                    ['fixo', 'Valor fixo', form.recompensaValor],
                    ['percentual', 'Percentual', '10% Salário'],
                    ['personalizado', 'Personalizado', 'Consultar'],
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
                  <h2>Logística e Prazos</h2>
                  <span>PASSO 4 DE 4</span>
                </div>

                <div className="form-grid two">
                  <div>
                    <label>Localização</label>
                    <input name="localizacao" value={form.localizacao} onChange={handleChange} />
                  </div>
                  <div>
                    <label>Data limite</label>
                    <input name="dataLimite" type="date" value={form.dataLimite} onChange={handleChange} />
                  </div>
                </div>
              </section>

              {/* Exibe mensagens de validação, erro ou sucesso. */}
              {message && <p className="empresa-vaga-message">{message}</p>}

              <div className="form-actions">
                <Link className="draft-btn" to={`/vaga/${id}`}>Cancelar</Link>
                <button type="submit" className="finish-btn" disabled={loading}>
                  {loading ? 'Salvando...' : 'Salvar ajustes'}
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
