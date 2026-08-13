import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore'

import { auth, db } from './firebase'

const notificacoesCollection = collection(db, 'notificacoes')
const statusCandidatoNotificacoes = {
  entrevista: {
    tipo: 'candidato_entrevista',
    titulo: 'Candidato em entrevista',
    mensagem: 'avançou para entrevista',
    tituloKey: 'notifications.messages.candidate.entrevistaTitle',
    mensagemKey: 'notifications.messages.candidate.entrevista'
  },
  contratado: {
    tipo: 'candidato_contratado',
    titulo: 'Candidato contratado',
    mensagem: 'foi marcado como contratado',
    tituloKey: 'notifications.messages.candidate.contratadoTitle',
    mensagemKey: 'notifications.messages.candidate.contratado'
  },
  cancelado: {
    tipo: 'candidato_cancelado',
    titulo: 'Candidato cancelado',
    mensagem: 'foi cancelado no processo',
    tituloKey: 'notifications.messages.candidate.canceladoTitle',
    mensagemKey: 'notifications.messages.candidate.cancelado'
  },
  recusado: {
    tipo: 'candidato_recusado',
    titulo: 'Candidato recusado',
    mensagem: 'foi recusado no processo',
    tituloKey: 'notifications.messages.candidate.recusadoTitle',
    mensagemKey: 'notifications.messages.candidate.recusado'
  }
}
const statusEntrevistaNotificacoes = {
  agendada: {
    tipo: 'entrevista_agendada',
    titulo: 'Entrevista agendada',
    mensagem: 'teve uma entrevista agendada',
    tituloKey: 'notifications.messages.interview.agendadaTitle',
    mensagemKey: 'notifications.messages.interview.agendada'
  },
  pendente: {
    tipo: 'entrevista_pendente',
    titulo: 'Entrevista pendente',
    mensagem: 'ficou com entrevista pendente',
    tituloKey: 'notifications.messages.interview.pendenteTitle',
    mensagemKey: 'notifications.messages.interview.pendente'
  },
  realizada: {
    tipo: 'entrevista_realizada',
    titulo: 'Entrevista realizada',
    mensagem: 'teve a entrevista marcada como realizada',
    tituloKey: 'notifications.messages.interview.realizadaTitle',
    mensagemKey: 'notifications.messages.interview.realizada'
  },
  cancelada: {
    tipo: 'entrevista_cancelada',
    titulo: 'Entrevista cancelada',
    mensagem: 'teve a entrevista cancelada',
    tituloKey: 'notifications.messages.interview.canceladaTitle',
    mensagemKey: 'notifications.messages.interview.cancelada'
  }
}
const statusPagamentoNotificacoes = {
  created: {
    tipo: 'pagamento_criado',
    titulo: 'Pagamento criado',
    tituloKey: 'notifications.messages.payment.createdTitle',
    mensagemIndicadorKey: 'notifications.messages.payment.createdReferrer',
    mensagemEmpresaKey: 'notifications.messages.payment.createdCompany',
    mensagemIndicador: 'A empresa iniciou o pagamento da sua recompensa',
    mensagemEmpresa: 'Pagamento de recompensa criado'
  },
  pending: {
    tipo: 'pagamento_pendente',
    titulo: 'Pagamento pendente',
    tituloKey: 'notifications.messages.payment.pendingTitle',
    mensagemIndicadorKey: 'notifications.messages.payment.pendingReferrer',
    mensagemEmpresaKey: 'notifications.messages.payment.pendingCompany',
    mensagemIndicador: 'Pagamento da recompensa aguardando confirmação do Mercado Pago',
    mensagemEmpresa: 'Pagamento aguardando confirmação do Mercado Pago'
  },
  approved: {
    tipo: 'pagamento_aprovado',
    tituloIndicador: 'Pagamento recebido',
    tituloEmpresa: 'Pagamento aprovado',
    tituloIndicadorKey: 'notifications.messages.payment.approvedReferrerTitle',
    tituloEmpresaKey: 'notifications.messages.payment.approvedCompanyTitle',
    mensagemIndicadorKey: 'notifications.messages.payment.approvedReferrer',
    mensagemEmpresaKey: 'notifications.messages.payment.approvedCompany',
    mensagemIndicador: 'Você recebeu a recompensa',
    mensagemEmpresa: 'Pagamento de recompensa aprovado'
  },
  rejected: {
    tipo: 'pagamento_recusado',
    titulo: 'Pagamento recusado',
    tituloKey: 'notifications.messages.payment.rejectedTitle',
    mensagemIndicadorKey: 'notifications.messages.payment.rejectedReferrer',
    mensagemEmpresaKey: 'notifications.messages.payment.rejectedCompany',
    mensagemIndicador: 'O pagamento da recompensa foi recusado',
    mensagemEmpresa: 'O Mercado Pago recusou o pagamento'
  },
  cancelled: {
    tipo: 'pagamento_cancelado',
    titulo: 'Pagamento cancelado',
    tituloKey: 'notifications.messages.payment.cancelledTitle',
    mensagemIndicadorKey: 'notifications.messages.payment.cancelledReferrer',
    mensagemEmpresaKey: 'notifications.messages.payment.cancelledCompany',
    mensagemIndicador: 'O pagamento da recompensa foi cancelado',
    mensagemEmpresa: 'Pagamento de recompensa cancelado'
  },
  refunded: {
    tipo: 'pagamento_estornado',
    titulo: 'Pagamento estornado',
    tituloKey: 'notifications.messages.payment.refundedTitle',
    mensagemIndicadorKey: 'notifications.messages.payment.refundedReferrer',
    mensagemEmpresaKey: 'notifications.messages.payment.refundedCompany',
    mensagemIndicador: 'O pagamento da recompensa foi estornado',
    mensagemEmpresa: 'Pagamento de recompensa estornado'
  },
  failed: {
    tipo: 'pagamento_falhou',
    titulo: 'Pagamento falhou',
    tituloKey: 'notifications.messages.payment.failedTitle',
    mensagemIndicadorKey: 'notifications.messages.payment.failedReferrer',
    mensagemEmpresaKey: 'notifications.messages.payment.failedCompany',
    mensagemIndicador: 'Não foi possível confirmar o pagamento da recompensa',
    mensagemEmpresa: 'O pagamento de recompensa falhou'
  }
}

