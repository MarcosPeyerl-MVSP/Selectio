// Objetivo do arquivo: renderizar e controlar a página de criação de vaga da empresa.
// O componente valida a sessão da empresa, coleta dados da vaga, aplica formatação
// em valores monetários, valida regras do formulário e envia a nova vaga para o Firestore.

import './styles/EmpresaCriarVaga.css'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import Sidebar from '../../components/layout/Sidebar'
import Footer from '../../components/layout/Footer'
import { criarVaga } from '../../services/firestoreVagas'
import { getFirebaseUid } from '../../services/firebaseIdentity'
import { useToast } from '../../hooks/useToast'

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

function CriarVagaEmpresa() {
  // Hook usado para redirecionar a empresa após criação da vaga ou ausência de sessão.
  const navigate = useNavigate()
  const toast = useToast()

  // Recupera a empresa autenticada salva no localStorage.
  const [empresa] = useState(() => {
    const storedEmpresa = localStorage.getItem('empresaUser')
    return storedEmpresa ? JSON.parse(storedEmpresa) : null
  })

  // Controla os campos do formulário de vaga.
  const [form, setForm] = useState(initialForm)

  // Controla o estado de envio da vaga.
  const [loading, setLoading] = useState(false)

  // Armazena mensagens de erro ou sucesso do formulário.
  const [message, setMessage] = useState('')

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

  // Responsabilidade: formatar valores numéricos como moeda brasileira.
  const formatCurrency = (value) => {
    const numbers = value.replace(/\D/g, '')
    const amount = Number(numbers || 0)

    return amount.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    })
  }

  // Responsabilidade: atualizar campos monetários já formatados.
  const handleCurrencyChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: formatCurrency(value) }))
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
  const handleSubmit = async (event) => {
    event.preventDefault()
    setMessage('')

    if (!empresa) return

    // Validação: campos principais obrigatórios da vaga.
    if (!form.titulo || !form.area || !form.descricaoLonga || !form.localizacao) {
      setMessage('Preencha título, área, descrição e localização.')
      toast.warning('Preencha título, área, descrição e localização.')
      return
    }

    // Validação: salário mínimo não pode ser maior que o salário máximo.
    const salarioMin = getNumberFromCurrency(form.salarioMin)
    const salarioMax = getNumberFromCurrency(form.salarioMax)
    if (salarioMin && salarioMax && salarioMin > salarioMax) {
      setMessage('O salário mínimo não pode ser maior que o máximo.')
      toast.warning('O salário mínimo não pode ser maior que o máximo.')
      return
    }

    // Validação: contrato temporário exige datas de início e fim.
    if (form.tipo === 'Contrato temporário' && (!form.tipoDataInicio || !form.tipoDataFim)) {
      setMessage('Informe a data de início e a data de fim do contrato temporário.')
      toast.warning('Informe a data de início e a data de fim do contrato temporário.')
      return
    }

    // Validação: data de início não pode ser posterior à data de fim.
    if (
      form.tipo === 'Contrato temporário'
      && form.tipoDataInicio
      && form.tipoDataFim
      && form.tipoDataInicio > form.tipoDataFim
    ) {
      setMessage('A data de início não pode ser posterior à data de fim.')
      toast.warning('A data de início não pode ser posterior à data de fim.')
      return
    }

    // Monta o texto de salário exibido na vaga.
    const salario = form.salarioMin || form.salarioMax
      ? `${form.salarioMin || 'A combinar'} – ${form.salarioMax || 'A combinar'}`
      : 'A combinar'

    const empresaUid = getFirebaseUid(empresa)

    // Payload enviado ao Firestore com os dados da vaga.
    const payload = {
      titulo: form.titulo,
      empresa: empresa.nomeEmpresa || empresa.nome || 'Empresa Selectio',
      empresaNome: empresa.nomeEmpresa || empresa.nome || 'Empresa Selectio',
      empresaId: empresaUid,
      empresaUid,
      localizacao: form.localizacao,
      salario,
      tipo: form.tipo === 'Contrato temporário'
        ? `${form.tipo} (${formatDate(form.tipoDataInicio)} – ${formatDate(form.tipoDataFim)})`
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

      // Integração: envia a nova vaga para cadastro no Firestore.
      await criarVaga(payload)

      setMessage('Vaga criada com sucesso.')
      toast.success('Vaga criada com sucesso.')
      setForm(initialForm)
      navigate('/vagas')
    } catch {
      setMessage('Não foi possível salvar a vaga no Firestore.')
      toast.error('Não foi possível salvar a vaga no Firestore.')
    } finally {
      setLoading(false)
    }
  }

  // Evita renderizar o formulário enquanto não há empresa autenticada.
  if (!empresa) {
    return null
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
            <span>FASE DE RASCUNHO</span>
            <h1>
              Postar uma
              <br />
              nova <strong>Vaga.</strong>
            </h1>
            <p>Crie anúncios de alto impacto que atraem os melhores talentos do mundo.</p>
          </section>

          <form className="empresa-vaga-form" onSubmit={handleSubmit}>
            <section className="vaga-step">
              <div className="step-header">
                <h2>Fundamentos da Vaga</h2>
                <span>PASSO 1 DE 4</span>
              </div>

              <label>Título do cargo / função</label>
              <input
                name="titulo"
                placeholder="ex. Diretor de Criação Sênior"
                value={form.titulo}
                onChange={handleChange}
              />

              <div className="form-grid three">
                <div>
                  <label>Indústria / Área</label>
                  <input name="area" placeholder="Design & Criativo" value={form.area} onChange={handleChange} />
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
                      placeholder="Descreva a experiência requerida"
                      value={form.experienciaPersonalizada}
                      onChange={handleChange}
                    />
                  )}
                </div>

                <div>
                  <label>Tipo de contratação</label>
                  <div className="option-grid">
                    {['Tempo Integral', 'Freelance', 'Meio Período', 'Remoto', 'Contrato temporário'].map((option) => (
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
                  {form.tipo === 'Contrato temporário' && (
                    <div className="temporary-contract-grid">
                      <div>
                        <label>Data de início</label>
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
                        <label>Data de fim</label>
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
                <h2>Descrição da vaga</h2>
                <span>PASSO 2 DE 4</span>
              </div>

              <label>Resumo da vaga</label>
              <input
                name="descricaoCurta"
                placeholder="Resumo curto para os cards"
                value={form.descricaoCurta}
                onChange={handleChange}
              />

              <label>Descrição da vaga</label>
              <textarea
                name="descricaoLonga"
                placeholder="Descreva as necessidades da vaga, qual o profissional necessário..."
                value={form.descricaoLonga}
                onChange={handleChange}
              />

              <div className="form-grid two">
                <div>
                  <label>Requisitos</label>
                  <textarea
                    className="small"
                    name="requisitos"
                    placeholder="Separe os requisitos por vírgula"
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
                    placeholder="Separe as habilidades por vírgula"
                    value={form.habilidades}
                    onChange={handleChange}
                  />
                  <TokenPreview items={parseList(form.habilidades)} />
                </div>
              </div>

              <div className="form-grid two">
                <div>
                  <label>Benefícios</label>
                  <textarea
                    className="small"
                    name="beneficios"
                    placeholder="Separe os benefícios por vírgula"
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
                  <h2>Premiação por Indicação</h2>
                  <p>Incentive sua rede a indicar talentos de alta performance.</p>
                </div>
                <span>PASSO 3 DE 4</span>
              </div>

              <div className="reward-grid">
                {[
                  ['fixo', 'Valor fixo', form.recompensaValor],
                  ['percentual', 'Percentual', '10% Salário'],
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
                  placeholder="Valor da premiação"
                />
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
                  <input
                    name="localizacao"
                    placeholder="ex. São Paulo, London, ou Global"
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

            {/* Exibe mensagens de validação, erro ou sucesso do formulário. */}
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
