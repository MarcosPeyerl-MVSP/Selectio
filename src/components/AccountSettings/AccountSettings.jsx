import './AccountSettings.css'

import { useEffect, useMemo, useState } from 'react'
import {
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  sendEmailVerification,
  unlink,
  updatePassword
} from 'firebase/auth'
import {
  FaCheckCircle,
  FaEnvelope,
  FaExclamationTriangle,
  FaGoogle,
  FaKey,
  FaRedo,
  FaSave,
  FaUnlink,
  FaUserCircle
} from 'react-icons/fa'

import PageLoader from '../ui/PageLoader'
import { auth } from '../../services/firebase'
import { getFirebaseAuthErrorMessage, isFirebaseAuthError } from '../../services/authErrors'
import { getFirebaseUid } from '../../services/firebaseIdentity'
import { atualizarPerfilUsuario } from '../../services/firestoreUsers'
import { useConfirm } from '../../hooks/useConfirm'
import { useToast } from '../../hooks/useToast'

const googleProviderId = 'google.com'
const passwordProviderId = 'password'
const minPasswordLength = 8

const profileFieldsByTipo = {
  empresa: [
    { name: 'nomeEmpresa', label: 'Nome da empresa', placeholder: 'Nome exibido da empresa' },
    { name: 'telefone', label: 'Telefone', placeholder: '(00) 00000-0000' },
    { name: 'site', label: 'Site', placeholder: 'https://empresa.com' },
    { name: 'setor', label: 'Setor', placeholder: 'Tecnologia, Financeiro...' },
    { name: 'tamanho', label: 'Tamanho', placeholder: 'Pequena, média, grande...' }
  ],
  indicador: [
    { name: 'nome', label: 'Nome', placeholder: 'Nome completo' },
    { name: 'telefone', label: 'Telefone', placeholder: '(00) 00000-0000' },
    { name: 'pix', label: 'Pix', placeholder: 'Chave Pix' },
    { name: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/perfil' }
  ]
}

const snapshotFirebaseUser = (firebaseUser) => {
  if (!firebaseUser) return null

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    emailVerified: Boolean(firebaseUser.emailVerified),
    providerData: firebaseUser.providerData || []
  }
}

const getLinkedProviderIds = (firebaseUser) => {
  return firebaseUser?.providerData?.map((provider) => provider.providerId) || []
}

const getProfileForm = (profile, tipo) => {
  const fields = profileFieldsByTipo[tipo] || []

  return fields.reduce((form, field) => ({
    ...form,
    [field.name]: profile?.[field.name] || ''
  }), {})
}

