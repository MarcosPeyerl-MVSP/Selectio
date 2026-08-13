// Objetivo do arquivo: renderizar e controlar o formulário de cadastro de indicador.
// O componente valida CPF, avalia força da senha, confirma senha, envia os dados
// no Firebase/Firestore e salva a sessão do indicador após cadastro bem-sucedido.

import './CadastroIndicador.css'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaCheck, FaEye, FaEyeSlash, FaGoogle, FaTimes } from 'react-icons/fa'
import { useTranslation } from 'react-i18next'
import {
  createUserWithEmailAndPassword,
  deleteUser,
  GoogleAuthProvider,
  sendEmailVerification,
  signInWithPopup,
  signOut
} from 'firebase/auth'
import Navbar from '../../components/layout/Navbar'
import Footer from '../../components/layout/Footer'
import { auth } from '../../services/firebase'
import { getFirebaseAuthErrorKey, isFirebaseAuthError } from '../../services/errosAutenticacao'
import { buscarPerfilUsuario, salvarPerfilUsuario } from '../../services/firestoreUsers'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../hooks/useAuth'

// Critérios exibidos e validados para classificar a força da senha.
const passwordCriteria = [
  { key: 'length', labelKey: 'registration.passwordCriteria.length' },
  { key: 'uppercase', labelKey: 'registration.passwordCriteria.uppercase' },
  { key: 'lowercase', labelKey: 'registration.passwordCriteria.lowercase' },
  { key: 'numbers', labelKey: 'registration.passwordCriteria.numbers' },
  { key: 'special', labelKey: 'registration.passwordCriteria.special' },
  { key: 'noSequence', labelKey: 'registration.passwordCriteria.noSequence' }
]

// Textos auxiliares exibidos conforme a classificação da senha.
const strengthCopy = {
  fraca: {
    labelKey: 'registration.passwordStrength.weakLabel',
    hintKey: 'registration.passwordStrength.weakHint'
  },
  média: {
    labelKey: 'registration.passwordStrength.mediumLabel',
    hintKey: 'registration.passwordStrength.mediumHint'
  },
  forte: {
    labelKey: 'registration.passwordStrength.strongLabel',
    hintKey: 'registration.passwordStrength.strongHint'
  }
}

const rollbackFirebaseUser = async (firebaseUser) => {
  if (!firebaseUser) return

  try {
    await deleteUser(firebaseUser)
  } catch {
    // O cadastro local não deve travar se o rollback no Firebase falhar.
  }
}

