import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  where
} from 'firebase/firestore'

import { db } from './firebase'
import { adicionarHistoricoAoBatch } from './firestoreHistorico'
import { notificarEntrevistaAlterada } from './firestoreNotificacoes'

const colecaoEntrevistas = collection(db, 'entrevistas')
const statusPermitidos = ['agendada', 'realizada', 'cancelada', 'pendente']

const converterTimestamp = (valor) => {
  if (!valor) return null
  if (typeof valor.toDate === 'function') return valor.toDate().toISOString()
  return valor
}

const mapearEntrevistaDoc = (documento) => {
  if (!documento.exists()) return null

  const data = documento.data()

  return {
    id: documento.id,
    ...data,
    status: data.status || 'agendada',
    criadoEm: converterTimestamp(data.criadoEm),
    atualizadoEm: converterTimestamp(data.atualizadoEm)
  }
}

const ordenarPorAgenda = (primeiraEntrevista, segundaEntrevista) => {
  const dataA = new Date(`${primeiraEntrevista.data || '2100-01-01'}T${primeiraEntrevista.horaInicio || '23:59'}:00`).getTime()
  const dataB = new Date(`${segundaEntrevista.data || '2100-01-01'}T${segundaEntrevista.horaInicio || '23:59'}:00`).getTime()

  return dataA - dataB
}

const normalizarDadosEntrevista = (dados) => ({
  candidatoId: dados.candidatoId || '',
  candidatoNome: dados.candidatoNome || '',
  candidatoEmail: dados.candidatoEmail || '',
  vagaId: dados.vagaId || '',
  vagaTitulo: dados.vagaTitulo || '',
  empresaId: dados.empresaId || '',
  empresaNome: dados.empresaNome || '',
  indicadorId: dados.indicadorId || '',
  indicadorNome: dados.indicadorNome || '',
  data: dados.data || '',
  horaInicio: dados.horaInicio || '',
  horaFim: dados.horaFim || '',
  duracaoMinutos: Number(dados.duracaoMinutos || 45),
  status: statusPermitidos.includes(dados.status) ? dados.status : 'agendada',
  meetTitulo: dados.meetTitulo || '',
  meetUrl: dados.meetUrl || '',
  calendarUrl: dados.calendarUrl || dados.meetUrl || '',
  observacoes: dados.observacoes || ''
})

export const criarEntrevista = async (dados) => {
  const entrevista = normalizarDadosEntrevista(dados)

  if (!entrevista.candidatoId || !entrevista.empresaId || !entrevista.data || !entrevista.horaInicio) {
    throw new Error('Candidato, empresa, data e horário são obrigatórios para agendar entrevista.')
  }

  const docRef = doc(colecaoEntrevistas)
  const batch = writeBatch(db)

  batch.set(docRef, {
    ...entrevista,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp()
  })
  adicionarHistoricoAoBatch(batch, {
    ...entrevista,
    entrevistaId: docRef.id,
    tipo: 'entrevista_agendada',
    titulo: 'Entrevista agendada',
    tituloKey: 'notifications.messages.interview.agendadaTitle',
    descricao: `Entrevista agendada para ${entrevista.data} às ${entrevista.horaInicio}.`,
    descricaoKey: 'candidateProfile.historyEvents.interviewScheduled',
    descricaoParams: {
      date: entrevista.data,
      time: entrevista.horaInicio
    },
    statusAtual: entrevista.status,
    criadoPor: entrevista.empresaId
  })
  await batch.commit()

  const agora = new Date().toISOString()

  const entrevistaCriada = {
    ...entrevista,
    id: docRef.id,
    criadoEm: agora,
    atualizadoEm: agora
  }

  await notificarEntrevistaAlterada({
    entrevista: entrevistaCriada,
    statusAtual: entrevistaCriada.status
  })

  return entrevistaCriada
}

