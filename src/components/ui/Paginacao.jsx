import './Paginacao.css'

function Paginacao({ page, pageSize, total, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  if (total <= pageSize) return null

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <nav className="pagination" aria-label="Paginação">
      <span>{start}-{end} de {total}</span>
      <div>
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          Anterior
        </button>
        <strong>{page} / {totalPages}</strong>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Próxima
        </button>
      </div>
    </nav>
  )
}

export default Paginacao
