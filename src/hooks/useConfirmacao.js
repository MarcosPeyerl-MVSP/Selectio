import { useContext } from 'react'

import { ContextoConfirmacao } from '../components/ui/contextoConfirmacao'

export function useConfirmacao() {
  const context = useContext(ContextoConfirmacao)

  if (!context) {
    throw new Error('useConfirmacao deve ser usado dentro de ProvedorConfirmacao.')
  }

  return context.confirm
}
