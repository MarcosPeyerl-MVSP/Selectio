import './AccountSettings.css'

import { useEffect, useMemo, useState } from 'react'
import {
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  unlink,
  updatePassword
} from 'firebase/auth'
import {
  FaCheckCircle,
  FaEnvelope,
  FaExclamationTriangle,
  FaGoogle,
  FaKey,
  FaUnlink,
  FaUserCircle
} from 'react-icons/fa'

import { auth } from '../../services/firebase'
import { getFirebaseAuthErrorMessage, isFirebaseAuthError } from '../../services/authErrors'
import { getFirebaseUid } from '../../services/firebaseIdentity'

const googleProviderId = 'google.com'
const passwordProviderId = 'password'
const minPasswordLength = 8

const snapshotFirebaseUser = (firebaseUser) => {
  if (!firebaseUser) return null

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    providerData: firebaseUser.providerData || []
  }
}

const getLinkedProviderIds = (firebaseUser) => {
  return firebaseUser?.providerData?.map((provider) => provider.providerId) || []
}

function AccountSettings({ user, tipo }) {
  const [firebaseUser, setFirebaseUser] = useState(() => snapshotFirebaseUser(auth.currentUser))
  const [authReady, setAuthReady] = useState(false)
  const [linking, setLinking] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [message, setMessage] = useState(null)
  const [passwordForm, setPasswordForm] = useState({
    novaSenha: '',
    confirmarSenha: ''
  })

  const firebaseUid = getFirebaseUid(user)
  const accountType = tipo === 'empresa' ? 'Empresa' : 'Indicador'
  const accountName = user?.nomeEmpresa || user?.nome || 'Conta Selectio'
  const accountEmail = user?.email || firebaseUser?.email || 'E-mail nao informado'

  const linkedProviderIds = useMemo(() => getLinkedProviderIds(firebaseUser), [firebaseUser])
  const hasPasswordLinked = linkedProviderIds.includes(passwordProviderId)
  const hasGoogleLinked = linkedProviderIds.includes(googleProviderId)
  const isSameFirebaseUser = Boolean(firebaseUser?.uid && firebaseUid && firebaseUser.uid === firebaseUid)
  const isBusy = linking || unlinking || savingPassword
  const canLinkGoogle = authReady && isSameFirebaseUser && !hasGoogleLinked && !isBusy
  const canUnlinkGoogle = authReady && isSameFirebaseUser && hasGoogleLinked && !isBusy

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setFirebaseUser(snapshotFirebaseUser(currentUser))
      setAuthReady(true)
    })

    return unsubscribe
  }, [])

  const refreshFirebaseUser = async (fallbackUser = auth.currentUser) => {
    if (auth.currentUser && typeof auth.currentUser.reload === 'function') {
      await auth.currentUser.reload()
    }

    setFirebaseUser(snapshotFirebaseUser(auth.currentUser || fallbackUser))
  }

  const requireCurrentUser = () => {
    const currentUser = auth.currentUser

    if (!currentUser) {
      setMessage({
        type: 'warning',
        text: 'Entre novamente para gerenciar os metodos de login.'
      })
      return null
    }

    if (firebaseUid && currentUser.uid !== firebaseUid) {
      setMessage({
        type: 'warning',
        text: 'A sessao do Firebase nao corresponde a conta aberta no painel. Entre novamente.'
      })
      return null
    }

    return currentUser
  }

  const handlePasswordChange = (event) => {
    const { name, value } = event.target
    setPasswordForm((currentForm) => ({
      ...currentForm,
      [name]: value
    }))
  }

  const handleSavePassword = async (event) => {
    event.preventDefault()
    setMessage(null)

    const currentUser = requireCurrentUser()
    if (!currentUser) return

    if (hasPasswordLinked) {
      setMessage({
        type: 'success',
        text: 'Esta conta ja possui login por e-mail e senha.'
      })
      return
    }

    if (passwordForm.novaSenha.length < minPasswordLength) {
      setMessage({
        type: 'warning',
        text: `Use uma senha com pelo menos ${minPasswordLength} caracteres.`
      })
      return
    }

    if (passwordForm.novaSenha !== passwordForm.confirmarSenha) {
      setMessage({
        type: 'warning',
        text: 'As senhas nao conferem.'
      })
      return
    }

    try {
      setSavingPassword(true)
      await updatePassword(currentUser, passwordForm.novaSenha)
      await refreshFirebaseUser(currentUser)
      setPasswordForm({ novaSenha: '', confirmarSenha: '' })
      setMessage({
        type: 'success',
        text: 'Senha adicionada com sucesso. Agora voce tambem pode entrar com e-mail e senha.'
      })
    } catch (error) {
      setMessage({
        type: 'warning',
        text: isFirebaseAuthError(error)
          ? getFirebaseAuthErrorMessage(error)
          : 'Nao foi possivel adicionar senha agora. Tente novamente.'
      })
    } finally {
      setSavingPassword(false)
    }
  }

  const handleLinkGoogle = async () => {
    setMessage(null)

    const currentUser = requireCurrentUser()
    if (!currentUser) return

    if (getLinkedProviderIds(currentUser).includes(googleProviderId)) {
      await refreshFirebaseUser(currentUser)
      setMessage({
        type: 'success',
        text: 'Esta conta ja possui Google vinculado.'
      })
      return
    }

    try {
      setLinking(true)

      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })

      const credential = await linkWithPopup(currentUser, provider)
      await refreshFirebaseUser(credential.user)
      setMessage({
        type: 'success',
        text: 'Conta Google vinculada com sucesso.'
      })
    } catch (error) {
      setMessage({
        type: 'warning',
        text: isFirebaseAuthError(error)
          ? getFirebaseAuthErrorMessage(error)
          : 'Nao foi possivel vincular Google agora. Tente novamente.'
      })
    } finally {
      setLinking(false)
    }
  }

  const handleUnlinkGoogle = async () => {
    setMessage(null)

    const currentUser = requireCurrentUser()
    if (!currentUser) return

    const currentProviderIds = getLinkedProviderIds(currentUser)

    if (!currentProviderIds.includes(googleProviderId)) {
      await refreshFirebaseUser(currentUser)
      setMessage({
        type: 'success',
        text: 'Esta conta nao possui Google vinculado.'
      })
      return
    }

    if (currentProviderIds.length <= 1) {
      setMessage({
        type: 'warning',
        text: 'Para desvincular o Google, primeiro adicione uma senha à sua conta.'
      })
      return
    }

    try {
      setUnlinking(true)
      const updatedUser = await unlink(currentUser, googleProviderId)
      await refreshFirebaseUser(updatedUser)
      setMessage({
        type: 'success',
        text: 'Google desvinculado com sucesso.'
      })
    } catch (error) {
      setMessage({
        type: 'warning',
        text: isFirebaseAuthError(error)
          ? getFirebaseAuthErrorMessage(error)
          : 'Nao foi possivel desvincular Google agora. Tente novamente.'
      })
    } finally {
      setUnlinking(false)
    }
  }

  return (
    <section className="account-settings">
      <p className="dashboard-breadcrumb">CONFIGURACOES - Conta</p>

      <div className="settings-header">
        <div>
          <h1>
            Configuracoes da <span>conta</span>.
          </h1>
          <p className="dashboard-subtitle">
            Gerencie dados basicos e os metodos usados para acessar sua conta Selectio.
          </p>
        </div>
      </div>

      <div className="settings-grid">
        <article className="settings-card account-summary-card">
          <div className="settings-card-title">
            <FaUserCircle />
            <div>
              <span>Dados da conta</span>
              <h2>{accountName}</h2>
            </div>
          </div>

          <dl className="settings-details">
            <div>
              <dt>Nome</dt>
              <dd>{accountName}</dd>
            </div>
            <div>
              <dt>E-mail</dt>
              <dd>{accountEmail}</dd>
            </div>
            <div>
              <dt>Tipo de conta</dt>
              <dd>{accountType}</dd>
            </div>
          </dl>
        </article>

        <article className="settings-card provider-card">
          <div className="settings-card-title">
            <FaKey />
            <div>
              <span>Metodos de login</span>
              <h2>Acesso</h2>
            </div>
          </div>

          <div className="login-methods">
            <LoginMethod
              icon={<FaEnvelope />}
              title="E-mail e senha"
              linked={hasPasswordLinked}
              description={
                hasPasswordLinked
                  ? 'Senha ativa para login com e-mail.'
                  : 'Adicione uma senha para ter um segundo metodo de acesso.'
              }
            />

            <LoginMethod
              icon={<FaGoogle />}
              title="Google"
              linked={hasGoogleLinked}
              description={
                hasGoogleLinked
                  ? 'Google ativo para login social.'
                  : 'Vincule uma conta Google para login social.'
              }
            />
          </div>

          {!isSameFirebaseUser && authReady && (
            <p className="settings-note">
              Entre novamente para confirmar sua sessao do Firebase antes de alterar metodos de login.
            </p>
          )}

          {message && (
            <p className={`settings-message ${message.type}`}>{message.text}</p>
          )}

          {!hasPasswordLinked && (
            <form className="password-setup" onSubmit={handleSavePassword}>
              <h3>Adicionar senha</h3>
              <div className="settings-field-grid">
                <label>
                  Nova senha
                  <input
                    type="password"
                    name="novaSenha"
                    value={passwordForm.novaSenha}
                    onChange={handlePasswordChange}
                    minLength={minPasswordLength}
                    placeholder="Minimo de 8 caracteres"
                  />
                </label>

                <label>
                  Confirmar senha
                  <input
                    type="password"
                    name="confirmarSenha"
                    value={passwordForm.confirmarSenha}
                    onChange={handlePasswordChange}
                    minLength={minPasswordLength}
                    placeholder="Repita a senha"
                  />
                </label>
              </div>

              <button
                type="submit"
                className="settings-secondary-button"
                disabled={!authReady || !isSameFirebaseUser || savingPassword}
              >
                <FaKey />
                {savingPassword ? 'Salvando...' : 'Adicionar senha'}
              </button>
            </form>
          )}

          <div className="provider-actions">
            <button
              type="button"
              className="google-link-button"
              onClick={handleLinkGoogle}
              disabled={!canLinkGoogle}
            >
              <FaGoogle />
              {linking ? 'Vinculando...' : hasGoogleLinked ? 'Google vinculado' : 'Vincular conta Google'}
            </button>

            {hasGoogleLinked && (
              <button
                type="button"
                className="settings-danger-button"
                onClick={handleUnlinkGoogle}
                disabled={!canUnlinkGoogle}
              >
                <FaUnlink />
                {unlinking ? 'Desvinculando...' : 'Desvincular Google'}
              </button>
            )}
          </div>
        </article>
      </div>
    </section>
  )
}

function LoginMethod({ icon, title, linked, description }) {
  return (
    <div className={`login-method ${linked ? 'linked' : 'unlinked'}`}>
      <div className="method-icon">{icon}</div>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <span className="method-badge">
        {linked ? <FaCheckCircle /> : <FaExclamationTriangle />}
        {linked ? 'Vinculado' : 'Nao vinculado'}
      </span>
    </div>
  )
}

export default AccountSettings
