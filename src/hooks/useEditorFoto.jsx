import { useCallback, useEffect, useRef, useState } from 'react'
import EditorFoto from '../components/ui/EditorFoto'
import { validarFotoPerfil } from '../services/storageFotosPerfil'

export function useEditorFoto() {
  const [arquivo, setArquivo] = useState(null)
  const pending = useRef(null)
  useEffect(() => () => pending.current?.(null), [])
  const editarFoto = useCallback((file) => {
    validarFotoPerfil(file)
    pending.current?.(null)
    setArquivo(file)
    return new Promise((resolve) => { pending.current = resolve })
  }, [])
  const finish = useCallback((file) => {
    pending.current?.(file)
    pending.current = null
    setArquivo(null)
  }, [])
  return { editarFoto, editorFoto: arquivo ? <EditorFoto key={arquivo.name + arquivo.lastModified} arquivo={arquivo} onFinish={finish} /> : null }
}
