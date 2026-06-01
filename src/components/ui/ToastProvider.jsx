import './ToastProvider.css'

import { useCallback, useMemo, useState } from 'react'
import { FaCheckCircle, FaExclamationTriangle, FaInfoCircle, FaTimes } from 'react-icons/fa'

import { ToastContext } from './toastContext'

const iconByType = {
  success: FaCheckCircle,
  error: FaExclamationTriangle,
  warning: FaExclamationTriangle,
  info: FaInfoCircle
}

const titleByType = {
  success: 'Sucesso',
  error: 'Erro',
  warning: 'Atenção',
  info: 'Aviso'
}

const defaultDuration = 4200

function normalizeToast(input, type) {
  if (typeof input === 'string') {
    return {
      type,
      title: titleByType[type],
      message: input
    }
  }

  return {
    type,
    title: input?.title || titleByType[type],
    message: input?.message || '',
    duration: input?.duration
  }
}

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id))
  }, [])

  const addToast = useCallback((toastInput, type = 'info') => {
    const toast = {
      ...normalizeToast(toastInput, type),
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`
    }

    setToasts((currentToasts) => [...currentToasts, toast])

    const duration = toast.duration ?? defaultDuration
    if (duration > 0) {
      window.setTimeout(() => dismiss(toast.id), duration)
    }

    return toast.id
  }, [dismiss])

  const value = useMemo(() => ({
    show: addToast,
    success: (toast) => addToast(toast, 'success'),
    error: (toast) => addToast(toast, 'error'),
    warning: (toast) => addToast(toast, 'warning'),
    info: (toast) => addToast(toast, 'info'),
    dismiss
  }), [addToast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="toast-viewport" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function Toast({ toast, onDismiss }) {
  const Icon = iconByType[toast.type] || FaInfoCircle

  return (
    <section className={`toast-card ${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
      <div className="toast-icon">
        <Icon />
      </div>

      <div className="toast-copy">
        <strong>{toast.title}</strong>
        {toast.message && <p>{toast.message}</p>}
      </div>

      <button type="button" onClick={onDismiss} aria-label="Fechar notificação">
        <FaTimes />
      </button>
    </section>
  )
}

export default ToastProvider
