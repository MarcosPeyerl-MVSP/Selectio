import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import './EditorFoto.css'

export default function EditorFoto({ arquivo, onFinish }) {
  const { t } = useTranslation('common')
  const titleId = useId()
  const dialog = useRef(null)
  const imagem = useRef(null)
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
    const elements = [...dialog.current.querySelectorAll('button:not(:disabled), input:not(:disabled)')]
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
        <p>{t('photoEditor.help')}</p>
        <div className="photo-editor-preview">
          <img ref={imagem} alt={t('photoEditor.preview')}
            onLoad={() => setReady(true)} onError={() => { setError(true); setReady(false) }}
            style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%`, maxWidth: 'none',
              left: `${(1 - zoom) * position.x}%`, top: `${(1 - zoom) * position.y}%`,
              objectPosition: `${position.x}% ${position.y}%` }} />
        </div>
        <label className="photo-editor-control">
          <span>{t('photoEditor.zoom')} <output>{Math.round(zoom * 100)}%</output></span>
          <input type="range" min="1" max="3" step="0.05" value={zoom} disabled={!ready || busy} onChange={(e) => setZoom(Number(e.target.value))} />
        </label>
        {['x', 'y'].map((axis) => (
          <label className="photo-editor-control" key={axis}>
            <span>{t(`photoEditor.${axis}`)}</span>
            <input type="range" min="0" max="100" value={position[axis]} disabled={!ready || busy}
              onChange={(e) => setPosition((current) => ({ ...current, [axis]: Number(e.target.value) }))} />
          </label>
        ))}
        {error && <p role="alert" className="photo-editor-error">{t('photoEditor.error')}</p>}
        <div className="photo-editor-actions">
          <button type="button" disabled={busy} onClick={() => onFinish(null)}>{t('photoEditor.cancel')}</button>
          <button type="button" className="photo-editor-confirm" disabled={!ready || busy} onClick={confirm}>{t(busy ? 'photoEditor.preparing' : 'photoEditor.confirm')}</button>
        </div>
      </section>
    </div>, document.body
  )
}