const textoSeguro = (valor, fallback = '') => {
  const texto = String(valor || '').trim()
  return texto || fallback
}

const dinheiro = (valor) => Number(valor || 0).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL'
})

const notificacaoId = (...partes) => partes
  .map((parte) => textoSeguro(parte, 'sem-valor').toLowerCase())
  .join('_')
  .replace(/[^a-z0-9_-]+/g, '-')
  .slice(0, 180)

const converterTimestamp = (valor) => {
  if (!valor) return null
  if (typeof valor.toDate === 'function') return valor.toDate().toISOString()
  return valor
}

const mapearNotificacao = (documento) => {
  if (!documento.exists()) return null

  const dados = documento.data()

  return {
    id: documento.id,
    ...dados,
    criadoEm: converterTimestamp(dados.criadoEm),
    lidaEm: converterTimestamp(dados.lidaEm)
  }
}

const ordenarPorCriacao = (a, b) => {
  const dataA = new Date(a.criadoEm || 0).getTime()
  const dataB = new Date(b.criadoEm || 0).getTime()

  return dataB - dataA
}

export const listarNotificacoesUsuario = async (userId) => {
  if (!userId) return []

  const documentos = await getDocs(query(
    notificacoesCollection,
    where('userId', '==', userId),
    limit(20)
  ))

  return documentos.docs.map(mapearNotificacao).filter(Boolean).sort(ordenarPorCriacao)
}

export const criarNotificacao = async ({
  id,
  userId,
  tipo,
  titulo,
  tituloKey = '',
  tituloParams = {},
  mensagem,
  mensagemKey = '',
  mensagemParams = {},
  link,
  metadata = {}
}) => {
  if (!userId || !tipo || (!titulo && !tituloKey)) return null

  const notificationId = Array.isArray(id)
    ? notificacaoId(...id)
    : notificacaoId(id || tipo, userId, metadata.candidatoId || metadata.pagamentoId || metadata.entrevistaId)

  const payload = {
    userId,
    tipo,
    titulo: titulo || '',
    tituloKey,
    tituloParams,
    mensagem: mensagem || '',
    mensagemKey,
    mensagemParams,
    link: link || '',
    metadata,
    lida: false,
    origem: 'app',
    criadoPor: auth.currentUser?.uid || '',
    criadoEm: serverTimestamp()
  }

  await setDoc(doc(notificacoesCollection, notificationId), payload, { merge: true })
  return notificationId
}

