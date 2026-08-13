import './styles/IndicadorFinanceiro.css'

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FaCreditCard, FaMoneyBillWave, FaReceipt, FaWallet } from 'react-icons/fa'

import CardSaldo from '../../components/pagamentos/CardSaldo'
import PageLoader from '../../components/ui/PageLoader'
import { useConfirmacao } from '../../hooks/useConfirmacao'
import { useToast } from '../../hooks/useToast'
import { formatCurrency, formatDate } from '../../i18n/formatters'
import { listarCandidatosPorIndicador } from '../../services/firestoreCandidatos'
import { getFirebaseUid } from '../../services/identidadeFirebase'
import {
  buscarSaldoIndicador,
  listarPagamentosPorIndicador,
  listarMovimentacoesIndicador,
  solicitarSaqueIndicador
} from '../../services/firestorePagamentos'
import { listarNotificacoesUsuario } from '../../services/firestoreNotificacoes'

const statusPendente = new Set(['created', 'pending', 'in_process', 'authorized'])

function IndicadorFinanceiro({ user }) {
  const { t, i18n } = useTranslation(['referrer', 'common'])
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
  const language = i18n.resolvedLanguage || i18n.language
  const formatDateTime = (value) => formatDate(value, {
    dateStyle: 'short',
    timeStyle: 'short'
  }) || t('finance.notProvided')
  const getPaymentStatus = (status) => (
    status === 'approved'
      ? t('finance.receivedStatus')
      : t(`common:statuses.payments.${status}`, { defaultValue: status })
  )

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
      } catch {
        toast.error(t('finance.loadError'))
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregarFinanceiro()

    return () => {
      ativo = false
    }
  }, [indicadorId, t, toast])

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

    const valorNumerico = parseLocalizedNumber(valor, language)

    if (!valorNumerico || valorNumerico <= 0) {
      toast.warning(t('finance.invalidWithdrawal'))
      return
    }

    if (valorNumerico > Number(saldo?.saldoDisponivel || 0)) {
      toast.warning(t('finance.exceedsBalance'))
      return
    }

    if (!chavePix.trim()) {
      toast.warning(t('finance.pixRequired'))
      return
    }

    const confirmado = await confirm({
      title: t('finance.confirmTitle'),
      description: t('finance.confirmDescription'),
      confirmLabel: t('finance.requestWithdrawal'),
      cancelLabel: t('finance.back')
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
      toast.success(t('finance.requestSent'))
    } catch {
      toast.error(t('finance.requestError'))
    } finally {
      setEnviando(false)
    }
  }

  if (carregando) return <PageLoader label={t('finance.loading')} compact />

  return (
    <section className="indicador-financeiro">
      <header className="indicador-financeiro-header">
        <div>
          <span>{t('finance.wallet')}</span>
          <h1>{t('finance.title')}</h1>
          <p>{t('finance.description')}</p>
        </div>

        <button type="button" onClick={() => setModalAberto(true)} disabled={!Number(saldo?.saldoDisponivel || 0)}>
          <FaWallet /> {t('finance.requestWithdrawal')}
        </button>
      </header>

      <section className="indicador-saldo-grid">
        <CardSaldo label={t('finance.availableBalance')} value={saldo?.saldoDisponivel} helper={t('finance.availableHelper')} tone="primary" />
        <CardSaldo label={t('finance.pendingBalance')} value={saldo?.saldoPendente} helper={t('finance.pendingHelper')} />
        <CardSaldo label={t('finance.totalReceived')} value={saldo?.totalRecebido} helper={t('finance.receivedHelper')} />
        <CardSaldo label={t('finance.totalWithdrawn')} value={saldo?.totalSacado} helper={t('finance.withdrawnHelper')} />
      </section>

      <section className="indicador-pagamentos-metricas">
        <MetricCard label={t('finance.approvedVolume')} value={formatCurrency(metricasPagamentos.totalAprovado)} />
        <MetricCard label={t('finance.pendingVolume')} value={formatCurrency(metricasPagamentos.totalPendente)} />
        <MetricCard label={t('finance.totalCreated')} value={formatCurrency(metricasPagamentos.totalCriado)} />
      </section>

      <article className="indicador-pagamentos-lista">
        <div className="indicador-pagamentos-lista-header">
          <span><FaReceipt /> {t('finance.rewardHistory')}</span>
          <strong>{recompensas.length}</strong>
        </div>

        {recompensas.length ? (
          recompensas.map((recompensa) => (
            <div className="indicador-pagamento-item" key={recompensa.id}>
              <div>
                <strong>{recompensa.candidatoNome || t('finance.candidate')}</strong>
                <span>{recompensa.vagaTitulo || t('finance.jobNotProvided')} - {recompensa.empresaNome || t('finance.company')}</span>
                {recompensa.status === 'awaiting_company' ? (
                  <small>{t('finance.awaitingCompany')}</small>
                ) : (
                  <>
                    <small>{t('finance.createdAt', { date: formatDateTime(recompensa.criadoEm) })}</small>
                    {recompensa.transacaoEm && (
                      <small>{t('finance.transactionAt', { date: formatDateTime(recompensa.transacaoEm) })}</small>
                    )}
                    {recompensa.aprovadoEm && (
                      <small>{t('finance.approvedAt', { date: formatDateTime(recompensa.aprovadoEm) })}</small>
                    )}
                    {recompensa.encerradoEm && recompensa.status !== 'approved' && (
                      <small>{t('finance.closedAt', { date: formatDateTime(recompensa.encerradoEm) })}</small>
                    )}
                  </>
                )}
              </div>

              <div className="indicador-pagamento-meta">
                <strong>{formatCurrency(recompensa.valor)}</strong>
                <span className={`indicador-pagamento-status ${recompensa.status}`}>
                  {getPaymentStatus(recompensa.status)}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="indicador-pagamentos-vazio">
            <FaCreditCard />
            <strong>{t('finance.noRewardTitle')}</strong>
            <p>{t('finance.noRewardDescription')}</p>
          </div>
        )}
      </article>

      <div className="indicador-financeiro-grid">
        <article className="indicador-financeiro-card">
          <div className="indicador-financeiro-card-title">
            <span><FaMoneyBillWave /> {t('finance.transactions')}</span>
            <strong>{movimentacoes.length}</strong>
          </div>

          {movimentacoes.length ? (
            movimentacoes.map((movimentacao) => (
              <div className="indicador-movimentacao-item" key={movimentacao.id}>
                <div>
                  <strong>{t(`finance.movement.${movimentacao.tipo}`, { defaultValue: t('finance.movement.fallback') })}</strong>
                  <span>{movimentacao.descricao || t('finance.transactionFallback')}</span>
                </div>
                <strong>{formatCurrency(movimentacao.valor)}</strong>
              </div>
            ))
          ) : (
            <EstadoVazio title={t('finance.noTransactions')} description={t('finance.noTransactionsDescription')} />
          )}
        </article>

        <article className="indicador-financeiro-card">
          <div className="indicador-financeiro-card-title">
            <span>{t('finance.receivedPayments')}</span>
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
            <EstadoVazio title={t('finance.noPayments')} description={t('finance.noPaymentsDescription')} />
          )}
        </article>
      </div>

      {modalAberto && (
        <div className="saque-modal-backdrop" role="presentation" onMouseDown={() => setModalAberto(false)}>
          <section className="saque-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <span>{t('finance.manualRequest')}</span>
              <h2>{t('finance.requestWithdrawal')}</h2>
              <p>{t('finance.modalDescription')}</p>
            </header>

            <form onSubmit={enviarSaque}>
              <label>
                {t('finance.value')}
                <input value={valor} onChange={(event) => setValor(event.target.value)} placeholder={t('finance.valuePlaceholder')} inputMode="decimal" />
              </label>

              <label>
                {t('finance.pixKey')}
                <input value={chavePix} onChange={(event) => setChavePix(event.target.value)} placeholder={t('finance.pixPlaceholder')} />
              </label>

              <div className="saque-modal-actions">
                <button type="button" className="secondary" onClick={() => setModalAberto(false)}>
                  {t('finance.cancel')}
                </button>
                <button type="submit" disabled={enviando}>
                  {enviando ? t('finance.sending') : t('finance.requestWithdrawal')}
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

function parseLocalizedNumber(value, language) {
  const normalized = String(value || '').replace(/[^\d,.-]/g, '')

  if (String(language).toLowerCase().startsWith('en')) {
    return Number(normalized.replace(/,/g, ''))
  }

  return Number(normalized.replace(/\./g, '').replace(',', '.'))
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
