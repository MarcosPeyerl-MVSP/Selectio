import './ConfiguracoesConta.css'

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
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
  FaRoute,
  FaSave,
  FaUnlink,
  FaUserCircle
} from 'react-icons/fa'
import { MdTranslate } from 'react-icons/md'
import { LuSunMoon } from 'react-icons/lu'

import PageLoader from '../ui/PageLoader'
import LanguageSwitcher from '../layout/LanguageSwitcher'
import ThemeSwitcher from '../layout/ThemeSwitcher'
import { auth } from '../../services/firebase'
import { getFirebaseAuthErrorKey, isFirebaseAuthError } from '../../services/errosAutenticacao'
import { getFirebaseUid } from '../../services/identidadeFirebase'
import { atualizarPerfilUsuario, definirTourUsuarioConcluido } from '../../services/firestoreUsers'
import { useConfirmacao } from '../../hooks/useConfirmacao'
import { useToast } from '../../hooks/useToast'

const googleProviderId = 'google.com'
const passwordProviderId = 'password'
const minPasswordLength = 8

const profileFieldsByTipo = {
  empresa: [
    { name: 'nomeEmpresa', labelKey: 'accountSettings.fields.companyName', placeholderKey: 'accountSettings.fields.companyNamePlaceholder' },
    { name: 'telefone', labelKey: 'accountSettings.fields.phone', placeholderKey: 'accountSettings.fields.phonePlaceholder' },
    { name: 'site', label: 'Site', placeholderKey: 'accountSettings.fields.sitePlaceholder' },
    { name: 'setor', labelKey: 'accountSettings.fields.sector', placeholderKey: 'accountSettings.fields.sectorPlaceholder' },
    { name: 'tamanho', labelKey: 'accountSettings.fields.size', placeholderKey: 'accountSettings.fields.sizePlaceholder' }
  ],
  indicador: [
    { name: 'nome', labelKey: 'accountSettings.fields.name', placeholderKey: 'accountSettings.fields.namePlaceholder' },
    { name: 'telefone', labelKey: 'accountSettings.fields.phone', placeholderKey: 'accountSettings.fields.phonePlaceholder' },
    { name: 'pix', label: 'Pix', placeholderKey: 'accountSettings.fields.pixPlaceholder' },
    { name: 'linkedin', label: 'LinkedIn', placeholderKey: 'accountSettings.fields.linkedinPlaceholder' }
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

function ConfiguracoesConta({ user, tipo, onUserUpdate }) {
  const { t } = useTranslation(['common', 'auth'])
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirmacao()
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
  const accountType = tipo === 'empresa' ? t('accountSettings.company') : t('accountSettings.referrer')
  const accountName = user?.nomeEmpresa || user?.nome || t('accountSettings.accountFallback')
  const accountEmail = user?.email || firebaseUser?.email || t('accountSettings.emailNotProvided')
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

  const repetirTour = async () => {
    if (!firebaseUid) {
      toast.warning(t('accountSettings.tourMissingUid'))
      return
    }

    const field = tipo === 'empresa' ? 'tourEmpresaConcluido' : 'tourIndicadorConcluido'
    const onboardingField = tipo === 'empresa' ? 'empresaConcluido' : 'indicadorConcluido'
    const updatedUser = {
      ...user,
      [field]: false,
      onboardingTour: {
        ...(user?.onboardingTour || {}),
        [onboardingField]: false
      }
    }

    localStorage.setItem(storageKey, JSON.stringify(updatedUser))
    onUserUpdate?.(updatedUser)

    try {
      await definirTourUsuarioConcluido({ uid: firebaseUid, tipo, concluido: false })
    } catch {
      toast.warning(t('accountSettings.tourSessionOnly'))
    }

    navigate(tipo === 'empresa' ? '/painel/empresa' : '/painel/indicador')
  }

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
      toast.warning(t('accountSettings.signInAgain'))
      return null
    }

    if (firebaseUid && currentUser.uid !== firebaseUid) {
      toast.warning(t('accountSettings.sessionMismatch'))
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
      toast.info(t('accountSettings.passwordAlreadyLinked'))
      return
    }

    if (passwordForm.novaSenha.length < minPasswordLength) {
      toast.warning(t('accountSettings.passwordMin', { count: minPasswordLength }))
      return
    }

    if (passwordForm.novaSenha !== passwordForm.confirmarSenha) {
      toast.warning(t('accountSettings.passwordMismatch'))
      return
    }

    try {
      setSavingPassword(true)
      await updatePassword(currentUser, passwordForm.novaSenha)
      await refreshFirebaseUser(currentUser)
      setPasswordForm({ novaSenha: '', confirmarSenha: '' })
      toast.success(t('accountSettings.passwordAdded'))
    } catch (error) {
      toast.warning(isFirebaseAuthError(error)
        ? t(`auth:${getFirebaseAuthErrorKey(error)}`)
        : t('accountSettings.passwordAddError'))
    } finally {
      setSavingPassword(false)
    }
  }

  const handleLinkGoogle = async () => {
    const currentUser = requireCurrentUser()
    if (!currentUser) return

    if (getLinkedProviderIds(currentUser).includes(googleProviderId)) {
      await refreshFirebaseUser(currentUser)
      toast.info(t('accountSettings.googleAlreadyLinked'))
      return
    }

    try {
      setLinking(true)

      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })

      const credential = await linkWithPopup(currentUser, provider)
      await refreshFirebaseUser(credential.user)
      toast.success(t('accountSettings.googleLinked'))
    } catch (error) {
      toast.warning(isFirebaseAuthError(error)
        ? t(`auth:${getFirebaseAuthErrorKey(error)}`)
        : t('accountSettings.googleLinkError'))
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
      toast.info(t('accountSettings.googleNotLinked'))
      return
    }

    if (currentProviderIds.length <= 1) {
      toast.warning(t('accountSettings.googleNeedsPassword'))
      return
    }

    const confirmed = await confirm({
      title: t('accountSettings.unlinkTitle'),
      description: t('accountSettings.unlinkDescription'),
      confirmLabel: t('accountSettings.unlink')
    })

    if (!confirmed) return

    try {
      setUnlinking(true)
      const updatedUser = await unlink(currentUser, googleProviderId)
      await refreshFirebaseUser(updatedUser)
      toast.success(t('accountSettings.googleUnlinked'))
    } catch (error) {
      toast.warning(isFirebaseAuthError(error)
        ? t(`auth:${getFirebaseAuthErrorKey(error)}`)
        : t('accountSettings.googleUnlinkError'))
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
        ? t('accountSettings.emailVerifiedConfirmed')
        : t('accountSettings.emailStillUnverified'))
    } catch {
      toast.error(t('accountSettings.emailRefreshError'))
    } finally {
      setRefreshingEmail(false)
    }
  }

  const handleResendVerification = async () => {
    const currentUser = requireCurrentUser()
    if (!currentUser) return

    if (currentUser.emailVerified) {
      await refreshFirebaseUser(currentUser)
      toast.info(t('accountSettings.emailAlreadyVerified'))
      return
    }

    try {
      setSendingVerification(true)
      await sendEmailVerification(currentUser)
      toast.success(t('accountSettings.verificationSent'))
    } catch (error) {
      toast.warning(isFirebaseAuthError(error)
        ? t(`auth:${getFirebaseAuthErrorKey(error)}`)
        : t('accountSettings.verificationError'))
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
      toast.warning(t('accountSettings.profileMissingUid'))
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
      toast.success(t('accountSettings.profileUpdated'))
    } catch {
      toast.error(t('accountSettings.profileUpdateError'))
    } finally {
      setSavingProfile(false)
    }
  }

  if (!authReady) {
    return (
      <section className="account-settings">
        <PageLoader label={t('accountSettings.loading')} />
      </section>
    )
  }

  return (
    <section className="account-settings">
      <p className="dashboard-breadcrumb">{t('accountSettings.breadcrumb')}</p>

      <div className="settings-header">
        <div>
          <h1>
            {t('accountSettings.titleFirst')} <span>{t('accountSettings.titleHighlight')}</span>.
          </h1>
          <p className="dashboard-subtitle">
            {t('accountSettings.subtitle')}
          </p>
        </div>
      </div>

      <div className="settings-grid">
        <article className="settings-card account-summary-card">
          <div className="settings-card-title">
            <FaUserCircle />
            <div>
              <span>{t('accountSettings.accountData')}</span>
              <h2>{accountName}</h2>
            </div>
          </div>

          <dl className="settings-details">
            <div>
              <dt>{t('accountSettings.name')}</dt>
              <dd>{accountName}</dd>
            </div>
            <div>
              <dt>{t('accountSettings.email')}</dt>
              <dd>{accountEmail}</dd>
            </div>
            <div>
              <dt>{t('accountSettings.accountType')}</dt>
              <dd>{accountType}</dd>
            </div>
          </dl>

          <form className="profile-edit-form" onSubmit={handleSaveProfile}>
            <h3>{t('accountSettings.editBasics')}</h3>
            <div className="settings-field-grid">
              {profileFields.map((field) => (
                <label key={field.name}>
                  {field.label || t(field.labelKey)}
                  <input
                    name={field.name}
                    value={profileForm[field.name] || ''}
                    onChange={handleProfileChange}
                    placeholder={field.placeholder || t(field.placeholderKey)}
                  />
                </label>
              ))}
            </div>

            <button type="submit" className="settings-secondary-button" disabled={savingProfile}>
              <FaSave />
              {savingProfile ? t('accountSettings.saving') : t('accountSettings.saveProfile')}
            </button>
          </form>
        </article>

        <article className="settings-card provider-card">
          <div className="settings-card-title">
            <FaKey />
            <div>
              <span>{t('accountSettings.loginMethods')}</span>
              <h2>{t('accountSettings.access')}</h2>
            </div>
          </div>

          <div className="login-methods">
            <LoginMethod
              icon={<FaEnvelope />}
              title={t('accountSettings.emailPassword')}
              linked={hasPasswordLinked}
              description={
                hasPasswordLinked
                  ? t('accountSettings.passwordActive')
                  : t('accountSettings.passwordAddDescription')
              }
            />

            <LoginMethod
              icon={<FaGoogle />}
              title="Google"
              linked={hasGoogleLinked}
              description={
                hasGoogleLinked
                  ? t('accountSettings.googleActive')
                  : t('accountSettings.googleAddDescription')
              }
            />
          </div>

          {!isSameFirebaseUser && authReady && (
            <p className="settings-note">
              {t('accountSettings.reauthNote')}
            </p>
          )}

          <div className={`email-verification-card ${isEmailVerified ? 'verified' : 'pending'}`}>
            <div>
              <strong>{isEmailVerified ? t('accountSettings.emailVerified') : t('accountSettings.emailUnverified')}</strong>
              <p>
                {isEmailVerified
                  ? t('accountSettings.emailVerifiedDescription')
                  : t('accountSettings.emailUnverifiedDescription')}
              </p>
            </div>
            <span>{isEmailVerified ? <FaCheckCircle /> : <FaExclamationTriangle />}</span>
          </div>

          <div className="email-actions">
            {!isEmailVerified && (
              <button type="button" className="settings-secondary-button" onClick={handleResendVerification} disabled={!isSameFirebaseUser || sendingVerification}>
                <FaEnvelope />
                {sendingVerification ? t('accountSettings.sending') : t('accountSettings.resendVerification')}
              </button>
            )}
            <button type="button" className="settings-secondary-button" onClick={handleRefreshEmailStatus} disabled={!isSameFirebaseUser || refreshingEmail}>
              <FaRedo />
              {refreshingEmail ? t('accountSettings.updating') : t('accountSettings.updateStatus')}
            </button>
          </div>

          {!hasPasswordLinked && (
            <form className="password-setup" onSubmit={handleSavePassword}>
              <h3>{t('accountSettings.addPassword')}</h3>
              <div className="settings-field-grid">
                <label>
                  {t('accountSettings.newPassword')}
                  <input
                    type="password"
                    name="novaSenha"
                    value={passwordForm.novaSenha}
                    onChange={handlePasswordChange}
                    minLength={minPasswordLength}
                    placeholder={t('accountSettings.passwordPlaceholder')}
                  />
                </label>

                <label>
                  {t('accountSettings.confirmPassword')}
                  <input
                    type="password"
                    name="confirmarSenha"
                    value={passwordForm.confirmarSenha}
                    onChange={handlePasswordChange}
                    minLength={minPasswordLength}
                    placeholder={t('accountSettings.confirmPasswordPlaceholder')}
                  />
                </label>
              </div>

              <button
                type="submit"
                className="settings-secondary-button"
                disabled={!authReady || !isSameFirebaseUser || savingPassword}
              >
                <FaKey />
                {savingPassword ? t('accountSettings.saving') : t('accountSettings.addPassword')}
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
              {linking ? t('accountSettings.linking') : hasGoogleLinked ? t('accountSettings.googleLinkedLabel') : t('accountSettings.linkGoogle')}
            </button>

            {hasGoogleLinked && (
              <button
                type="button"
                className="settings-danger-button"
                onClick={handleUnlinkGoogle}
                disabled={!canUnlinkGoogle}
              >
                <FaUnlink />
                {unlinking ? t('accountSettings.unlinking') : t('accountSettings.unlinkGoogle')}
              </button>
            )}
          </div>
        </article>

        <article className="settings-card language-settings-card">
          <div className="settings-card-title">
            <MdTranslate />
            <div>
              <span>{t('accountSettings.preferences')}</span>
              <h2>{t('accountSettings.languageTitle')}</h2>
            </div>
          </div>

          <p className="settings-note">
            {t('accountSettings.languageDescription')}
          </p>

          <LanguageSwitcher variant="settings" />
        </article>

        <article className="settings-card theme-settings-card">
          <div className="settings-card-title">
            <LuSunMoon />
            <div>
              <span>{t('accountSettings.preferences')}</span>
              <h2>{t('accountSettings.appearanceTitle')}</h2>
            </div>
          </div>

          <p className="settings-note">
            {t('accountSettings.appearanceDescription')}
          </p>

          <ThemeSwitcher />
        </article>

        <article className="settings-card onboarding-card">
          <div className="settings-card-title">
            <FaRoute />
            <div>
              <span>{t('accountSettings.onboarding')}</span>
              <h2>{t('accountSettings.guidedTour')}</h2>
            </div>
          </div>

          <p className="settings-note">
            {t('accountSettings.tourDescription')}
          </p>

          <button type="button" className="settings-secondary-button" onClick={repetirTour}>
            <FaRoute /> {t('accountSettings.repeatTour')}
          </button>
        </article>

      </div>
    </section>
  )
}

function LoginMethod({ icon, title, linked, description }) {
  const { t } = useTranslation('common')

  return (
    <div className={`login-method ${linked ? 'linked' : 'unlinked'}`}>
      <div className="method-icon">{icon}</div>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <span className="method-badge">
        {linked ? <FaCheckCircle /> : <FaExclamationTriangle />}
        {linked ? t('accountSettings.linked') : t('accountSettings.notLinked')}
      </span>
    </div>
  )
}

export default ConfiguracoesConta
