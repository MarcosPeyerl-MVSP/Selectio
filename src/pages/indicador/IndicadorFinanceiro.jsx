import './styles/IndicadorFinanceiro.css'

import { useEffect, useMemo, useState } from 'react'
import { FaCreditCard, FaMoneyBillWave, FaReceipt, FaWallet } from 'react-icons/fa'

import CardSaldo from '../../components/pagamentos/CardSaldo'
import PageLoader from '../../components/ui/PageLoader'
import { useConfirmacao } from '../../hooks/useConfirmacao'
import { useToast } from '../../hooks/useToast'
import { listarCandidatosPorIndicador } from '../../services/firestoreCandidatos'
import { getFirebaseUid } from '../../services/identidadeFirebase'
import {
  buscarSaldoIndicador,
  listarPagamentosPorIndicador,
  listarMovimentacoesIndicador,
  solicitarSaqueIndicador
} from '../../services/firestorePagamentos'
import { listarNotificacoesUsuario } from '../../services/firestoreNotificacoes'

const statusPagamentoLabels = {
  awaiting_company: 'Aguardando empresa',
  created: 'Pendente',
  pending: 'Pendente',
  in_process: 'Pendente',
  authorized: 'Pendente',
  approved: 'Recebido',
  rejected: 'Recusado',
  cancelled: 'Cancelado',
  refunded: 'Estornado',
  failed: 'Falhou'
}

const statusPendente = new Set(['created', 'pending', 'in_process', 'authorized'])

