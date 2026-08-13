import './ModalAlterarSetor.css'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FaBuilding, FaEye, FaEyeSlash, FaLock, FaTimes } from 'react-icons/fa'
import { useTranslation } from 'react-i18next'

import { useToast } from '../../hooks/useToast'
import { getFirebaseUid } from '../../services/identidadeFirebase'
import {
  hashSenhaSetor,
  obterHashSenhaSetor,
  obterSetorEmpresarial,
  setoresEmpresariais
} from '../../utils/modoEmpresarial'

const obterSetorInicial = (setorAtualId) => (
  setoresEmpresariais.find((setor) => setor.id !== setorAtualId)?.id || ''
)

function ModalAlterarSetor({ empresa, onClose, onSuccess }) {
  const { t } = useTranslation(['common', 'auth'])
  const setorAtualId = empresa?.setorEmpresarial?.id || ''
  const [setorId, setSetorId] = useState(() => obterSetorInicial(setorAtualId))
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const selectRef = useRef(null)
  const toast = useToast()

  useEffect(() => {
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    selectRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !loading) onClose()
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = overflowAnterior
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [loading, onClose])

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!setorId || setorId === setorAtualId) {
      toast.warning(t('sectorSwitch.selectDifferent'))
      return
    }

    if (!senha.trim()) {
      toast.warning(t('sectorSwitch.passwordRequired'))
      return
    }

    const setor = obterSetorEmpresarial(setorId)
    const senhaHashSalva = obterHashSenhaSetor(empresa, setorId)

    if (!setor || !senhaHashSalva) {
      toast.error(t('sectorSwitch.notConfigured'))
      return
    }

    try {
      setLoading(true)
      const senhaHashDigitada = await hashSenhaSetor(senha, getFirebaseUid(empresa))

      if (senhaHashDigitada !== senhaHashSalva) {
        toast.error(t('sectorSwitch.incorrectPassword'))
        setLoading(false)
        return
      }

      const perfilAtualizado = {
        ...empresa,
        setorEmpresarial: {
          id: setor.id,
          nome: setor.nome,
          acessadoEm: new Date().toISOString()
        }
      }

      setLoading(false)
      onSuccess(perfilAtualizado, setor)
    } catch {
      setLoading(false)
      toast.error(t('sectorSwitch.failed'))
    }
  }

  return createPortal(
    <div
      className="sector-switch-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onClose()
      }}
    >
      <section
        className="sector-switch-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sector-switch-title"
        aria-describedby="sector-switch-description"
        aria-busy={loading}
      >
        <button
          type="button"
          className="sector-switch-close"
          onClick={onClose}
          aria-label={t('sectorSwitch.close')}
          disabled={loading}
        >
          <FaTimes />
        </button>

        <header>
          <span><FaBuilding /></span>
          <div>
            <small>{t('sectorSwitch.eyebrow')}</small>
            <h2 id="sector-switch-title">{t('sectorSwitch.title')}</h2>
          </div>
        </header>

        <p id="sector-switch-description">
          {t('sectorSwitch.description')}
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="sector-switch-select">
            {t('sectorSwitch.sector')}
            <select
              ref={selectRef}
              id="sector-switch-select"
              value={setorId}
              onChange={(event) => setSetorId(event.target.value)}
              disabled={loading}
            >
              {setoresEmpresariais.map((setor) => (
                <option
                  key={setor.id}
                  value={setor.id}
                  disabled={setor.id === setorAtualId}
                >
                  {t(`auth:sectors.${setor.id}`, { defaultValue: setor.nome })}
                  {setor.id === setorAtualId ? ` (${t('sectorSwitch.current')})` : ''}
                </option>
              ))}
            </select>
          </label>

          <label htmlFor="sector-switch-password">
            {t('sectorSwitch.password')}
            <span className="sector-switch-password">
              <FaLock aria-hidden="true" />
              <input
                id="sector-switch-password"
                type={mostrarSenha ? 'text' : 'password'}
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                placeholder={t('sectorSwitch.passwordPlaceholder')}
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((current) => !current)}
                aria-label={mostrarSenha ? t('sectorSwitch.hidePassword') : t('sectorSwitch.showPassword')}
                disabled={loading}
              >
                {mostrarSenha ? <FaEyeSlash /> : <FaEye />}
              </button>
            </span>
          </label>

          <div className="sector-switch-actions">
            <button type="button" onClick={onClose} disabled={loading}>{t('sectorSwitch.cancel')}</button>
            <button type="submit" disabled={loading || !setorId}>
              {loading ? t('sectorSwitch.validating') : t('sectorSwitch.title')}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body
  )
}

export default ModalAlterarSetor
