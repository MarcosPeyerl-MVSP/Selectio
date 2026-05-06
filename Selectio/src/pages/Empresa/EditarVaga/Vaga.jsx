import '../CriarVaga/Vaga.css'
import './Vaga.css'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Navbar from '../../../components/Navbar/Navbar/Navbar'
import Sidebar from '../../../components/Sidebar/Sidebar'
import Footer from '../../../components/Footer/Footer'

const initialForm = {
  titulo: '',
  area: '',
  salarioMin: '',
  salarioMax: '',
  experiencia: 'Senior',
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

const formatCurrency = (value) => {
  const numbers = String(value || '').replace(/\D/g, '')
  const amount = Number(numbers || 0)

  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

const getNumberFromCurrency = (value) => Number(String(value || '').replace(/\D/g, ''))

const parseList = (value) => String(value || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

const listToText = (value) => Array.isArray(value) ? value.join(', ') : ''

const formatSalaryPart = (value) => {
  const text = String(value || '').trim()
  if (!text || text === 'A combinar') return ''

  const match = text.match(/(\d[\d.,]*)\s*k?/i)
  if (!match) return ''

  const amount = Number(match[1].replace(/\./g, '').replace(',', '.'))
  const normalizedAmount = /k/i.test(match[0]) ? amount * 1000 : amount

  return formatCurrency(String(normalizedAmount))
}

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

const getRecompensaForm = (value) => {
  if (value === '10% Salario') {
    return { recompensaTipo: 'percentual', recompensaValor: 'R$ 2.500' }
  }

  if (value === 'Consultar') {
    return { recompensaTipo: 'personalizado', recompensaValor: 'R$ 2.500' }
  }

  return { recompensaTipo: 'fixo', recompensaValor: value || 'R$ 2.500' }
}

const getTipoForm = (value) => {
  const temporaryMatch = String(value || '').match(/^Contrato temporario \((\d{2})\/(\d{2})\/(\d{4}) [–-] (\d{2})\/(\d{2})\/(\d{4})\)$/)

  if (!temporaryMatch) {
    return { tipo: value || 'Tempo Integral', tipoDataInicio: '', tipoDataFim: '' }
  }

  const [, startDay, startMonth, startYear, endDay, endMonth, endYear] = temporaryMatch
  return {
    tipo: 'Contrato temporario',
    tipoDataInicio: `${startYear}-${startMonth}-${startDay}`,
    tipoDataFim: `${endYear}-${endMonth}-${endDay}`,
  }
}

function EditarVagaEmpresa() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [empresa] = useState(() => {
    const storedEmpresa = localStorage.getItem('empresaUser')
    return storedEmpresa ? JSON.parse(storedEmpresa) : null
  })
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [loadingVaga, setLoadingVaga] = useState(true)
  const [message, setMessage] = useState('')
  const [canEdit, setCanEdit] = useState(false)

  useEffect(() => {
    if (!empresa) {
      navigate(`/login?redirect=/editar-vaga/empresa/${id}`)
    }
  }, [empresa, id, navigate])

  useEffect(() => {
    if (!empresa) return

    const fetchVaga = async () => {
      try {
        const response = await fetch(`http://localhost:3333/vagas/${id}`)
        const data = await response.json()

        if (!response.ok) {
          setMessage(data.erro || 'Vaga nao encontrada.')
          return
        }

        if (Number(data.empresaId) !== Number(empresa.id)) {
          setMessage('Esta vaga nao pertence a sua empresa.')
          setCanEdit(false)
          return
        }

        const [salarioMin, salarioMax] = getSalaryParts(data.salario)
        const recompensa = getRecompensaForm(data.recompensa)
        const tipo = getTipoForm(data.tipo)

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
        setMessage('Nao foi possivel carregar a vaga.')
        setCanEdit(false)
      } finally {
        setLoadingVaga(false)
      }
    }

    fetchVaga()
  }, [empresa, id])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleCurrencyChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: formatCurrency(value) }))
  }

  const getRecompensa = () => {
    if (form.recompensaTipo === 'percentual') return '10% Salario'
    if (form.recompensaTipo === 'personalizado') return 'Consultar'
    return form.recompensaValor
  }

  const formatDate = (value) => {
    if (!value) return ''
    const [year, month, day] = value.split('-')
    return `${day}/${month}/${year}`
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setMessage('')

    if (!empresa) return

    if (!form.titulo || !form.area || !form.descricaoLonga || !form.localizacao) {
      setMessage('Preencha titulo, area, descricao e localizacao.')
      return
    }

    const salarioMin = getNumberFromCurrency(form.salarioMin)
    const salarioMax = getNumberFromCurrency(form.salarioMax)
    if (salarioMin && salarioMax && salarioMin > salarioMax) {
      setMessage('O salario minimo nao pode ser maior que o maximo.')
      return
    }

    if (form.tipo === 'Contrato temporario' && (!form.tipoDataInicio || !form.tipoDataFim)) {
      setMessage('Informe a data de inicio e a data de fim do contrato temporario.')
      return
    }

    const salario = form.salarioMin || form.salarioMax
      ? `${form.salarioMin || 'A combinar'} - ${form.salarioMax || 'A combinar'}`
      : 'A combinar'

    const payload = {
      titulo: form.titulo,
      empresaId: empresa.id,
      localizacao: form.localizacao,
      salario,
      tipo: form.tipo === 'Contrato temporario'
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
      const response = await fetch(`http://localhost:3333/vagas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()

      if (!response.ok) {
        setMessage(data.erro || 'Erro ao atualizar vaga.')
        return
      }

      setMessage('Vaga atualizada com sucesso.')
      navigate(`/vaga/${id}`)
    } catch {
      setMessage('Nao foi possivel conectar ao servidor.')
    } finally {
      setLoading(false)
    }
  }

  if (!empresa) return null

  return (
    <div className="empresa-vaga-page">
      <Navbar />

      <div className="empresa-vaga-layout">
        <Sidebar type="empresa" user={empresa} />

        <main className="empresa-vaga-content editar-vaga-content">
          <section className="empresa-vaga-intro">
            <span>EDICAO DE VAGA</span>
            <h1>
              Ajustar
              <br />
              uma <strong>Vaga.</strong>
            </h1>
            <p>Atualize informacoes da oportunidade, recompensa, requisitos e detalhes de contratacao.</p>
            <Link className="editar-vaga-back" to="/vagas">Voltar para vagas</Link>
          </section>

          {loadingVaga ? (
            <section className="vaga-step">
              <p>Carregando vaga...</p>
            </section>
          ) : !canEdit ? (
            <section className="vaga-step">
              <p>{message || 'Nao foi possivel editar esta vaga.'}</p>
              <Link className="editar-vaga-back" to="/vagas">Voltar para vagas</Link>
            </section>
          ) : (
            <form className="empresa-vaga-form" onSubmit={handleSubmit}>
              <section className="vaga-step">
                <div className="step-header">
                  <h2>Fundamentos da Vaga</h2>
                  <span>PASSO 1 DE 4</span>
                </div>

                <label>Titulo do cargo / funcao</label>
                <input name="titulo" value={form.titulo} onChange={handleChange} />

                <div className="form-grid three">
                  <div>
                    <label>Industria / Area</label>
                    <input name="area" value={form.area} onChange={handleChange} />
                  </div>
                  <div>
                    <label>Faixa salarial</label>
                    <input name="salarioMin" placeholder="Min" value={form.salarioMin} onChange={handleCurrencyChange} />
                  </div>
                  <div>
                    <label>&nbsp;</label>
                    <input name="salarioMax" placeholder="Max" value={form.salarioMax} onChange={handleCurrencyChange} />
                  </div>
                </div>

                <div className="form-grid two">
                  <div>
                    <label>Experiencia requerida</label>
                    <div className="option-grid">
                      {['Junior', 'Pleno', 'Senior', 'Personalizado'].map((option) => (
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
                    <label>Tipo de contratacao</label>
                    <div className="option-grid">
                      {['Tempo Integral', 'Freelance', 'Meio Periodo', 'Remoto', 'Contrato temporario'].map((option) => (
                        <button key={option} type="button" className={form.tipo === option ? 'selected outline' : ''} onClick={() => setForm((current) => ({ ...current, tipo: option }))}>
                          {option}
                        </button>
                      ))}
                    </div>
                    {form.tipo === 'Contrato temporario' && (
                      <div className="temporary-contract-grid">
                        <div>
                          <label>Data de inicio</label>
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
                  <h2>Descricao da vaga</h2>
                  <span>PASSO 2 DE 4</span>
                </div>

                <label>Resumo da vaga</label>
                <input name="descricaoCurta" value={form.descricaoCurta} onChange={handleChange} />

                <label>Descricao da vaga</label>
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
                    <label>Beneficios</label>
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
                    <h2>Premiacao por Indicacao</h2>
                    <p>Ajuste o incentivo exibido para indicadores.</p>
                  </div>
                  <span>PASSO 3 DE 4</span>
                </div>

                <div className="reward-grid">
                  {[
                    ['fixo', 'Valor fixo', form.recompensaValor],
                    ['percentual', 'Percentual', '10% Salario'],
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
                  <h2>Logistica e Prazos</h2>
                  <span>PASSO 4 DE 4</span>
                </div>

                <div className="form-grid two">
                  <div>
                    <label>Localizacao</label>
                    <input name="localizacao" value={form.localizacao} onChange={handleChange} />
                  </div>
                  <div>
                    <label>Data limite</label>
                    <input name="dataLimite" type="date" value={form.dataLimite} onChange={handleChange} />
                  </div>
                </div>
              </section>

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
