import './ModalPagamentoRecompensa.css'

import { useMemo, useState } from 'react'
import { FaCreditCard, FaExternalLinkAlt, FaTimes } from 'react-icons/fa'

import { useConfirmacao } from '../../hooks/useConfirmacao'
import { useToast } from '../../hooks/useToast'
import {
  criarPagamentoRecompensa,
  obterCheckoutUrlPagamento
} from '../../services/firestorePagamentos'
import { getFirebaseUid } from '../../services/identidadeFirebase'

function ModalPagamentoRecompensa({ candidato, empresa, pagamentoExistente, onClose, onCreated }) {
  const toast = useToast()
  const confirm = useConfirmacao()
  const empresaId = getFirebaseUid(empresa)
  const valorRecompensa = useMemo(() => obterValorRecompensa(candidato), [candidato])
  const [carregando, setCarregando] = useState(false)

  if (!candidato) return null

  const statusPagamento = pagamentoExistente?.status
  const checkoutUrl = obterCheckoutUrlPagamento(pagamentoExistente)
  const recompensaPaga = statusPagamento === 'approved'
  const pagamentoPendente = statusPagamento === 'pending' && checkoutUrl

  const abrirCheckoutExistente = () => {
    if (checkoutUrl) abrirCheckout(checkoutUrl, toast)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const confirmado = await confirm({
      title: 'Pagar recompensa?',
      description: valorRecompensa
        ? `Você será redirecionado para o Mercado Pago para pagar ${formatCurrency(valorRecompensa)}.`
        : 'A recompensa será validada pela vaga no Firestore antes de abrir o checkout.',
      confirmLabel: 'Ir para pagamento',
      cancelLabel: 'Voltar',
      tone: 'danger'
    })

    if (!confirmado) return

    setCarregando(true)

    try {
      const pagamento = await criarPagamentoRecompensa({
        empresaId,
        candidatoId: candidato.id,
        indicacaoId: candidato.indicacaoId || '',
        vagaId: candidato.vagaId || '',
        indicadorId: candidato.indicadorId || candidato.indicadorUid || '',
        valor: valorRecompensa,
        descricao: `Recompensa Selectio - ${candidato.vagaTitulo || 'Vaga'} - ${candidato.nome || 'Candidato'}`
      })

      onCreated?.(pagamento)

      const url = pagamento.sandboxInitPoint || pagamento.checkoutUrl || pagamento.initPoint
      if (url) {
        if (url.includes('sandbox.mercadopago')) {
          toast.success('Preferência sandbox criada. Clique em Continuar checkout para pagar.')
          return
        }

        abrirCheckout(url, toast)
        onClose()
        return
      }

      toast.success('Preferência de pagamento criada.')
      onClose()
    } catch (error) {
      toast.error(error.message || 'Não foi possível criar o pagamento.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="payment-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="payment-reward-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-reward-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="payment-modal-close" onClick={onClose} aria-label="Fechar pagamento">
          <FaTimes />
        </button>

        <header>
          <span><FaCreditCard /> Mercado Pago</span>
          <h2 id="payment-reward-title">Pagar recompensa</h2>
          <p>O pagamento vai para a conta Selectio. Depois da aprovação, o saldo do indicador é creditado internamente.</p>
        </header>

        <div className="payment-summary">
          <div>
            <span>Candidato</span>
            <strong>{candidato.nome || 'Não informado'}</strong>
          </div>
          <div>
            <span>Vaga</span>
            <strong>{candidato.vagaTitulo || 'Não informada'}</strong>
          </div>
          <div>
            <span>Indicador</span>
            <strong>{candidato.indicadorNome || 'Não informado'}</strong>
          </div>
        </div>

        {recompensaPaga ? (
          <div className="payment-state approved">
            <strong>Recompensa paga</strong>
            <p>Este candidato já possui pagamento aprovado.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="payment-field">
              Valor da recompensa
              <input
                value={valorRecompensa ? formatCurrency(valorRecompensa) : 'Validado pela vaga no Firestore'}
                readOnly
                disabled={Boolean(pagamentoPendente)}
              />
            </label>

            {!valorRecompensa && (
              <div className="payment-state pending">
                <strong>Valor pendente de validação</strong>
                <p>A Cloud Function vai buscar a recompensa cadastrada na vaga antes de criar o checkout.</p>
              </div>
            )}

            {pagamentoPendente && (
              <div className="payment-state pending">
                <strong>Pagamento pendente</strong>
                <p>Continue o checkout já criado para esta recompensa.</p>
              </div>
            )}

            <div className="payment-actions">
              <button type="button" className="secondary" onClick={onClose}>
                Cancelar
              </button>

              {pagamentoPendente ? (
                <button type="button" onClick={abrirCheckoutExistente}>
                  <FaExternalLinkAlt /> Continuar checkout
                </button>
              ) : (
                <button type="submit" disabled={carregando}>
                  {carregando ? 'Criando...' : 'Pagar recompensa'}
                </button>
              )}
            </div>
          </form>
        )}
      </section>
    </div>
  )
}

function abrirCheckout(url, toast) {
  if (url.includes('sandbox.mercadopago')) {
    const checkout = window.open(url, '_blank')

    if (!checkout) {
      window.location.href = url
      return
    }

    checkout.opener = null
    toast.info('Checkout sandbox aberto em outra aba. Ao finalizar, volte ao Selectio para atualizar o status.')
    return
  }

  window.location.href = url
}

function obterValorRecompensa(candidato) {
  if (Number(candidato?.recompensaValor || 0) > 0) return Number(candidato.recompensaValor)
  return normalizarValor(candidato?.recompensa)
}

function normalizarValor(valor) {
  const normalizado = String(valor || '')
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')

  const numero = Number(normalizado)
  return Number.isFinite(numero) && numero > 0 ? Number(numero.toFixed(2)) : 0
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

export default ModalPagamentoRecompensa