function CadastroIndicador() {
  const { t } = useTranslation('auth')
  // Hook usado para redirecionar o usuário após cadastro bem-sucedido.
  const navigate = useNavigate()
  const toast = useToast()
  const { adotarPerfil } = useAuth()

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
      strength: score <= 2 ? 'fraca' : score <= 4 ? 'média' : 'forte'
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
      adotarPerfil(perfil)
      toast.info(t('referrerRegistration.existingReferrer'))
      navigate('/painel/indicador')
      return
    }

    if (perfil.tipo === 'empresa') {
      adotarPerfil(perfil)
      toast.info(t('referrerRegistration.existingCompany'))
      navigate('/painel/empresa')
      return
    }

    if (perfil.tipo === 'admin') {
      adotarPerfil(perfil)
      toast.info(t('referrerRegistration.existingAdmin'))
      navigate('/admin/visao-geral')
      return
    }

    toast.info(t('referrerRegistration.existingAccount'))
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
      setGoogleMessage(t('referrerRegistration.googleTemporaryLinked'))
      toast.success(t('referrerRegistration.googleTemporaryLinked'))
    } catch (error) {
      if (pendingGoogleUidRef.current && auth.currentUser?.uid === pendingGoogleUidRef.current) {
        await signOut(auth).catch(() => {})
      }

      if (isFirebaseAuthError(error)) {
        const message = t(getFirebaseAuthErrorKey(error))
        setGoogleMessage(message)
        toast.warning(message)
      } else {
        setGoogleMessage(t('referrerRegistration.googleFailed'))
        toast.warning(t('referrerRegistration.googleFailed'))
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
        toast.warning(t('referrerRegistration.passwordMismatch'))
        return
      }

      if (!isPasswordStrong) {
        toast.warning(t('referrerRegistration.strongPasswordRequired'))
        return
      }
    }

    // Validação: CPF informado precisa ser válido.
    if (form.cpf && !validarCPF(form.cpf)) {
      setForm({ ...form, cpfError: t('referrerRegistration.invalidCpf') })
      return
    }

    // Remove campos usados apenas na interface antes de salvar no Firestore.
    const payload = { ...form }
    delete payload.confirmarSenha
    delete payload.cpfError
    payload.email = payload.email.trim()

    let firebaseUser = null
    let verificationSent = false

    try {
      setSubmitLoading(true)

      let profileUid = googleSignupUser?.uid

      if (isGoogleSignup) {
        if (!profileUid || auth.currentUser?.uid !== profileUid) {
          toast.warning(t('referrerRegistration.googleAgain'))
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
        verificationSent = await sendEmailVerification(firebaseUser)
          .then(() => true)
          .catch(() => {
            toast.warning(t('referrerRegistration.verificationFailed'))
            return false
          })
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
      adotarPerfil(perfilIndicador)
      toast.success(isGoogleSignup
        ? t('referrerRegistration.completedGoogle')
        : verificationSent
          ? t('referrerRegistration.completedVerification')
          : t('referrerRegistration.completed'))
      navigate('/painel/indicador')
    } catch (error) {
      await rollbackFirebaseUser(firebaseUser)

      if (isFirebaseAuthError(error)) {
        toast.error(t(getFirebaseAuthErrorKey(error)))
      } else {
        toast.error(t('referrerRegistration.firestoreFailed'))
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
          <span className="tag center">{t('referrerRegistration.tag')}</span>
          <h1>{t('referrerRegistration.title')}</h1>
          <p className="subtitle">{t('referrerRegistration.description')}</p>

          {/* Formulário de cadastro do indicador. */}
          <form onSubmit={handleSubmit}>
            {isGoogleSignup && (
              <div className="google-linked-card">
                <FaGoogle />
                <div>
                  <strong>{t('referrerRegistration.googleLinkedTitle')}</strong>
                  <p>{googleSignupUser.email || t('referrerRegistration.googleSelected')}</p>
                </div>
              </div>
            )}

            <div className="form-grid">
              <input
                name="nome"
                placeholder={t('referrerRegistration.fullName')}
                value={form.nome}
                onChange={handleChange}
                required
              />

              <input
                name="email"
                type="email"
                placeholder={t('referrerRegistration.email')}
                value={form.email}
                onChange={handleChange}
                required
              />

              <input
                name="cpf"
                placeholder={t('referrerRegistration.cpf')}
                value={form.cpf}
                onChange={handleChange}
                required
              />
              {form.cpfError && <span className="error">{form.cpfError}</span>}

              <input
                name="pix"
                placeholder={t('referrerRegistration.pixKey')}
                onChange={handleChange}
              />

              <input
                name="dataNascimento"
                type="date"
                aria-label={t('referrerRegistration.birthDate')}
                onChange={handleChange}
              />

              {/* Campo de senha com botão para mostrar ou ocultar o valor digitado. */}
              <div className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="senha"
                  placeholder={isGoogleSignup ? t('registration.googleAccess') : t('registration.password')}
                  value={form.senha}
                  onChange={handleChange}
                  required={!isGoogleSignup}
                  disabled={isGoogleSignup}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? t('registration.hidePassword') : t('registration.showPassword')}
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
                      <strong>{t('registration.passwordStrength.label', {
                        strength: t(currentStrength.labelKey)
                      })}</strong>
                      <p>{t(currentStrength.hintKey)}</p>
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
                          {t(item.labelKey)}
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
                  placeholder={isGoogleSignup ? t('registration.googleAccess') : t('registration.confirmPassword')}
                  value={form.confirmarSenha}
                  onChange={handleChange}
                  required={!isGoogleSignup}
                  disabled={isGoogleSignup}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword((visible) => !visible)}
                  aria-label={showConfirmPassword
                    ? t('registration.hidePasswordConfirmation')
                    : t('registration.showPasswordConfirmation')}
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
                {!isGoogleSignup && confirmPasswordStatus && (
                  <span className="confirm-password-message">
                    {confirmPasswordStatus === 'match'
                      ? t('registration.passwordsMatch')
                      : t('registration.passwordsDoNotMatch')}
                  </span>
                )}
              </div>
            </div>

            {/* Botão de envio bloqueado quando a senha ainda não é forte. */}
            <button type="submit" className="btn-primary" disabled={!canSubmit}>
              {submitLoading
                ? t('registration.creatingAccount')
                : isGoogleSignup || isPasswordStrong
                  ? t('registration.createAccount')
                  : t('registration.completeStrongPassword')}
            </button>
            <div className="google-signup-area">
              <div className="google-divider">
                <span>{t('registration.or')}</span>
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
                {googleLoading
                  ? t('registration.connecting')
                  : isGoogleSignup
                    ? t('registration.googleLinked')
                    : t('registration.continueWithGoogle')}
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