export const notificarNovoCandidatoIndicado = async (candidato) => {
  if (!candidato?.id) return []

  const candidatoNome = textoSeguro(candidato.nome || candidato.candidatoNome, 'Candidato')
  const vagaTitulo = textoSeguro(candidato.vagaTitulo, 'vaga informada')
  const indicadorNome = textoSeguro(candidato.indicadorNome, 'um indicador')
  const empresaId = textoSeguro(candidato.empresaId || candidato.empresaUid)
  const indicadorId = textoSeguro(candidato.indicadorId || candidato.indicadorUid)
  const metadata = {
    candidatoId: candidato.id,
    vagaId: textoSeguro(candidato.vagaId),
    empresaId,
    indicadorId
  }
  const tarefas = []

  if (empresaId) {
    tarefas.push(criarNotificacao({
      id: ['candidato', candidato.id, 'empresa', 'novo'],
      userId: empresaId,
      tipo: 'novo_candidato',
      titulo: 'Novo candidato indicado',
      tituloKey: 'notifications.messages.newCandidateTitle',
      mensagem: `${indicadorNome} indicou ${candidatoNome} para ${vagaTitulo}.`,
      mensagemKey: 'notifications.messages.newCandidateCompany',
      mensagemParams: {
        referrer: indicadorNome,
        candidate: candidatoNome,
        job: vagaTitulo
      },
      link: '/candidatos/empresa',
      metadata
    }))
  }

  if (indicadorId) {
    tarefas.push(criarNotificacao({
      id: ['candidato', candidato.id, 'indicador', 'enviado'],
      userId: indicadorId,
      tipo: 'indicacao_enviada',
      titulo: 'Indicação enviada',
      tituloKey: 'notifications.messages.referralSentTitle',
      mensagem: `Sua indicação de ${candidatoNome} para ${vagaTitulo} foi registrada.`,
      mensagemKey: 'notifications.messages.referralSent',
      mensagemParams: {
        candidate: candidatoNome,
        job: vagaTitulo
      },
      link: '/candidatos/indicador',
      metadata
    }))
  }

  return Promise.allSettled(tarefas)
}

export const notificarStatusCandidatoAlterado = async ({ candidato, statusAnterior, statusAtual }) => {
  if (!candidato?.id || statusAnterior === statusAtual) return []

  const info = statusCandidatoNotificacoes[statusAtual]
  if (!info) return []

  const candidatoNome = textoSeguro(candidato.nome || candidato.candidatoNome, 'Candidato')
  const vagaTitulo = textoSeguro(candidato.vagaTitulo, 'vaga informada')
  const empresaId = textoSeguro(candidato.empresaId || candidato.empresaUid)
  const indicadorId = textoSeguro(candidato.indicadorId || candidato.indicadorUid)
  const metadata = {
    candidatoId: candidato.id,
    vagaId: textoSeguro(candidato.vagaId),
    empresaId,
    indicadorId,
    statusAnterior: textoSeguro(statusAnterior, 'indicado'),
    statusAtual
  }
  const tarefas = []

  if (indicadorId) {
    tarefas.push(criarNotificacao({
      id: ['candidato', candidato.id, 'indicador', statusAtual],
      userId: indicadorId,
      tipo: info.tipo,
      titulo: info.titulo,
      tituloKey: info.tituloKey,
      mensagem: `${candidatoNome} ${info.mensagem} na vaga ${vagaTitulo}.`,
      mensagemKey: info.mensagemKey,
      mensagemParams: {
        candidate: candidatoNome,
        job: vagaTitulo
      },
      link: '/candidatos/indicador',
      metadata
    }))
  }

  if (empresaId && statusAtual === 'contratado') {
    tarefas.push(criarNotificacao({
      id: ['candidato', candidato.id, 'empresa', 'recompensa-pendente'],
      userId: empresaId,
      tipo: 'recompensa_pendente',
      titulo: 'Recompensa pendente',
      tituloKey: 'notifications.messages.rewardPendingTitle',
      mensagem: `${candidatoNome} foi contratado. Agora a recompensa do indicador pode ser paga.`,
      mensagemKey: 'notifications.messages.rewardPending',
      mensagemParams: { candidate: candidatoNome },
      link: '/candidatos/empresa',
      metadata
    }))
  }

  return Promise.allSettled(tarefas)
}

export const notificarEntrevistaAlterada = async ({ entrevista, statusAnterior = '', statusAtual }) => {
  if (!entrevista?.id) return []

  const status = textoSeguro(statusAtual || entrevista.status, 'agendada')
  const info = statusEntrevistaNotificacoes[status]
  if (!info) return []

  const empresaId = textoSeguro(entrevista.empresaId)
  const indicadorId = textoSeguro(entrevista.indicadorId)
  const candidatoNome = textoSeguro(entrevista.candidatoNome, 'Candidato')
  const vagaTitulo = textoSeguro(entrevista.vagaTitulo, 'vaga informada')
  const dataHora = entrevista.data && entrevista.horaInicio
    ? ` em ${entrevista.data} às ${entrevista.horaInicio}`
    : ''
  const metadata = {
    entrevistaId: entrevista.id,
    candidatoId: textoSeguro(entrevista.candidatoId),
    vagaId: textoSeguro(entrevista.vagaId),
    empresaId,
    indicadorId,
    statusAnterior,
    statusAtual: status
  }
  const tarefas = []

  if (indicadorId) {
    tarefas.push(criarNotificacao({
      id: ['entrevista', entrevista.id, 'indicador', status],
      userId: indicadorId,
      tipo: info.tipo,
      titulo: info.titulo,
      tituloKey: info.tituloKey,
      mensagem: `${candidatoNome} ${info.mensagem} para ${vagaTitulo}${dataHora}.`,
      mensagemKey: info.mensagemKey,
      mensagemParams: {
        candidate: candidatoNome,
        job: vagaTitulo,
        date: textoSeguro(entrevista.data),
        time: textoSeguro(entrevista.horaInicio)
      },
      link: '/candidatos/indicador',
      metadata
    }))
  }

  if (empresaId) {
    tarefas.push(criarNotificacao({
      id: ['entrevista', entrevista.id, 'empresa', status],
      userId: empresaId,
      tipo: info.tipo,
      titulo: info.titulo,
      tituloKey: info.tituloKey,
      mensagem: `${candidatoNome} ${info.mensagem} para ${vagaTitulo}${dataHora}.`,
      mensagemKey: info.mensagemKey,
      mensagemParams: {
        candidate: candidatoNome,
        job: vagaTitulo,
        date: textoSeguro(entrevista.data),
        time: textoSeguro(entrevista.horaInicio)
      },
      link: '/painel/empresa?secao=entrevistas',
      metadata
    }))
  }

  return Promise.allSettled(tarefas)
}

