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
  const recompensaFixa = useMemo(() => obterRecompensaFixa(candidato), [candidato])
  const valorRecompensa = recompensaFixa.valor
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

    if (!recompensaFixa.disponivel) {
      toast.warning('Esta vaga não possui recompensa fixa. Defina um valor fixo para liberar pagamento automático.')
      return
    }

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
        candidatoNome: candidato.nome || '',
        indicacaoId: candidato.indicacaoId || '',
        vagaId: candidato.vagaId || '',
        vagaTitulo: candidato.vagaTitulo || '',
        indicadorId: candidato.indicadorId || candidato.indicadorUid || '',
        indicadorNome: candidato.indicadorNome || '',
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
          <p>O checkout é criado pelo backend local da Selectio. Depois da aprovação, o saldo do indicador é creditado internamente.</p>
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
                value={recompensaFixa.disponivel
                  ? valorRecompensa ? formatCurrency(valorRecompensa) : 'Validado pela vaga no Firestore'
                  : 'Recompensa fixa não definida'}
                readOnly
                disabled={Boolean(pagamentoPendente)}
              />
            </label>

            {!recompensaFixa.disponivel && (
              <div className="payment-state blocked">
                <strong>Recompensa fixa obrigatória</strong>
                <p>Esta vaga não possui recompensa fixa. Defina um valor fixo para liberar pagamento automático.</p>
              </div>
            )}

            {recompensaFixa.disponivel && !valorRecompensa && (
              <div className="payment-state pending">
                <strong>Valor pendente de validação</strong>
                <p>O backend local vai buscar a recompensa cadastrada na vaga antes de criar o checkout.</p>
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
                <button type="submit" disabled={carregando || !recompensaFixa.disponivel}>
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

function obterRecompensaFixa(candidato) {
  const tipo = String(candidato?.recompensaTipo || '').toLowerCase()

  if (tipo && tipo !== 'fixo') {
    return { disponivel: false, valor: 0 }
  }

  if (Number(candidato?.recompensaValorFixo || 0) > 0) {
    return { disponivel: true, valor: Number(candidato.recompensaValorFixo) }
  }

  const texto = String(candidato?.recompensa || '').trim()

  if (
    !texto
    || /%|percent|sal[aá]rio|combinar|consultar|a definir|sob consulta/i.test(texto)
    || !/^(r\$\s*)?\d[\d.\s]*(,\d{1,2})?$/i.test(texto)
  ) {
    return { disponivel: false, valor: 0 }
  }

  return { disponivel: true, valor: normalizarValor(texto) }
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
