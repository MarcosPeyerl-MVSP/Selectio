import './DialogoConfirmacao.css'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FaExclamationTriangle, FaTimes } from 'react-icons/fa'

import { ContextoConfirmacao } from './contextoConfirmacao'

const defaultOptions = {
  title: 'Confirmar ação',
  description: 'Tem certeza de que deseja continuar?',
  confirmLabel: 'Confirmar',
  cancelLabel: 'Cancelar',
  tone: 'danger'
}

export function ProvedorConfirmacao({ children }) {
  const [dialog, setDialog] = useState(null)
  const resolverRef = useRef(null)

  const close = useCallback((result) => {
    setDialog(null)
    resolverRef.current?.(result)
    resolverRef.current = null
  }, [])

  const confirm = useCallback((options = {}) => {
    setDialog({ ...defaultOptions, ...options })

    return new Promise((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const value = useMemo(() => ({ confirm }), [confirm])

  return (
    <ContextoConfirmacao.Provider value={value}>
      {children}
      {dialog && <DialogoConfirmacao options={dialog} onCancel={() => close(false)} onConfirm={() => close(true)} />}
    </ContextoConfirmacao.Provider>
  )
}

function DialogoConfirmacao({ options, onCancel, onConfirm }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onCancel()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return (
    <div className="confirm-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className={`confirm-dialog ${options.tone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="confirm-close" onClick={onCancel} aria-label="Fechar confirmação">
          <FaTimes />
        </button>

        <div className="confirm-icon">
          <FaExclamationTriangle />
        </div>

        <div>
          <h2 id="confirm-title">{options.title}</h2>
          <p id="confirm-description">{options.description}</p>
        </div>

        <div className="confirm-actions">
          <button type="button" className="confirm-cancel" onClick={onCancel}>
            {options.cancelLabel}
          </button>
          <button type="button" className="confirm-submit" onClick={onConfirm} autoFocus>
            {options.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}

export default DialogoConfirmacao
