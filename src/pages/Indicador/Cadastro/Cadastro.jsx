// Objetivo do arquivo: renderizar e controlar o formulário de cadastro de indicador.
// O componente valida CPF, avalia força da senha, confirma senha, envia os dados
// no Firebase/Firestore e salva a sessão do indicador após cadastro bem-sucedido.

import './Cadastro.css'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaCheck, FaEye, FaEyeSlash, FaGoogle, FaTimes } from 'react-icons/fa'
import {
  createUserWithEmailAndPassword,
  deleteUser,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth'
import Navbar from '../../../components/Navbar/Navbar/Navbar'
import Footer from '../../../components/Footer/Footer'
import { auth } from '../../../services/firebase'
import { getFirebaseAuthErrorMessage, isFirebaseAuthError } from '../../../services/authErrors'
import { buscarPerfilUsuario, salvarPerfilUsuario } from '../../../services/firestoreUsers'

// Critérios exibidos e validados para classificar a força da senha.
const passwordCriteria = [
  { key: 'length', label: '12+ caracteres' },
  { key: 'uppercase', label: 'Maiúscula' },
  { key: 'lowercase', label: 'Minúscula' },
  { key: 'numbers', label: 'Número' },
  { key: 'special', label: 'Símbolo' },
  { key: 'noSequence', label: 'Sem repetição' }
]

// Textos auxiliares exibidos conforme a classificação da senha.
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

const rollbackFirebaseUser = async (firebaseUser) => {
  if (!firebaseUser) return

  try {
    await deleteUser(firebaseUser)
  } catch {
    // O cadastro local nao deve travar se o rollback no Firebase falhar.
  }
}

function CadastroIndicador() {
  // Hook usado para redirecionar o usuário após cadastro bem-sucedido.
  const navigate = useNavigate()

  // Estado central do formulário de cadastro do indicador.
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

  // Guarda o resultado da análise de força da senha.
  const [passwordStrength, setPasswordStrength] = useState(null)

  // Controla a visibilidade do campo de senha.
  const [showPassword, setShowPassword] = useState(false)

  // Controla a visibilidade do campo de confirmação de senha.
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [submitLoading, setSubmitLoading] = useState(false)

  const [googleSignupUser, setGoogleSignupUser] = useState(null)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleMessage, setGoogleMessage] = useState('')
  const pendingGoogleUidRef = useRef('')
  const keepGoogleSessionRef = useRef(false)

  // Responsabilidade: aplicar máscara de CPF no formato 000.000.000-00.
  function formatCPF(value) {
    value = value.replace(/\D/g, '')
    value = value.replace(/^(\d{3})(\d)/, '$1.$2')
    value = value.replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    value = value.replace(/\.(\d{3})(\d)/, '.$1-$2')
    return value.slice(0, 14)
  }

  // Responsabilidade: validar CPF usando tamanho, repetição e dígitos verificadores.
  function validarCPF(cpf) {
    cpf = cpf.replace(/[^\d]/g, '')

    // Regra: CPF precisa ter 11 dígitos numéricos.
    if (cpf.length !== 11) return false

    // Regra: CPFs com todos os dígitos iguais são inválidos.
    if (/^(\d)\1{10}$/.test(cpf)) return false

    let soma = 0
    for (let i = 0; i < 9; i++) {
      soma += parseInt(cpf[i]) * (10 - i)
    }

    // Calcula o primeiro dígito verificador.
    const digito1 = soma % 11 < 2 ? 0 : 11 - (soma % 11)
    soma = 0

    for (let i = 0; i < 10; i++) {
      soma += parseInt(cpf[i]) * (11 - i)
    }

    // Calcula o segundo dígito verificador e compara com o CPF informado.
    const digito2 = soma % 11 < 2 ? 0 : 11 - (soma % 11)
    return Number(cpf[9]) === digito1 && Number(cpf[10]) === digito2
  }

  // Responsabilidade: verificar os critérios de segurança da senha.
  function validatePasswordStrength(password) {
    const criteria = {
      length: password.length >= 12,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      numbers: /[0-9]/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
      noSequence: !/(.)\1{2,}/.test(password)
    }

    // Pontuação baseada na quantidade de critérios atendidos.
    const score = Object.values(criteria).filter(Boolean).length

    return {
      criteria,
      score,
      strength: score <= 2 ? 'fraca' : score <= 4 ? 'media' : 'forte'
    }
  }

  // Define o estado visual da confirmação de senha.
  const confirmPasswordStatus = form.confirmarSenha
    ? form.senha === form.confirmarSenha
      ? 'match'
      : 'mismatch'
    : ''

  // Recupera os textos correspondentes à força atual da senha.
  const currentStrength = passwordStrength
    ? strengthCopy[passwordStrength.strength]
    : null

  // Regra de envio: o botão só fica apto quando a senha informada for forte.
  const isPasswordStrong = passwordStrength?.strength === 'forte'
  const isGoogleSignup = Boolean(googleSignupUser)
  const canSubmit = (isGoogleSignup || isPasswordStrong) && !submitLoading

  useEffect(() => {
    return () => {
      const pendingUid = pendingGoogleUidRef.current

      if (
        pendingUid &&
        !keepGoogleSessionRef.current &&
        auth.currentUser?.uid === pendingUid
      ) {
        signOut(auth).catch(() => {})
      }
    }
  }, [])

  const redirectExistingProfile = (perfil) => {
    keepGoogleSessionRef.current = true

    if (perfil.tipo === 'indicador') {
      localStorage.setItem('indicadorUser', JSON.stringify(perfil))
      localStorage.removeItem('empresaUser')
      alert('Esta conta Google ja esta cadastrada. Vamos te levar ao painel do indicador.')
      navigate('/painel/indicador')
      return
    }

    if (perfil.tipo === 'empresa') {
      localStorage.setItem('empresaUser', JSON.stringify(perfil))
      localStorage.removeItem('indicadorUser')
      alert('Esta conta Google ja esta cadastrada como empresa. Vamos te levar ao painel correto.')
      navigate('/painel/empresa')
      return
    }

    alert('Esta conta Google ja possui um cadastro no Selectio. Entre pelo login.')
    navigate('/login')
  }

  // Responsabilidade: atualizar campos do formulário e executar formatações/validações em tempo real.
  function handleChange(e) {
    const { name, value } = e.target
    let formattedValue = value

    // Aplica máscara no CPF e limpa erro anterior ao editar o campo.
    if (name === 'cpf') {
      formattedValue = formatCPF(value)
      setForm({ ...form, [name]: formattedValue, cpfError: '' })
      return
    }

    // Atualiza a análise de força sempre que o campo de senha muda.
    if (name === 'senha') {
      setPasswordStrength(validatePasswordStrength(value))
    }

    setForm({ ...form, [name]: formattedValue })
  }

  // Responsabilidade: validar dados e salvar o cadastro no Firebase/Firestore.
  async function handleGoogleSignup() {
    setGoogleLoading(true)
    setGoogleMessage('')

    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })

      const credential = await signInWithPopup(auth, provider)
      const googleUser = credential.user
      pendingGoogleUidRef.current = googleUser.uid

      const existingProfile = await buscarPerfilUsuario(googleUser.uid)

      if (existingProfile) {
        redirectExistingProfile(existingProfile)
        return
      }

      setGoogleSignupUser({
        uid: googleUser.uid,
        email: googleUser.email || '',
        nome: googleUser.displayName || ''
      })
      setPasswordStrength(null)
      setForm((currentForm) => ({
        ...currentForm,
        nome: currentForm.nome || googleUser.displayName || '',
        email: googleUser.email || currentForm.email,
        senha: '',
        confirmarSenha: ''
      }))
      setGoogleMessage('Google vinculado temporariamente. Complete os dados e finalize o cadastro.')
    } catch (error) {
      if (pendingGoogleUidRef.current && auth.currentUser?.uid === pendingGoogleUidRef.current) {
        await signOut(auth).catch(() => {})
      }

      if (isFirebaseAuthError(error)) {
        setGoogleMessage(getFirebaseAuthErrorMessage(error))
      } else {
        setGoogleMessage('Nao foi possivel continuar com Google. Tente novamente.')
      }
    } finally {
      setGoogleLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()

    // Validação: senha e confirmação precisam ser iguais.
    if (!isGoogleSignup) {
      if (form.senha !== form.confirmarSenha) {
        alert('As senhas não conferem')
        return
      }

      if (!isPasswordStrong) {
        alert('Crie uma senha forte antes de cadastrar.')
        return
      }
    }

    // Validação: CPF informado precisa ser válido.
    if (form.cpf && !validarCPF(form.cpf)) {
      setForm({ ...form, cpfError: 'CPF inválido' })
      return
    }

    // Remove campos usados apenas na interface antes de salvar no Firestore.
    const payload = { ...form }
    delete payload.confirmarSenha
    delete payload.cpfError
    payload.email = payload.email.trim()

    let firebaseUser = null

    try {
      setSubmitLoading(true)

      let profileUid = googleSignupUser?.uid

      if (isGoogleSignup) {
        if (!profileUid || auth.currentUser?.uid !== profileUid) {
          alert('Entre com Google novamente para concluir este cadastro.')
          return
        }

        const existingProfile = await buscarPerfilUsuario(profileUid)

        if (existingProfile) {
          redirectExistingProfile(existingProfile)
          return
        }
      } else {
        const firebaseCredential = await createUserWithEmailAndPassword(
          auth,
          payload.email,
          form.senha
        )
        firebaseUser = firebaseCredential.user
        profileUid = firebaseUser.uid
      }

      payload.firebaseUid = profileUid

      const perfilIndicador = await salvarPerfilUsuario({
        uid: profileUid,
        tipo: 'indicador',
        dados: {
          id: profileUid,
          nome: payload.nome,
          email: payload.email,
          cpf: payload.cpf,
          pix: payload.pix,
          dataNascimento: payload.dataNascimento
        }
      })

      keepGoogleSessionRef.current = true
      localStorage.setItem('indicadorUser', JSON.stringify(perfilIndicador))
      localStorage.removeItem('empresaUser')
      navigate('/painel/indicador')
    } catch (error) {
      await rollbackFirebaseUser(firebaseUser)

      if (isFirebaseAuthError(error)) {
        alert(getFirebaseAuthErrorMessage(error))
      } else {
        alert('Nao foi possivel salvar o perfil do indicador no Firestore. Tente novamente.')
      }
    } finally {
      setSubmitLoading(false)
    }
  }

  return (
    <>
      {/* Componente de navegação principal da aplicação. */}
      <Navbar />

      <main className="indicador-cadastro-container">
        <div className="indicador-cadastro-card">
          <span className="tag center">CADASTRO DE INDICADOR</span>
          <h1>Junte-se à Selectio</h1>
          <p className="subtitle">
            Transforme sua rede profissional em oportunidades reais e seja
            recompensado por indicações bem-sucedidas.
          </p>

          {/* Formulário de cadastro do indicador. */}
          <form onSubmit={handleSubmit}>
            {isGoogleSignup && (
              <div className="google-linked-card">
                <FaGoogle />
                <div>
                  <strong>Google vinculado ao cadastro</strong>
                  <p>{googleSignupUser.email || 'Conta Google selecionada'}</p>
                </div>
              </div>
            )}

            <div className="form-grid">
              <input
                name="nome"
                placeholder="Nome completo"
                value={form.nome}
                onChange={handleChange}
                required
              />

              <input
                name="email"
                type="email"
                placeholder="E-mail"
                value={form.email}
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

              {/* Campo de senha com botão para mostrar ou ocultar o valor digitado. */}
              <div className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="senha"
                  placeholder={isGoogleSignup ? 'Acesso via Google vinculado' : 'Senha'}
                  value={form.senha}
                  onChange={handleChange}
                  required={!isGoogleSignup}
                  disabled={isGoogleSignup}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  disabled={isGoogleSignup}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>

              {/* Painel de análise da força da senha, exibido após digitação. */}
              {!isGoogleSignup && passwordStrength && (
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

                  {/* Medidor visual baseado na pontuação da senha. */}
                  <div className="strength-meter" aria-hidden="true">
                    {passwordCriteria.map((item, index) => (
                      <span
                        key={item.key}
                        className={index < passwordStrength.score ? 'active' : ''}
                      />
                    ))}
                  </div>

                  {/* Lista os critérios atendidos e não atendidos pela senha. */}
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

              {/* Campo de confirmação de senha com estado visual de compatibilidade. */}
              <div className={`confirm-password-field ${confirmPasswordStatus}`}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmarSenha"
                  placeholder={isGoogleSignup ? 'Acesso via Google vinculado' : 'Confirmar senha'}
                  value={form.confirmarSenha}
                  onChange={handleChange}
                  required={!isGoogleSignup}
                  disabled={isGoogleSignup}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword((visible) => !visible)}
                  aria-label={showConfirmPassword ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'}
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
                {!isGoogleSignup && confirmPasswordStatus && (
                  <span className="confirm-password-message">
                    {confirmPasswordStatus === 'match'
                      ? 'Senhas conferem'
                      : 'As senhas ainda não conferem'}
                  </span>
                )}
              </div>
            </div>

            {/* Botão de envio bloqueado quando a senha ainda não é forte. */}
            <button type="submit" className="btn-primary" disabled={!canSubmit}>
              {submitLoading ? 'Criando conta...' : isGoogleSignup || isPasswordStrong ? 'Criar conta ->' : 'Complete a senha forte'}
            </button>
            <div className="google-signup-area">
              <div className="google-divider">
                <span>ou</span>
              </div>

              {googleMessage && (
                <p className={`google-signup-message ${isGoogleSignup ? 'success' : 'warning'}`}>
                  {googleMessage}
                </p>
              )}

              <button
                type="button"
                className="google-signup-button"
                onClick={handleGoogleSignup}
                disabled={googleLoading || submitLoading || isGoogleSignup}
              >
                <FaGoogle />
                {googleLoading ? 'Conectando...' : isGoogleSignup ? 'Google vinculado' : 'Continuar com Google'}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Componente de rodapé da aplicação. */}
      <Footer />
    </>
  )
}

export default CadastroIndicador