function AccountSettings({ user, tipo, onUserUpdate }) {
  const toast = useToast()
  const confirm = useConfirm()
  const [firebaseUser, setFirebaseUser] = useState(() => snapshotFirebaseUser(auth.currentUser))
  const [authReady, setAuthReady] = useState(false)
  const [linking, setLinking] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [sendingVerification, setSendingVerification] = useState(false)
  const [refreshingEmail, setRefreshingEmail] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState(() => getProfileForm(user, tipo))
  const [passwordForm, setPasswordForm] = useState({
    novaSenha: '',
    confirmarSenha: ''
  })

  const firebaseUid = getFirebaseUid(user)
  const accountType = tipo === 'empresa' ? 'Empresa' : 'Indicador'
  const accountName = user?.nomeEmpresa || user?.nome || 'Conta Selectio'
  const accountEmail = user?.email || firebaseUser?.email || 'E-mail não informado'
  const profileFields = profileFieldsByTipo[tipo] || []
  const storageKey = tipo === 'empresa' ? 'empresaUser' : 'indicadorUser'

  const linkedProviderIds = useMemo(() => getLinkedProviderIds(firebaseUser), [firebaseUser])
  const hasPasswordLinked = linkedProviderIds.includes(passwordProviderId)
  const hasGoogleLinked = linkedProviderIds.includes(googleProviderId)
  const isSameFirebaseUser = Boolean(firebaseUser?.uid && firebaseUid && firebaseUser.uid === firebaseUid)
  const isEmailVerified = Boolean(firebaseUser?.emailVerified)
  const isBusy = linking || unlinking || savingPassword || sendingVerification || refreshingEmail || savingProfile
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
      toast.warning('Entre novamente para gerenciar sua conta.')
      return null
    }

    if (firebaseUid && currentUser.uid !== firebaseUid) {
      toast.warning('A sessão do Firebase não corresponde a conta aberta no painel. Entre novamente.')
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

    const currentUser = requireCurrentUser()
    if (!currentUser) return

    if (hasPasswordLinked) {
      toast.info('Esta conta já possui login por e-mail e senha.')
      return
    }

    if (passwordForm.novaSenha.length < minPasswordLength) {
      toast.warning(`Use uma senha com pelo menos ${minPasswordLength} caracteres.`)
      return
    }

    if (passwordForm.novaSenha !== passwordForm.confirmarSenha) {
      toast.warning('As senhas não conferem.')
      return
    }

    try {
      setSavingPassword(true)
      await updatePassword(currentUser, passwordForm.novaSenha)
      await refreshFirebaseUser(currentUser)
      setPasswordForm({ novaSenha: '', confirmarSenha: '' })
      toast.success('Senha adicionada com sucesso. Agora você também pode entrar com e-mail e senha.')
    } catch (error) {
      toast.warning(isFirebaseAuthError(error)
        ? getFirebaseAuthErrorMessage(error)
        : 'Não foi possível adicionar senha agora. Tente novamente.')
    } finally {
      setSavingPassword(false)
    }
  }

  const handleLinkGoogle = async () => {
    const currentUser = requireCurrentUser()
    if (!currentUser) return

    if (getLinkedProviderIds(currentUser).includes(googleProviderId)) {
      await refreshFirebaseUser(currentUser)
      toast.info('Esta conta já possui Google vinculado.')
      return
    }

    try {
      setLinking(true)

      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })

      const credential = await linkWithPopup(currentUser, provider)
      await refreshFirebaseUser(credential.user)
      toast.success('Conta Google vinculada com sucesso.')
    } catch (error) {
      toast.warning(isFirebaseAuthError(error)
        ? getFirebaseAuthErrorMessage(error)
        : 'Não foi possível vincular Google agora. Tente novamente.')
    } finally {
      setLinking(false)
    }
  }

  const handleUnlinkGoogle = async () => {
    const currentUser = requireCurrentUser()
    if (!currentUser) return

    const currentProviderIds = getLinkedProviderIds(currentUser)

    if (!currentProviderIds.includes(googleProviderId)) {
      await refreshFirebaseUser(currentUser)
      toast.info('Esta conta não possui Google vinculado.')
      return
    }

    if (currentProviderIds.length <= 1) {
      toast.warning('Para desvincular o Google, primeiro adicione uma senha a sua conta.')
      return
    }

    const confirmed = await confirm({
      title: 'Desvincular Google?',
      description: 'Você ainda poderá entrar com e-mail e senha. Esta ação remove apenas o método de login Google.',
      confirmLabel: 'Desvincular'
    })

    if (!confirmed) return

    try {
      setUnlinking(true)
      const updatedUser = await unlink(currentUser, googleProviderId)
      await refreshFirebaseUser(updatedUser)
      toast.success('Google desvinculado com sucesso.')
    } catch (error) {
      toast.warning(isFirebaseAuthError(error)
        ? getFirebaseAuthErrorMessage(error)
        : 'Não foi possível desvincular Google agora. Tente novamente.')
    } finally {
      setUnlinking(false)
    }
  }

  const handleRefreshEmailStatus = async () => {
    const currentUser = requireCurrentUser()
    if (!currentUser) return

    try {
      setRefreshingEmail(true)
      await refreshFirebaseUser(currentUser)
      toast.info(auth.currentUser?.emailVerified
        ? 'E-mail verificado confirmado.'
        : 'Seu e-mail ainda não aparece como verificado.')
    } catch {
      toast.error('Não foi possível atualizar o status do e-mail agora.')
    } finally {
      setRefreshingEmail(false)
    }
  }

  const handleResendVerification = async () => {
    const currentUser = requireCurrentUser()
    if (!currentUser) return

    if (currentUser.emailVerified) {
      await refreshFirebaseUser(currentUser)
      toast.info('Este e-mail já está verificado.')
      return
    }

    try {
      setSendingVerification(true)
      await sendEmailVerification(currentUser)
      toast.success('Enviamos um novo e-mail de verificação.')
    } catch (error) {
      toast.warning(isFirebaseAuthError(error)
        ? getFirebaseAuthErrorMessage(error)
        : 'Não foi possível reenviar a verificação agora.')
    } finally {
      setSendingVerification(false)
    }
  }

  const handleProfileChange = (event) => {
    const { name, value } = event.target
    setProfileForm((currentForm) => ({
      ...currentForm,
      [name]: value
    }))
  }

  const handleSaveProfile = async (event) => {
    event.preventDefault()

    if (!firebaseUid) {
      toast.warning('Perfil sem UID do Firebase. Entre novamente antes de salvar.')
      return
    }

    try {
      setSavingProfile(true)
      const updatedFields = await atualizarPerfilUsuario({
        uid: firebaseUid,
        tipo,
        dados: profileForm
      })
      const updatedUser = {
        ...user,
        ...updatedFields,
        id: user?.id || firebaseUid,
        uid: firebaseUid,
        firebaseUid
      }

      localStorage.setItem(storageKey, JSON.stringify(updatedUser))
      onUserUpdate?.(updatedUser)
      toast.success('Perfil atualizado com sucesso.')
    } catch {
      toast.error('Não foi possível atualizar o perfil agora.')
    } finally {
      setSavingProfile(false)
    }
  }

  if (!authReady) {
    return (
      <section className="account-settings">
        <PageLoader label="Carregando configuracoes da conta..." />
      </section>
    )
  }

  return (
    <section className="account-settings">
      <p className="dashboard-breadcrumb">CONFIGURAÇÕES - Conta</p>

      <div className="settings-header">
        <div>
          <h1>
            Configurações da <span>conta</span>.
          </h1>
          <p className="dashboard-subtitle">
            Gerencie dados básicos e os métodos usados para acessar sua conta Selectio.
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

          <form className="profile-edit-form" onSubmit={handleSaveProfile}>
            <h3>Editar dados básicos</h3>
            <div className="settings-field-grid">
              {profileFields.map((field) => (
                <label key={field.name}>
                  {field.label}
                  <input
                    name={field.name}
                    value={profileForm[field.name] || ''}
                    onChange={handleProfileChange}
                    placeholder={field.placeholder}
                  />
                </label>
              ))}
            </div>

            <button type="submit" className="settings-secondary-button" disabled={savingProfile}>
              <FaSave />
              {savingProfile ? 'Salvando...' : 'Salvar perfil'}
            </button>
          </form>
        </article>

        <article className="settings-card provider-card">
          <div className="settings-card-title">
            <FaKey />
            <div>
              <span>Métodos de login</span>
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
                  : 'Adicione uma senha para ter um segundo método de acesso.'
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
              Entre novamente para confirmar sua sessão do Firebase antes de alterar métodos de login.
            </p>
          )}

          <div className={`email-verification-card ${isEmailVerified ? 'verified' : 'pending'}`}>
            <div>
              <strong>{isEmailVerified ? 'E-mail verificado' : 'E-mail não verificado'}</strong>
              <p>
                {isEmailVerified
                  ? 'Este e-mail já foi confirmado no Firebase Auth.'
                  : 'Confirme seu e-mail para manter a conta mais segura.'}
              </p>
            </div>
            <span>{isEmailVerified ? <FaCheckCircle /> : <FaExclamationTriangle />}</span>
          </div>

          <div className="email-actions">
            {!isEmailVerified && (
              <button type="button" className="settings-secondary-button" onClick={handleResendVerification} disabled={!isSameFirebaseUser || sendingVerification}>
                <FaEnvelope />
                {sendingVerification ? 'Enviando...' : 'Reenviar verificação'}
              </button>
            )}
            <button type="button" className="settings-secondary-button" onClick={handleRefreshEmailStatus} disabled={!isSameFirebaseUser || refreshingEmail}>
              <FaRedo />
              {refreshingEmail ? 'Atualizando...' : 'Atualizar status'}
            </button>
          </div>

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
                    placeholder="Mínimo de 8 caracteres"
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
        {linked ? 'Vinculado' : 'Não vinculado'}
      </span>
    </div>
  )
}

export default AccountSettings
