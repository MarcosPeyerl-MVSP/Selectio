import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import './EditorFoto.css'

export default function EditorFoto({ arquivo, onFinish }) {
  const { t } = useTranslation('common')
  const titleId = useId()
  const dialog = useRef(null)
  const imagem = useRef(null)
  const drag = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [ready, setReady] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 50, y: 50 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    const url = URL.createObjectURL(arquivo)
    imagem.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [arquivo])

  useEffect(() => {
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.focus()
    return () => {
      document.body.style.overflow = overflow
      if (previous?.isConnected) previous.focus()
    }
  }, [])

  const handleKey = (event) => {
    event.stopPropagation()
    if (event.key === 'Escape' && !busy) onFinish(null)
    if (event.key !== 'Tab') return
    const elements = [...dialog.current.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex="0"]')]
    const first = elements[0]
    const last = elements.at(-1)
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) {
      event.preventDefault()
      first?.focus()
    }
  }

  const moveImage = (element, dx, dy) => {
    const img = imagem.current
    const side = Math.min(img.naturalWidth, img.naturalHeight) / zoom
    const scale = element.getBoundingClientRect().width / side
    const overflowX = (img.naturalWidth - side) * scale
    const overflowY = (img.naturalHeight - side) * scale
    const clamp = (value) => Math.max(0, Math.min(100, value))
    setPosition((current) => ({
      x: overflowX > 0 ? clamp(current.x - dx / overflowX * 100) : current.x,
      y: overflowY > 0 ? clamp(current.y - dy / overflowY * 100) : current.y
    }))
  }

  const startDrag = (event) => {
    if (!ready || busy || event.button !== 0 || drag.current) return
    event.preventDefault()
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
    setDragging(true)
  }

  const moveDrag = (event) => {
    const previous = drag.current
    if (!previous || previous.id !== event.pointerId || busy) return
    moveImage(event.currentTarget, event.clientX - previous.x, event.clientY - previous.y)
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
  }

  const endDrag = (event) => {
    if (drag.current?.id !== event.pointerId) return
    drag.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const moveWithKeyboard = (event) => {
    const directions = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }
    if (!ready || busy || !directions[event.key]) return
    event.preventDefault()
    moveImage(event.currentTarget, ...directions[event.key])
  }

  const confirm = async () => {
    setBusy(true)
    setError(false)
    try {
      const img = imagem.current
      const side = Math.min(img.naturalWidth, img.naturalHeight) / zoom
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 512
      const context = canvas.getContext('2d')
      context.drawImage(img, (img.naturalWidth - side) * position.x / 100,
        (img.naturalHeight - side) * position.y / 100, side, side, 0, 0, 512, 512)
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('Image export failed')
      onFinish(new File([blob], `${arquivo.name.replace(/\.[^.]+$/, '')}-perfil.png`, { type: 'image/png' }))
    } catch {
      setError(true)
      setBusy(false)
    }
  }

  return createPortal(
    <div className="photo-editor-backdrop" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} onKeyDown={handleKey}>
      <section className="photo-editor" ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={busy}>
        <h2 id={titleId}>{t('photoEditor.title')}</h2>
        <p id={`${titleId}-help`}>{t('photoEditor.help')}</p>
        <div className={`photo-editor-preview${dragging ? ' is-dragging' : ''}`}
          tabIndex={ready && !busy ? 0 : -1} role="group"
          aria-label={t('photoEditor.preview')} aria-describedby={`${titleId}-help`}
          onPointerDown={startDrag} onPointerMove={moveDrag}
          onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}
          onKeyDown={moveWithKeyboard}>
          <img ref={imagem} alt={t('photoEditor.preview')} draggable={false}
            onLoad={() => setReady(true)} onError={() => { setError(true); setReady(false) }}
            style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%`, maxWidth: 'none',
              left: `${(1 - zoom) * position.x}%`, top: `${(1 - zoom) * position.y}%`,
              objectPosition: `${position.x}% ${position.y}%` }} />
        </div>
        <label className="photo-editor-control">
          <span>{t('photoEditor.zoom')} <output>{Math.round(zoom * 100)}%</output></span>
          <input type="range" min="1" max="3" step="0.05" value={zoom} disabled={!ready || busy} onChange={(e) => setZoom(Number(e.target.value))} />
        </label>
        {error && <p role="alert" className="photo-editor-error">{t('photoEditor.error')}</p>}
        <div className="photo-editor-actions">
          <button type="button" disabled={busy} onClick={() => onFinish(null)}>{t('photoEditor.cancel')}</button>
          <button type="button" className="photo-editor-confirm" disabled={!ready || busy} onClick={confirm}>{t(busy ? 'photoEditor.preparing' : 'photoEditor.confirm')}</button>
        </div>
      </section>
    </div>, document.body
  )
}
