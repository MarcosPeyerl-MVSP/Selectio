import './MenuNotificacoes.css'

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FaBell } from 'react-icons/fa'
import { useTranslation } from 'react-i18next'

import {
  assinarNotificacoesUsuario,
  marcarNotificacaoComoLida
} from '../../services/firestoreNotificacoes'
import { getFirebaseUid } from '../../services/identidadeFirebase'
import { formatCurrency, formatDate } from '../../i18n/formatters'

const tipoLabelKeys = {
  novo_candidato: 'notifications.types.candidate',
  indicacao_enviada: 'notifications.types.referral',
  candidato_entrevista: 'notifications.types.status',
  candidato_contratado: 'notifications.types.status',
  candidato_cancelado: 'notifications.types.status',
  candidato_recusado: 'notifications.types.status',
  recompensa_pendente: 'notifications.types.reward',
  entrevista_agendada: 'notifications.types.interview',
  entrevista_pendente: 'notifications.types.interview',
  entrevista_realizada: 'notifications.types.interview',
  entrevista_cancelada: 'notifications.types.interview',
  pagamento_criado: 'notifications.types.payment',
  pagamento_pendente: 'notifications.types.payment',
  pagamento_aprovado: 'notifications.types.payment',
  pagamento_recusado: 'notifications.types.payment',
  pagamento_cancelado: 'notifications.types.payment',
  pagamento_estornado: 'notifications.types.payment',
  pagamento_falhou: 'notifications.types.payment',
  saque_solicitado: 'notifications.types.withdrawal',
  saque_aprovado: 'notifications.types.withdrawal',
  saque_recusado: 'notifications.types.withdrawal',
  saque_pago: 'notifications.types.withdrawal'
}

function MenuNotificacoes({ user }) {
  const { t } = useTranslation('common')
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
        aria-label={t('notifications.title')}
        onClick={() => setAberto((estado) => !estado)}
      >
        <FaBell />
        {naoLidas > 0 && <span>{naoLidas}</span>}
      </button>

      {aberto && (
        <section className="notifications-menu">
          <header>
            <strong>{t('notifications.title')}</strong>
            <span>{naoLidas
              ? t('notifications.new', { count: naoLidas })
              : t('notifications.allRead')}</span>
          </header>

          {notificacoes.length ? (
            <div className="notifications-list">
              {notificacoes.slice(0, 6).map((notificacao) => {
                const titulo = notificacao.tituloKey
                  ? t(notificacao.tituloKey, notificacao.tituloParams || {})
                  : notificacao.titulo || t('notifications.fallback')
                const mensagem = notificacao.mensagemKey
                  ? t(notificacao.mensagemKey, getNotificationParams(notificacao, t))
                  : notificacao.mensagem || ''

                return (
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
                      {t(tipoLabelKeys[notificacao.tipo] || 'notifications.update')}
                      {notificacao.criadoEm ? ` • ${formatDateTime(notificacao.criadoEm)}` : ''}
                    </span>
                    <strong>{titulo}</strong>
                    <p>{mensagem}</p>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="notifications-empty">
              <strong>{t('notifications.emptyTitle')}</strong>
              <p>{t('notifications.emptyDescription')}</p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function getNotificationParams(notificacao, t) {
  const params = { ...(notificacao.mensagemParams || {}) }

  if (notificacao.metadata?.valor !== undefined && notificacao.metadata?.valor !== null) {
    params.value = formatCurrency(notificacao.metadata.valor)
  }

  params.dateTime = params.date && params.time
    ? t('notifications.messages.interview.dateTime', {
        date: formatDate(`${params.date}T12:00:00`, { dateStyle: 'short' }) || params.date,
        time: params.time
      })
    : ''

  return params
}

function formatDateTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return formatDate(date, {
    day: '2-digit',
    month: 'short'
  }).replace('.', '')
}

export default MenuNotificacoes
