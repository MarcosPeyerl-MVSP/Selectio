import './MenuNotificacoes.css'

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FaBell } from 'react-icons/fa'

import {
  assinarNotificacoesUsuario,
  marcarNotificacaoComoLida
} from '../../services/firestoreNotificacoes'
import { getFirebaseUid } from '../../services/identidadeFirebase'

const tipoLabels = {
  novo_candidato: 'Candidato',
  indicacao_enviada: 'Indicação',
  candidato_entrevista: 'Status',
  candidato_contratado: 'Status',
  candidato_cancelado: 'Status',
  candidato_recusado: 'Status',
  recompensa_pendente: 'Recompensa',
  entrevista_agendada: 'Entrevista',
  entrevista_pendente: 'Entrevista',
  entrevista_realizada: 'Entrevista',
  entrevista_cancelada: 'Entrevista',
  pagamento_criado: 'Pagamento',
  pagamento_pendente: 'Pagamento',
  pagamento_aprovado: 'Pagamento',
  pagamento_recusado: 'Pagamento',
  pagamento_cancelado: 'Pagamento',
  pagamento_estornado: 'Pagamento',
  pagamento_falhou: 'Pagamento',
  saque_solicitado: 'Saque',
  saque_aprovado: 'Saque',
  saque_recusado: 'Saque',
  saque_pago: 'Saque'
}

function MenuNotificacoes({ user }) {
  const userId = getFirebaseUid(user)
  const [aberto, setAberto] = useState(false)
  const [notificacoes, setNotificacoes] = useState([])

  useEffect(() => {
    if (!userId) {
      return undefined
    }

    return assinarNotificacoesUsuario(
      userId,
      setNotificacoes,
      () => setNotificacoes([])
    )
  }, [userId])

  const naoLidas = useMemo(() => notificacoes.filter((notificacao) => !notificacao.lida).length, [notificacoes])

  const marcarComoLida = async (notificacao) => {
    if (notificacao.lida) return

    setNotificacoes((atuais) => atuais.map((item) => (
      item.id === notificacao.id ? { ...item, lida: true } : item
    )))

    await marcarNotificacaoComoLida(notificacao.id).catch(() => {})
  }

  return (
    <div className="notifications-dropdown">
      <button
        type="button"
        className={`icon-button notification-trigger ${naoLidas ? 'has-unread' : ''}`}
        aria-label="Notificações"
        onClick={() => setAberto((estado) => !estado)}
      >
        <FaBell />
        {naoLidas > 0 && <span>{naoLidas}</span>}
      </button>

      {aberto && (
        <section className="notifications-menu">
          <header>
            <strong>Notificações</strong>
            <span>{naoLidas ? `${naoLidas} nova(s)` : 'Tudo lido'}</span>
          </header>

          {notificacoes.length ? (
            <div className="notifications-list">
              {notificacoes.slice(0, 6).map((notificacao) => (
                <Link
                  className={`notification-item ${notificacao.lida ? 'read' : ''}`}
                  key={notificacao.id}
                  to={notificacao.link || '#'}
                  onClick={() => {
                    marcarComoLida(notificacao)
                    setAberto(false)
                  }}
                >
                  <span className="notification-item-meta">
                    {tipoLabels[notificacao.tipo] || 'Atualização'}
                    {notificacao.criadoEm ? ` • ${formatDateTime(notificacao.criadoEm)}` : ''}
                  </span>
                  <strong>{notificacao.titulo || 'Notificação'}</strong>
                  <p>{notificacao.mensagem || ''}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="notifications-empty">
              <strong>Sem notificações</strong>
              <p>Novidades financeiras e operacionais aparecem aqui.</p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function formatDateTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short'
  }).replace('.', '')
}

export default MenuNotificacoes
