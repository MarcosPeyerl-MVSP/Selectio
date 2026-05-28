import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore'

import { db } from './firebase'

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
    throw new Error('Candidato, empresa, data e horario sao obrigatorios para agendar entrevista.')
  }

  const docRef = await addDoc(colecaoEntrevistas, {
    ...entrevista,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp()
  })

  const agora = new Date().toISOString()

  return {
    ...entrevista,
    id: docRef.id,
    criadoEm: agora,
    atualizadoEm: agora
  }
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
    throw new Error('ID da entrevista e obrigatorio para atualizar.')
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
    throw new Error('Status de entrevista invalido.')
  }

  return atualizarEntrevista(id, { status })
}

export const cancelarEntrevista = async (id) => atualizarStatusEntrevista(id, 'cancelada')
