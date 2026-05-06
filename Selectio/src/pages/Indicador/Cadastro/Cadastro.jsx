import './Cadastro.css'
import { useState } from 'react'
import { FaCheck, FaEye, FaEyeSlash, FaTimes } from 'react-icons/fa'
import Navbar from '../../../components/Navbar/Navbar/Navbar'
import Footer from '../../../components/Footer/Footer'

const passwordCriteria = [
  { key: 'length', label: '12+ caracteres' },
  { key: 'uppercase', label: 'Maiúscula' },
  { key: 'lowercase', label: 'Minúscula' },
  { key: 'numbers', label: 'Número' },
  { key: 'special', label: 'Símbolo' },
  { key: 'noSequence', label: 'Sem repetição' }
]

const strengthCopy = {
  fraca: {
    label: 'fraca',
    hint: 'Comece combinando tamanho, letras e números.'
  },
  media: {
    label: 'média',
    hint: 'Boa direção. Adicione mais variedade para proteger melhor.'
  },
  forte: {
    label: 'forte',
    hint: 'Excelente. Sua senha está pronta para criar a conta.'
  }
}

function CadastroIndicador() {
  const [form, setForm] = useState({
    nome: '',
    email: '',
    cpf: '',
    pix: '',
    dataNascimento: '',
    senha: '',
    confirmarSenha: '',
    cpfError: ''
  })
  const [passwordStrength, setPasswordStrength] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  function formatCPF(value) {
    value = value.replace(/\D/g, '')
    value = value.replace(/^(\d{3})(\d)/, '$1.$2')
    value = value.replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    value = value.replace(/\.(\d{3})(\d)/, '.$1-$2')
    return value.slice(0, 14)
  }

  function validarCPF(cpf) {
    cpf = cpf.replace(/[^\d]/g, '')
    if (cpf.length !== 11) return false
    if (/^(\d)\1{10}$/.test(cpf)) return false

    let soma = 0
    for (let i = 0; i < 9; i++) {
      soma += parseInt(cpf[i]) * (10 - i)
    }

    const digito1 = soma % 11 < 2 ? 0 : 11 - (soma % 11)
    soma = 0

    for (let i = 0; i < 10; i++) {
      soma += parseInt(cpf[i]) * (11 - i)
    }

    const digito2 = soma % 11 < 2 ? 0 : 11 - (soma % 11)
    return Number(cpf[9]) === digito1 && Number(cpf[10]) === digito2
  }

  function validatePasswordStrength(password) {
    const criteria = {
      length: password.length >= 12,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      numbers: /[0-9]/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
      noSequence: !/(.)\1{2,}/.test(password)
    }

    const score = Object.values(criteria).filter(Boolean).length

    return {
      criteria,
      score,
      strength: score <= 2 ? 'fraca' : score <= 4 ? 'media' : 'forte'
    }
  }

  const confirmPasswordStatus = form.confirmarSenha
    ? form.senha === form.confirmarSenha
      ? 'match'
      : 'mismatch'
    : ''

  const currentStrength = passwordStrength
    ? strengthCopy[passwordStrength.strength]
    : null

  const isPasswordStrong = passwordStrength?.strength === 'forte'
  const canSubmit = !form.senha || isPasswordStrong

  function handleChange(e) {
    const { name, value } = e.target
    let formattedValue = value

    if (name === 'cpf') {
      formattedValue = formatCPF(value)
      setForm({ ...form, [name]: formattedValue, cpfError: '' })
      return
    }

    if (name === 'senha') {
      setPasswordStrength(validatePasswordStrength(value))
    }

    setForm({ ...form, [name]: formattedValue })
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (form.senha !== form.confirmarSenha) {
      alert('As senhas não conferem')
      return
    }

    if (form.cpf && !validarCPF(form.cpf)) {
      setForm({ ...form, cpfError: 'CPF inválido' })
      return
    }

    const payload = { ...form }
    delete payload.confirmarSenha
    delete payload.cpfError

    const response = await fetch('http://localhost:3333/indicador/cadastro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    const data = await response.json()

    if (data.sucesso) {
      alert('Cadastro realizado com sucesso!')
    } else {
      alert(data.erro || 'Erro ao cadastrar')
    }
  }

  return (
    <>
      <Navbar />

      <main className="indicador-cadastro-container">
        <div className="indicador-cadastro-card">
          <span className="tag center">CADASTRO DE INDICADOR</span>
          <h1>Junte-se à Selectio</h1>
          <p className="subtitle">
            Transforme sua rede profissional em oportunidades reais e seja
            recompensado por indicações bem-sucedidas.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <input
                name="nome"
                placeholder="Nome completo"
                onChange={handleChange}
                required
              />

              <input
                name="email"
                type="email"
                placeholder="E-mail"
                onChange={handleChange}
                required
              />

              <input
                name="cpf"
                placeholder="CPF"
                value={form.cpf}
                onChange={handleChange}
                required
              />
              {form.cpfError && <span className="error">{form.cpfError}</span>}

              <input
                name="pix"
                placeholder="Chave Pix"
                onChange={handleChange}
              />

              <input
                name="dataNascimento"
                type="date"
                onChange={handleChange}
              />

              <div className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="senha"
                  placeholder="Senha"
                  value={form.senha}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>

              {passwordStrength && (
                <div className={`password-strength strength-${passwordStrength.strength}`}>
                  <div className="strength-header">
                    <div>
                      <strong>Senha {currentStrength.label}</strong>
                      <p>{currentStrength.hint}</p>
                    </div>
                    <span className="strength-score">
                      {passwordStrength.score}/6
                    </span>
                  </div>

                  <div className="strength-meter" aria-hidden="true">
                    {passwordCriteria.map((item, index) => (
                      <span
                        key={item.key}
                        className={index < passwordStrength.score ? 'active' : ''}
                      />
                    ))}
                  </div>

                  <ul className="criteria-list">
                    {passwordCriteria.map((item) => {
                      const isMet = passwordStrength.criteria[item.key]

                      return (
                        <li key={item.key} className={isMet ? 'met' : ''}>
                          {isMet ? <FaCheck /> : <FaTimes />}
                          {item.label}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              <div className={`confirm-password-field ${confirmPasswordStatus}`}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmarSenha"
                  placeholder="Confirmar senha"
                  value={form.confirmarSenha}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword((visible) => !visible)}
                  aria-label={showConfirmPassword ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'}
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
                {confirmPasswordStatus && (
                  <span className="confirm-password-message">
                    {confirmPasswordStatus === 'match'
                      ? 'Senhas conferem'
                      : 'As senhas ainda não conferem'}
                  </span>
                )}
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={!canSubmit}>
              {isPasswordStrong ? 'Criar conta →' : 'Complete a senha forte'}
            </button>
          </form>
        </div>
      </main>

      <Footer />
    </>
  )
}

export default CadastroIndicador
