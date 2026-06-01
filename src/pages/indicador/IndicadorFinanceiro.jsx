import './styles/IndicadorFinanceiro.css'

import { useEffect, useMemo, useState } from 'react'
import { FaMoneyBillWave, FaWallet } from 'react-icons/fa'

import BalanceCard from '../../components/payments/BalanceCard'
import PageLoader from '../../components/ui/PageLoader'
import { useConfirm } from '../../hooks/useConfirm'
import { useToast } from '../../hooks/useToast'
import { getFirebaseUid } from '../../services/firebaseIdentity'
import {
  buscarSaldoIndicador,
  listarMovimentacoesIndicador,
  solicitarSaqueIndicador
} from '../../services/firestorePagamentos'
import { listarNotificacoesUsuario } from '../../services/firestoreNotificacoes'

function IndicadorFinanceiro({ user }) {
  const toast = useToast()
  const confirm = useConfirm()
  const indicadorId = getFirebaseUid(user)
  const [saldo, setSaldo] = useState(null)
  const [movimentacoes, setMovimentacoes] = useState([])
  const [notificacoes, setNotificacoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [valor, setValor] = useState('')
  const [chavePix, setChavePix] = useState(user?.pix || '')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let ativo = true

    const carregarFinanceiro = async () => {
      if (!indicadorId) {
        setCarregando(false)
        return
      }

      try {
        const [saldoData, movimentacoesData, notificacoesData] = await Promise.all([
          buscarSaldoIndicador(indicadorId),
          listarMovimentacoesIndicador(indicadorId),
          listarNotificacoesUsuario(indicadorId)
        ])

        if (!ativo) return

        setSaldo(saldoData)
        setMovimentacoes(movimentacoesData)
        setNotificacoes(notificacoesData.filter((notificacao) => notificacao.tipo === 'pagamento_aprovado'))
      } catch (error) {
        toast.error(error.message || 'Não foi possível carregar o financeiro.')
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregarFinanceiro()

    return () => {
      ativo = false
    }
  }, [indicadorId, toast])

  const notificacoesRecentes = useMemo(() => notificacoes.slice(0, 4), [notificacoes])

  const enviarSaque = async (event) => {
    event.preventDefault()

    const valorNumerico = Number(String(valor).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'))

    if (!valorNumerico || valorNumerico <= 0) {
      toast.warning('Informe um valor válido para saque.')
      return
    }

    if (valorNumerico > Number(saldo?.saldoDisponivel || 0)) {
      toast.warning('Valor maior que o saldo disponível.')
      return
    }

    if (!chavePix.trim()) {
      toast.warning('Informe uma chave Pix.')
      return
    }

    const confirmado = await confirm({
      title: 'Solicitar saque?',
      description: 'A equipe Selectio fará a validação manual desta solicitação.',
      confirmLabel: 'Solicitar saque',
      cancelLabel: 'Voltar'
    })

    if (!confirmado) return

    setEnviando(true)

    try {
      await solicitarSaqueIndicador({
        indicadorId,
        valor: valorNumerico,
        chavePix
      })

      setSaldo((saldoAtual) => ({
        ...saldoAtual,
        saldoDisponivel: Number(saldoAtual?.saldoDisponivel || 0) - valorNumerico,
        saldoPendente: Number(saldoAtual?.saldoPendente || 0) + valorNumerico
      }))
      setModalAberto(false)
      setValor('')
      toast.success('Solicitação de saque enviada. A equipe Selectio fará a validação.')
    } catch (error) {
      toast.error(error.message || 'Não foi possível solicitar o saque.')
    } finally {
      setEnviando(false)
    }
  }

  if (carregando) return <PageLoader label="Carregando financeiro..." compact />

  return (
    <section className="indicador-financeiro">
      <header className="indicador-financeiro-header">
        <div>
          <span>Carteira Selectio</span>
          <h1>Financeiro</h1>
          <p>Acompanhe recompensas recebidas, saldo disponível e solicitações de saque.</p>
        </div>

        <button type="button" onClick={() => setModalAberto(true)} disabled={!Number(saldo?.saldoDisponivel || 0)}>
          <FaWallet /> Solicitar saque
        </button>
      </header>

      <section className="indicador-saldo-grid">
        <BalanceCard label="Saldo disponível" value={saldo?.saldoDisponivel} helper="Pode ser solicitado para saque manual." tone="primary" />
        <BalanceCard label="Saldo pendente" value={saldo?.saldoPendente} helper="Valores em validação de saque." />
        <BalanceCard label="Total recebido" value={saldo?.totalRecebido} helper="Recompensas aprovadas por contratação." />
        <BalanceCard label="Total sacado" value={saldo?.totalSacado} helper="Soma de saques pagos futuramente." />
      </section>

      <div className="indicador-financeiro-grid">
        <article className="indicador-financeiro-card">
          <div className="indicador-financeiro-card-title">
            <span><FaMoneyBillWave /> Movimentações</span>
            <strong>{movimentacoes.length}</strong>
          </div>

          {movimentacoes.length ? (
            movimentacoes.map((movimentacao) => (
              <div className="indicador-movimentacao-item" key={movimentacao.id}>
                <div>
                  <strong>{rotuloMovimentacao(movimentacao.tipo)}</strong>
                  <span>{movimentacao.descricao || 'Movimentação financeira'}</span>
                </div>
                <strong>{formatCurrency(movimentacao.valor)}</strong>
              </div>
            ))
          ) : (
            <EstadoVazio title="Sem movimentações" description="Pagamentos aprovados e saques solicitados aparecem aqui." />
          )}
        </article>

        <article className="indicador-financeiro-card">
          <div className="indicador-financeiro-card-title">
            <span>Pagamentos recebidos</span>
            <strong>{notificacoesRecentes.length}</strong>
          </div>

          {notificacoesRecentes.length ? (
            notificacoesRecentes.map((notificacao) => (
              <div className="indicador-notificacao-financeira" key={notificacao.id}>
                <strong>{notificacao.titulo}</strong>
                <p>{notificacao.mensagem}</p>
              </div>
            ))
          ) : (
            <EstadoVazio title="Nenhum pagamento recebido" description="Quando uma recompensa for aprovada, você será avisado aqui." />
          )}
        </article>
      </div>

      {modalAberto && (
        <div className="saque-modal-backdrop" role="presentation" onMouseDown={() => setModalAberto(false)}>
          <section className="saque-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <span>Solicitação manual</span>
              <h2>Solicitar saque</h2>
              <p>O valor sai do saldo disponível e fica pendente até a validação da equipe Selectio.</p>
            </header>

            <form onSubmit={enviarSaque}>
              <label>
                Valor
                <input value={valor} onChange={(event) => setValor(event.target.value)} placeholder="Ex: 500" inputMode="decimal" />
              </label>

              <label>
                Chave Pix
                <input value={chavePix} onChange={(event) => setChavePix(event.target.value)} placeholder="CPF, e-mail, telefone ou chave aleatória" />
              </label>

              <div className="saque-modal-actions">
                <button type="button" className="secondary" onClick={() => setModalAberto(false)}>
                  Cancelar
                </button>
                <button type="submit" disabled={enviando}>
                  {enviando ? 'Enviando...' : 'Solicitar saque'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  )
}

function EstadoVazio({ title, description }) {
  return (
    <div className="indicador-financeiro-vazio">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  )
}

function rotuloMovimentacao(tipo) {
  const labels = {
    credito_recompensa: 'Crédito de recompensa',
    saque_solicitado: 'Saque solicitado',
    saque_aprovado: 'Saque aprovado',
    saque_recusado: 'Saque recusado',
    estorno: 'Estorno'
  }

  return labels[tipo] || 'Movimentação'
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

export default IndicadorFinanceiro
