import { useEditorFoto } from '../../hooks/useEditorFoto'
import './SeletorFotoCandidato.css'

import { useEffect, useMemo } from 'react'
import { FaCamera, FaTrash } from 'react-icons/fa'
import { useTranslation } from 'react-i18next'


import AvatarProtegido from './AvatarProtegido'

function SeletorFotoCandidato({ fotoAtual, arquivo, nome, onChange, onRemove, onError }) {
  const { t } = useTranslation('common')
  const { editarFoto, editorFoto } = useEditorFoto()
  const fallback = String(nome || '?').trim().charAt(0).toUpperCase() || '?'
  const preview = useMemo(() => arquivo ? URL.createObjectURL(arquivo) : '', [arquivo])

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const handleFile = async (event) => {
    const selected = event.target.files?.[0]
    event.target.value = ''
    if (!selected) return
    try {
      const edited = await editarFoto(selected)
      if (edited) onChange(edited)
    } catch (error) {
      onError?.(error.message)
    }
  }

  return (
    <div className="candidate-photo-picker">
      {editorFoto}
      {preview ? (
        <img className="candidate-photo-picker-avatar" src={preview} alt={nome || t('profilePhoto.candidate')} />
      ) : (
        <AvatarProtegido className="candidate-photo-picker-avatar" foto={fotoAtual} alt={nome || t('profilePhoto.candidate')} fallback={fallback} />
      )}
      <div>
        <strong>{t('profilePhoto.candidate')}</strong>
        <small>{t('profilePhoto.help')}</small>
      </div>
      <label>
        <FaCamera /> {arquivo || fotoAtual?.caminho ? t('profilePhoto.change') : t('profilePhoto.choose')}
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} />
      </label>
      {(arquivo || fotoAtual?.caminho) && (
        <button type="button" onClick={onRemove} aria-label={t('profilePhoto.remove')}><FaTrash /></button>
      )}
    </div>
  )
}

export default SeletorFotoCandidato
