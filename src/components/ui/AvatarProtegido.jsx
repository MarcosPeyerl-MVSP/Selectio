import './AvatarProtegido.css'

import { useEffect, useState } from 'react'

import { baixarBlobFotoPerfil } from '../../services/storageFotosPerfil'

function AvatarProtegido({ foto, alt = '', fallback = '?', className = '' }) {
  const [imagem, setImagem] = useState({ caminho: '', url: '' })
  const caminho = foto?.caminho || ''
  const status = foto?.status || ''

  useEffect(() => {
    let ativo = true
    let objectUrl = ''

    baixarBlobFotoPerfil({ caminho, status })
      .then((blob) => {
        if (!ativo || !blob) return
        objectUrl = URL.createObjectURL(blob)
        setImagem({ caminho, url: objectUrl })
      })
      .catch(() => {})

    return () => {
      ativo = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [caminho, status])

  if (imagem.caminho === caminho && imagem.url) {
    return <img className={className} src={imagem.url} alt={alt} />
  }

  return (
    <span className={`avatar-protegido-fallback ${className}`.trim()} aria-label={alt}>
      {fallback}
    </span>
  )
}

export default AvatarProtegido
