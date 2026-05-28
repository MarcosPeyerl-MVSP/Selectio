import './BalanceCard.css'

function BalanceCard({ label, value, helper, tone = 'default' }) {
  return (
    <article className={`balance-card ${tone}`}>
      <span>{label}</span>
      <strong>{formatCurrency(value)}</strong>
      {helper && <p>{helper}</p>}
    </article>
  )
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

export default BalanceCard