export const listarEntrevistasPorEmpresa = async (empresaId) => {
  if (!empresaId) return []

  const documentos = await getDocs(query(
    colecaoEntrevistas,
    where('empresaId', '==', empresaId),
    limit(200)
  ))

  return documentos.docs.map(mapearEntrevistaDoc).filter(Boolean).sort(ordenarPorAgenda)
}

export const listarEntrevistasPorIndicador = async (indicadorId) => {
  if (!indicadorId) return []

  const documentos = await getDocs(query(
    colecaoEntrevistas,
    where('indicadorId', '==', indicadorId),
    limit(200)
  ))

  return documentos.docs.map(mapearEntrevistaDoc).filter(Boolean).sort(ordenarPorAgenda)
}

export const listarEntrevistasPorCandidato = async (candidatoId) => {
  if (!candidatoId) return []

  const documentos = await getDocs(query(
    colecaoEntrevistas,
    where('candidatoId', '==', candidatoId),
    limit(50)
  ))

  return documentos.docs.map(mapearEntrevistaDoc).filter(Boolean).sort(ordenarPorAgenda)
}

export const listarEntrevistasDoDia = async ({ empresaId, indicadorId, data }) => {
  if (!data) return []

  const entrevistas = empresaId
    ? await listarEntrevistasPorEmpresa(empresaId)
    : await listarEntrevistasPorIndicador(indicadorId)

  return entrevistas.filter((entrevista) => entrevista.data === data)
}

export const buscarEntrevistaPorId = async (id) => {
  if (!id) return null

  const documento = await getDoc(doc(db, 'entrevistas', id))
  return mapearEntrevistaDoc(documento)
}

export const atualizarEntrevista = async (id, dados) => {
  if (!id) {
    throw new Error('ID da entrevista e obrigatório para atualizar.')
  }

  const atualizacoes = {
    ...dados,
    atualizadoEm: serverTimestamp()
  }

  await updateDoc(doc(db, 'entrevistas', id), atualizacoes)

  return {
    id,
    ...dados,
    atualizadoEm: new Date().toISOString()
  }
}

export const atualizarStatusEntrevista = async (id, status) => {
  if (!statusPermitidos.includes(status)) {
    throw new Error('Status de entrevista inválido.')
  }

  const entrevistaAtual = await buscarEntrevistaPorId(id)

  if (!entrevistaAtual) {
    throw new Error('Entrevista não encontrada.')
  }

  const batch = writeBatch(db)
  const atualizadoEm = serverTimestamp()

  batch.update(doc(db, 'entrevistas', id), {
    status,
    atualizadoEm
  })
  adicionarHistoricoAoBatch(batch, {
    ...entrevistaAtual,
    entrevistaId: id,
    tipo: `entrevista_${status}`,
    titulo: {
      agendada: 'Entrevista agendada',
      pendente: 'Entrevista pendente',
      realizada: 'Entrevista realizada',
      cancelada: 'Entrevista cancelada'
    }[status],
    tituloKey: `notifications.messages.interview.${status}Title`,
    descricao: `Status da entrevista alterado de ${entrevistaAtual.status || 'agendada'} para ${status}.`,
    descricaoKey: 'candidateProfile.historyEvents.interviewStatusChanged',
    descricaoParams: {
      fromStatus: entrevistaAtual.status || 'agendada',
      toStatus: status
    },
    statusAnterior: entrevistaAtual.status || 'agendada',
    statusAtual: status,
    criadoPor: entrevistaAtual.empresaId
  })
  await batch.commit()

  const entrevistaAtualizada = {
    id,
    status,
    atualizadoEm: new Date().toISOString()
  }

  if (entrevistaAtual && entrevistaAtual.status !== status) {
    await notificarEntrevistaAlterada({
      entrevista: {
        ...entrevistaAtual,
        ...entrevistaAtualizada,
        status
      },
      statusAnterior: entrevistaAtual.status || 'agendada',
      statusAtual: status
    })
  }

  return entrevistaAtualizada
}

export const cancelarEntrevista = async (id) => atualizarStatusEntrevista(id, 'cancelada')