export const notificarPagamentoAlterado = async ({ pagamento, statusAnterior = '', statusAtual }) => {
  if (!pagamento?.id) return []

  const statusOriginal = textoSeguro(statusAtual || pagamento.status, 'created')
  const status = statusOriginal === 'in_process' || statusOriginal === 'authorized'
    ? 'pending'
    : statusOriginal
  const info = statusPagamentoNotificacoes[status]
  if (!info) return []

  const empresaId = textoSeguro(pagamento.empresaId)
  const indicadorId = textoSeguro(pagamento.indicadorId)
  const candidatoNome = textoSeguro(pagamento.candidatoNome, 'Candidato')
  const vagaTitulo = textoSeguro(pagamento.vagaTitulo, 'vaga informada')
  const valor = dinheiro(pagamento.valor)
  const metadata = {
    pagamentoId: pagamento.id,
    candidatoId: textoSeguro(pagamento.candidatoId),
    vagaId: textoSeguro(pagamento.vagaId),
    empresaId,
    indicadorId,
    statusAnterior,
    statusAtual: status,
    valor: Number(pagamento.valor || 0)
  }
  const tarefas = []

  if (indicadorId) {
    const mensagem = status === 'approved'
      ? `Você recebeu ${valor} pela indicação de ${candidatoNome} para ${vagaTitulo}.`
      : `${info.mensagemIndicador}: ${valor} por ${candidatoNome} em ${vagaTitulo}.`

    tarefas.push(criarNotificacao({
      id: ['pagamento', pagamento.id, 'indicador', status],
      userId: indicadorId,
      tipo: info.tipo,
      titulo: info.tituloIndicador || info.titulo,
      tituloKey: info.tituloIndicadorKey || info.tituloKey,
      mensagem,
      mensagemKey: info.mensagemIndicadorKey,
      mensagemParams: {
        candidate: candidatoNome,
        job: vagaTitulo
      },
      link: '/painel/indicador/dashboard?secao=financeiro',
      metadata
    }))
  }

  if (empresaId) {
    const mensagem = status === 'approved'
      ? `Pagamento de ${valor} aprovado para ${candidatoNome}.`
      : `${info.mensagemEmpresa}: ${valor} para ${candidatoNome} em ${vagaTitulo}.`

    tarefas.push(criarNotificacao({
      id: ['pagamento', pagamento.id, 'empresa', status],
      userId: empresaId,
      tipo: info.tipo,
      titulo: info.tituloEmpresa || info.titulo,
      tituloKey: info.tituloEmpresaKey || info.tituloKey,
      mensagem,
      mensagemKey: info.mensagemEmpresaKey,
      mensagemParams: {
        candidate: candidatoNome,
        job: vagaTitulo
      },
      link: '/painel/empresa?secao=pagamentos',
      metadata
    }))
  }

  return Promise.allSettled(tarefas)
}

export const assinarNotificacoesUsuario = (userId, callback, onError) => {
  if (!userId) {
    callback([])
    return () => {}
  }

  return onSnapshot(
    query(
      notificacoesCollection,
      where('userId', '==', userId),
      limit(50)
    ),
    (documentos) => {
      const notificacoes = documentos.docs
        .map(mapearNotificacao)
        .filter(Boolean)
        .sort(ordenarPorCriacao)

      callback(notificacoes)
    },
    onError
  )
}

export const marcarNotificacaoComoLida = async (notificationId) => {
  if (!notificationId) return

  await updateDoc(doc(db, 'notificacoes', notificationId), {
    lida: true,
    lidaEm: serverTimestamp()
  })
}
