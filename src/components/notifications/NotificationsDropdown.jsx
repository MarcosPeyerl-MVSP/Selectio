import './NotificationsDropdown.css'

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FaBell } from 'react-icons/fa'

import {
  listarNotificacoesUsuario,
  marcarNotificacaoComoLida
} from '../../services/firestoreNotificacoes'
import { getFirebaseUid } from '../../services/firebaseIdentity'

function NotificationsDropdown({ user }) {
  const userId = getFirebaseUid(user)
  const [aberto, setAberto] = useState(false)
  const [notificacoes, setNotificacoes] = useState([])

  useEffect(() => {
    let ativo = true

    const carregarNotificacoes = async () => {
      if (!userId) {
        setNotificacoes([])
        return
      }

      try {
        const dados = await listarNotificacoesUsuario(userId)
        if (ativo) setNotificacoes(dados)
      } catch {
        if (ativo) setNotificacoes([])
      }
    }

    carregarNotificacoes()

    return () => {
      ativo = false
    }
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
        aria-label="Notificacoes"
        onClick={() => setAberto((estado) => !estado)}
      >
        <FaBell />
        {naoLidas > 0 && <span>{naoLidas}</span>}
      </button>

      {aberto && (
        <section className="notifications-menu">
          <header>
            <strong>Notificacoes</strong>
            <span>{naoLidas ? `${naoLidas} nova(s)` : 'Tudo lido'}</span>
          </header>

          {notificacoes.length ? (
            <div className="notifications-list">
              {notificacoes.slice(0, 6).map((notificacao) => (
                <Link
                  className={`notification-item ${notificacao.lida ? 'read' : ''}`}
                  key={notificacao.id}
                  to={notificacao.link || '#'}
                  onClick={() => marcarComoLida(notificacao)}
                >
                  <strong>{notificacao.titulo || 'Notificação'}</strong>
                  <p>{notificacao.mensagem || ''}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="notifications-empty">
              <strong>Sem notificacoes</strong>
              <p>Novidades financeiras e operacionais aparecem aqui.</p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

export default NotificationsDropdown
