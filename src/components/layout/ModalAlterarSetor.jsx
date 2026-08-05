import './ModalAlterarSetor.css'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FaBuilding, FaEye, FaEyeSlash, FaLock, FaTimes } from 'react-icons/fa'

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
      toast.warning('Selecione um setor diferente do atual.')
      return
    }

    if (!senha.trim()) {
      toast.warning('Informe a senha do setor selecionado.')
      return
    }

    const setor = obterSetorEmpresarial(setorId)
    const senhaHashSalva = obterHashSenhaSetor(empresa, setorId)

    if (!setor || !senhaHashSalva) {
      toast.error('O acesso deste setor ainda não está configurado.')
      return
    }

    try {
      setLoading(true)
      const senhaHashDigitada = await hashSenhaSetor(senha, getFirebaseUid(empresa))

      if (senhaHashDigitada !== senhaHashSalva) {
        toast.error('Senha do setor incorreta.')
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
      toast.error('Não foi possível alterar o setor. Tente novamente.')
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
          aria-label="Fechar alteração de setor"
          disabled={loading}
        >
          <FaTimes />
        </button>

        <header>
          <span><FaBuilding /></span>
          <div>
            <small>ACESSO EMPRESARIAL</small>
            <h2 id="sector-switch-title">Alterar setor</h2>
          </div>
        </header>

        <p id="sector-switch-description">
          Escolha o novo setor e informe a senha de acesso correspondente.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="sector-switch-select">
            Setor
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
                  {setor.nome}{setor.id === setorAtualId ? ' (atual)' : ''}
                </option>
              ))}
            </select>
          </label>

          <label htmlFor="sector-switch-password">
            Senha do setor
            <span className="sector-switch-password">
              <FaLock aria-hidden="true" />
              <input
                id="sector-switch-password"
                type={mostrarSenha ? 'text' : 'password'}
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                placeholder="Digite a senha do setor"
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((current) => !current)}
                aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                disabled={loading}
              >
                {mostrarSenha ? <FaEyeSlash /> : <FaEye />}
              </button>
            </span>
          </label>

          <div className="sector-switch-actions">
            <button type="button" onClick={onClose} disabled={loading}>Cancelar</button>
            <button type="submit" disabled={loading || !setorId}>
              {loading ? 'Validando...' : 'Alterar setor'}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body
  )
}

export default ModalAlterarSetor
