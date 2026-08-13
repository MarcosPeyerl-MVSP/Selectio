import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where
} from 'firebase/firestore'

import { db } from './firebase'

const historicoCollection = collection(db, 'historicoProcesso')

const converterTimestamp = (valor) => {
  if (!valor) return null
  if (typeof valor.toDate === 'function') return valor.toDate().toISOString()
  return valor
}

const mapearHistorico = (documento) => ({
  id: documento.id,
  ...documento.data(),
  criadoEm: converterTimestamp(documento.data().criadoEm)
})

export const adicionarHistoricoAoBatch = (batch, dados) => {
  const historicoRef = doc(historicoCollection)

  batch.set(historicoRef, {
    candidatoId: dados.candidatoId || '',
    candidatoNome: dados.candidatoNome || '',
    vagaId: dados.vagaId || '',
    vagaTitulo: dados.vagaTitulo || '',
    empresaId: dados.empresaId || '',
    indicadorId: dados.indicadorId || '',
    entrevistaId: dados.entrevistaId || '',
    tipo: dados.tipo,
    titulo: dados.titulo || '',
    tituloKey: dados.tituloKey || '',
    tituloParams: dados.tituloParams || {},
    descricao: dados.descricao || '',
    descricaoKey: dados.descricaoKey || '',
    descricaoParams: dados.descricaoParams || {},
    statusAnterior: dados.statusAnterior || '',
    statusAtual: dados.statusAtual || '',
    criadoPor: dados.criadoPor || '',
    criadoEm: serverTimestamp()
  })

  return historicoRef.id
}

export const listarHistoricoCandidato = async (candidatoId) => {
  if (!candidatoId) return []

  const snapshot = await getDocs(query(
    historicoCollection,
    where('candidatoId', '==', candidatoId),
    limit(100)
  ))

  return snapshot.docs
    .map(mapearHistorico)
    .sort((a, b) => new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0))
}
