import './Vaga.css'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../../../components/Navbar/NavbarEmpresa/Navbar'
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
  tipoDataPersonalizada: '',
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

function CriarVagaEmpresa() {
  const navigate = useNavigate()
  const [empresa] = useState(() => {
    const storedEmpresa = localStorage.getItem('empresaUser')
    return storedEmpresa ? JSON.parse(storedEmpresa) : null
  })
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!empresa) {
      navigate('/login')
    }
  }, [empresa, navigate])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const parseList = (value) => value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  const getRecompensa = () => {
    if (form.recompensaTipo === 'percentual') return '10% Salario'
    if (form.recompensaTipo === 'personalizado') return 'Consultar'
    return form.recompensaValor
  }

  const formatCurrency = (value) => {
    const numbers = value.replace(/\D/g, '')
    const cents = Number(numbers || 0) / 100

    return cents.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  const handleCurrencyChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: formatCurrency(value) }))
  }

  const getNumberFromCurrency = (value) => Number(value.replace(/\D/g, '')) / 100

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

    const salario = form.salarioMin || form.salarioMax
      ? `${form.salarioMin || 'A combinar'} - ${form.salarioMax || 'A combinar'}`
      : 'A combinar'

    const payload = {
      titulo: form.titulo,
      empresaId: empresa.id,
      localizacao: form.localizacao,
      salario,
      tipo: form.tipo === 'Contrato temporario'
        ? `${form.tipo}${form.tipoDataPersonalizada ? ` ate ${form.tipoDataPersonalizada}` : ''}`
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
      imagem: 'https://images.unsplash.com/photo-1497366216548-37526070297c',
      area: form.area,
    }

    try {
      setLoading(true)
      const response = await fetch('http://localhost:3333/vagas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        setMessage(data.erro || 'Erro ao criar vaga.')
        return
      }

      setMessage('Vaga criada com sucesso.')
      setForm(initialForm)
      navigate('/vagas')
    } catch {
      setMessage('Nao foi possivel conectar ao servidor.')
    } finally {
      setLoading(false)
    }
  }

  if (!empresa) {
    return null
  }

  return (
    <div className="empresa-vaga-page">
      <Navbar />

      <div className="empresa-vaga-layout">
        <Sidebar type="empresa" user={empresa} />

        <main className="empresa-vaga-content">
          <section className="empresa-vaga-intro">
            <span>FASE DE RASCUNHO</span>
            <h1>
              Postar uma
              <br />
              nova <strong>Vaga.</strong>
            </h1>
            <p>Crie anuncios de alto impacto que atraem os melhores talentos do mundo.</p>
          </section>

          <form className="empresa-vaga-form" onSubmit={handleSubmit}>
            <section className="vaga-step">
              <div className="step-header">
                <h2>Fundamentos da Vaga</h2>
                <span>PASSO 1 DE 4</span>
              </div>

              <label>Titulo do cargo / funcao</label>
              <input
                name="titulo"
                placeholder="ex. Diretor de Criacao Senior"
                value={form.titulo}
                onChange={handleChange}
              />

              <div className="form-grid three">
                <div>
                  <label>Industria / Area</label>
                  <input name="area" placeholder="Design & Criativo" value={form.area} onChange={handleChange} />
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
                      <button
                        key={option}
                        type="button"
                        className={form.experiencia === option ? 'selected' : ''}
                        onClick={() => setForm((current) => ({ ...current, experiencia: option }))}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  {form.experiencia === 'Personalizado' && (
                    <textarea
                      className="small inline-textarea"
                      name="experienciaPersonalizada"
                      placeholder="Descreva a experiencia requerida"
                      value={form.experienciaPersonalizada}
                      onChange={handleChange}
                    />
                  )}
                </div>

                <div>
                  <label>Tipo de contratacao</label>
                  <div className="option-grid">
                    {['Tempo Integral', 'Freelance', 'Meio Periodo', 'Remoto', 'Contrato temporario'].map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={form.tipo === option ? 'selected outline' : ''}
                        onClick={() => setForm((current) => ({ ...current, tipo: option }))}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  {form.tipo === 'Contrato temporario' && (
                    <input
                      className="inline-input"
                      name="tipoDataPersonalizada"
                      type="date"
                      value={form.tipoDataPersonalizada}
                      onChange={handleChange}
                    />
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
              <input
                name="descricaoCurta"
                placeholder="Resumo curto para os cards"
                value={form.descricaoCurta}
                onChange={handleChange}
              />

              <label>Descricao da vaga</label>
              <textarea
                name="descricaoLonga"
                placeholder="Descreva as necessidades da vaga, qual o profissional necessario..."
                value={form.descricaoLonga}
                onChange={handleChange}
              />

              <div className="form-grid two">
                <div>
                  <label>Requisitos</label>
                  <textarea
                    className="small"
                    name="requisitos"
                    placeholder="Separe os requisitos por virgula"
                    value={form.requisitos}
                    onChange={handleChange}
                  />
                  <TokenPreview items={parseList(form.requisitos)} />
                </div>
                <div>
                  <label>Habilidades</label>
                  <textarea
                    className="small"
                    name="habilidades"
                    placeholder="Separe as habilidades por virgula"
                    value={form.habilidades}
                    onChange={handleChange}
                  />
                  <TokenPreview items={parseList(form.habilidades)} />
                </div>
              </div>

              <div className="form-grid two">
                <div>
                  <label>Beneficios</label>
                  <textarea
                    className="small"
                    name="beneficios"
                    placeholder="Separe os beneficios por virgula"
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
                  <h2>Premiacao por Indicacao</h2>
                  <p>Incentive sua rede a indicar talentos de alta performance.</p>
                </div>
                <span>PASSO 3 DE 4</span>
              </div>

              <div className="reward-grid">
                {[
                  ['fixo', 'Valor fixo', form.recompensaValor],
                  ['percentual', 'Percentual', '10% Salario'],
                  ['personalizado', 'Personalizado', 'Consultar'],
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
                  placeholder="Valor da premiacao"
                />
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
                  <input
                    name="localizacao"
                    placeholder="ex. Sao Paulo, London, ou Global"
                    value={form.localizacao}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label>Data limite</label>
                  <input
                    name="dataLimite"
                    type="date"
                    value={form.dataLimite}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </section>

            {message && <p className="empresa-vaga-message">{message}</p>}

            <div className="form-actions">
              <button type="button" className="draft-btn">Salvar como Rascunho</button>
              <button type="submit" className="finish-btn" disabled={loading}>
                {loading ? 'Salvando...' : 'Finalizar Vaga'}
              </button>
            </div>
          </form>
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

export default CriarVagaEmpresa