function IndicadorFinanceiro({ user }) {
  const toast = useToast()
  const confirm = useConfirmacao()
  const indicadorId = getFirebaseUid(user)
  const [saldo, setSaldo] = useState(null)
  const [movimentacoes, setMovimentacoes] = useState([])
  const [notificacoes, setNotificacoes] = useState([])
  const [pagamentos, setPagamentos] = useState([])
  const [candidatos, setCandidatos] = useState([])
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
        const [
          saldoData,
          movimentacoesData,
          notificacoesData,
          pagamentosData,
          candidatosData
        ] = await Promise.all([
          buscarSaldoIndicador(indicadorId),
          listarMovimentacoesIndicador(indicadorId),
          listarNotificacoesUsuario(indicadorId),
          listarPagamentosPorIndicador(indicadorId),
          listarCandidatosPorIndicador(indicadorId)
        ])

        if (!ativo) return

        setSaldo(saldoData)
        setMovimentacoes(movimentacoesData)
        setNotificacoes(notificacoesData.filter((notificacao) => notificacao.tipo === 'pagamento_aprovado'))
        setPagamentos(pagamentosData)
        setCandidatos(candidatosData)
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
  const metricasPagamentos = useMemo(() => ({
    totalCriado: pagamentos.reduce((soma, pagamento) => soma + Number(pagamento.valor || 0), 0),
    totalAprovado: pagamentos
      .filter((pagamento) => pagamento.status === 'approved')
      .reduce((soma, pagamento) => soma + Number(pagamento.valor || 0), 0),
    totalPendente: pagamentos
      .filter((pagamento) => statusPendente.has(pagamento.status))
      .reduce((soma, pagamento) => soma + Number(pagamento.valor || 0), 0)
  }), [pagamentos])
  const recompensas = useMemo(() => (
    montarRecompensasFinanceiras({ candidatos, pagamentos })
  ), [candidatos, pagamentos])

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
        <CardSaldo label="Saldo disponível" value={saldo?.saldoDisponivel} helper="Pode ser solicitado para saque manual." tone="primary" />
        <CardSaldo label="Saldo pendente" value={saldo?.saldoPendente} helper="Valores em validação de saque." />
        <CardSaldo label="Total recebido" value={saldo?.totalRecebido} helper="Recompensas aprovadas por contratação." />
        <CardSaldo label="Total sacado" value={saldo?.totalSacado} helper="Soma de saques pagos futuramente." />
      </section>

      <section className="indicador-pagamentos-metricas">
        <MetricCard label="Volume aprovado" value={formatCurrency(metricasPagamentos.totalAprovado)} />
        <MetricCard label="Volume pendente" value={formatCurrency(metricasPagamentos.totalPendente)} />
        <MetricCard label="Total criado" value={formatCurrency(metricasPagamentos.totalCriado)} />
      </section>

      <article className="indicador-pagamentos-lista">
        <div className="indicador-pagamentos-lista-header">
          <span><FaReceipt /> Histórico de recompensas</span>
          <strong>{recompensas.length}</strong>
        </div>

        {recompensas.length ? (
          recompensas.map((recompensa) => (
            <div className="indicador-pagamento-item" key={recompensa.id}>
              <div>
                <strong>{recompensa.candidatoNome || 'Candidato'}</strong>
                <span>{recompensa.vagaTitulo || 'Vaga não informada'} - {recompensa.empresaNome || 'Empresa'}</span>
                {recompensa.status === 'awaiting_company' ? (
                  <small>Candidato contratado. Recompensa aguardando pagamento da empresa.</small>
                ) : (
                  <>
                    <small>Criado em {formatDateTime(recompensa.criadoEm)}</small>
                    {recompensa.transacaoEm && (
                      <small>Transação em {formatDateTime(recompensa.transacaoEm)}</small>
                    )}
                    {recompensa.aprovadoEm && (
                      <small>Aprovado em {formatDateTime(recompensa.aprovadoEm)}</small>
                    )}
                    {recompensa.encerradoEm && recompensa.status !== 'approved' && (
                      <small>Encerrado em {formatDateTime(recompensa.encerradoEm)}</small>
                    )}
                  </>
                )}
              </div>

              <div className="indicador-pagamento-meta">
                <strong>{formatCurrency(recompensa.valor)}</strong>
                <span className={`indicador-pagamento-status ${recompensa.status}`}>
                  {statusPagamentoLabels[recompensa.status] || recompensa.status}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="indicador-pagamentos-vazio">
            <FaCreditCard />
            <strong>Nenhuma recompensa criada</strong>
            <p>Quando uma empresa contratar um indicado ou criar um pagamento, o status aparecerá aqui.</p>
          </div>
        )}
      </article>

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

function MetricCard({ label, value }) {
  return (
    <div className="indicador-pagamentos-metrica">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
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

function formatDateTime(value) {
  if (!value) return 'não informado'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'não informado'

  return date.toLocaleString('pt-BR')
}

function montarRecompensasFinanceiras({ candidatos, pagamentos }) {
  const pagamentosPorCandidato = new Map()
  const recompensas = []

  pagamentos.forEach((pagamento) => {
    if (pagamento.candidatoId) {
      const atual = pagamentosPorCandidato.get(pagamento.candidatoId)

      if (!atual || deveUsarPagamento(pagamento, atual)) {
        pagamentosPorCandidato.set(pagamento.candidatoId, pagamento)
      }
    }

    recompensas.push({
      id: pagamento.id,
      tipo: 'pagamento',
      ...pagamento
    })
  })

  candidatos
    .filter((candidato) => candidato.status === 'contratado')
    .forEach((candidato) => {
      const pagamento = pagamentosPorCandidato.get(candidato.id)
      if (pagamento) return

      recompensas.push({
        id: `aguardando-${candidato.id}`,
        tipo: 'aguardando',
        status: 'awaiting_company',
        candidatoId: candidato.id,
        candidatoNome: candidato.nome,
        vagaTitulo: candidato.vagaTitulo,
        empresaNome: candidato.vagaEmpresa,
        valor: candidato.recompensaValor,
        criadoEm: candidato.atualizadoEm || candidato.aplicadoEm || candidato.criadoEm
      })
    })

  return recompensas.sort((a, b) => {
    const dataA = new Date(a.aprovadoEm || a.encerradoEm || a.transacaoEm || a.criadoEm || 0).getTime()
    const dataB = new Date(b.aprovadoEm || b.encerradoEm || b.transacaoEm || b.criadoEm || 0).getTime()

    return dataB - dataA
  })
}

function deveUsarPagamento(novo, atual) {
  if (novo.status === 'approved' && atual.status !== 'approved') return true
  if (atual.status === 'approved' && novo.status !== 'approved') return false

  const dataAtual = new Date(atual.criadoEm || atual.atualizadoEm || 0).getTime()
  const dataNova = new Date(novo.criadoEm || novo.atualizadoEm || 0).getTime()

  return dataNova >= dataAtual
}

export default IndicadorFinanceiro
