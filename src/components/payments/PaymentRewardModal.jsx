import './PaymentRewardModal.css'

import { useMemo, useState } from 'react'
import { FaCreditCard, FaExternalLinkAlt, FaTimes } from 'react-icons/fa'

import { useConfirm } from '../../hooks/useConfirm'
import { useToast } from '../../hooks/useToast'
import { criarPagamentoRecompensa } from '../../services/firestorePagamentos'
import { getFirebaseUid } from '../../services/firebaseIdentity'

function PaymentRewardModal({ candidato, empresa, pagamentoExistente, onClose, onCreated }) {
  const toast = useToast()
  const confirm = useConfirm()
  const empresaId = getFirebaseUid(empresa)
  const valorInicial = useMemo(() => obterValorRecompensa(candidato), [candidato])
  const [valor, setValor] = useState(valorInicial ? String(valorInicial) : '')
  const [carregando, setCarregando] = useState(false)

  if (!candidato) return null

  const statusPagamento = pagamentoExistente?.status
  const checkoutUrl = pagamentoExistente?.sandboxCheckoutUrl || pagamentoExistente?.checkoutUrl
  const recompensaPaga = statusPagamento === 'approved'
  const pagamentoPendente = statusPagamento === 'pending' && checkoutUrl

  const abrirCheckoutExistente = () => {
    if (checkoutUrl) window.location.href = checkoutUrl
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const valorNumerico = normalizarValor(valor)

    if (!valorNumerico) {
      toast.warning('Informe um valor valido para a recompensa.')
      return
    }

    const confirmado = await confirm({
      title: 'Pagar recompensa?',
      description: `Voce sera redirecionado para o Mercado Pago para pagar ${formatCurrency(valorNumerico)}.`,
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
        valor: valorNumerico,
        descricao: `Recompensa Selectio - ${candidato.vagaTitulo || 'Vaga'} - ${candidato.nome || 'Candidato'}`
      })

      onCreated?.(pagamento)

      const url = pagamento.sandboxInitPoint || pagamento.initPoint
      if (url) {
        window.location.href = url
        return
      }

      toast.success('Preferencia de pagamento criada.')
      onClose()
    } catch (error) {
      toast.error(error.message || 'Nao foi possivel criar o pagamento.')
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
          <p>O pagamento vai para a conta Selectio. Depois da aprovacao, o saldo do indicador e creditado internamente.</p>
        </header>

        <div className="payment-summary">
          <div>
            <span>Candidato</span>
            <strong>{candidato.nome || 'Nao informado'}</strong>
          </div>
          <div>
            <span>Vaga</span>
            <strong>{candidato.vagaTitulo || 'Nao informada'}</strong>
          </div>
          <div>
            <span>Indicador</span>
            <strong>{candidato.indicadorNome || 'Nao informado'}</strong>
          </div>
        </div>

        {recompensaPaga ? (
          <div className="payment-state approved">
            <strong>Recompensa paga</strong>
            <p>Este candidato ja possui pagamento aprovado.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="payment-field">
              Valor da recompensa
              <input
                value={valor}
                onChange={(event) => setValor(event.target.value)}
                inputMode="decimal"
                placeholder="Ex: 2500"
                disabled={Boolean(pagamentoPendente)}
              />
            </label>

            {pagamentoPendente && (
              <div className="payment-state pending">
                <strong>Pagamento pendente</strong>
                <p>Continue o checkout ja criado para esta recompensa.</p>
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

export default PaymentRewardModal
