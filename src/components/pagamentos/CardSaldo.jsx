import './CardSaldo.css'

import { formatCurrency } from '../../i18n/formatters'

function CardSaldo({ label, value, helper, tone = 'default' }) {
  return (
    <article className={`balance-card ${tone}`}>
      <span>{label}</span>
      <strong>{formatCurrency(value)}</strong>
      {helper && <p>{helper}</p>}
    </article>
  )
}

export default CardSaldo
