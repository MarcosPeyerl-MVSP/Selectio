import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore'

import { db } from './firebase'

const notificacoesCollection = collection(db, 'notificacoes')

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

export const marcarNotificacaoComoLida = async (notificationId) => {
  if (!notificationId) return

  await updateDoc(doc(db, 'notificacoes', notificationId), {
    lida: true,
    lidaEm: serverTimestamp()
  })
}
