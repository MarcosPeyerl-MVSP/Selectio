import './Paginacao.css'

import { useTranslation } from 'react-i18next'

function Paginacao({ page, pageSize, total, onPageChange }) {
  const { t } = useTranslation('common')
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  if (total <= pageSize) return null

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <nav className="pagination" aria-label={t('pagination.label')}>
      <span>{t('pagination.range', { start, end, total })}</span>
      <div>
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          {t('pagination.previous')}
        </button>
        <strong>{page} / {totalPages}</strong>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          {t('pagination.next')}
        </button>
      </div>
    </nav>
  )
}

export default Paginacao
