import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where
} from 'firebase/firestore'
import { db } from './firebase'

const colecaoAnalises = collection(db, 'analisesCompatibilidade')

export const idAnaliseCompatibilidade = (vagaId, candidatoId) => `${vagaId}__${candidatoId}`

const timestampParaValor = (valor) => {
  if (!valor) return null
  if (typeof valor.toDate === 'function') return valor.toDate().toISOString()
  return valor
}

const mapearAnalise = (snapshot) => ({
  id: snapshot.id,
  ...snapshot.data(),
  criadoEm: timestampParaValor(snapshot.data().criadoEm),
  atualizadoEm: timestampParaValor(snapshot.data().atualizadoEm)
})

export const listarAnalisesPorEmpresa = async (empresaId) => {
  if (!empresaId) return []
  const snapshot = await getDocs(query(
    colecaoAnalises,
    where('empresaId', '==', empresaId),
    limit(500)
  ))
  return snapshot.docs.map(mapearAnalise)
}

export const salvarAnaliseCompatibilidade = async ({ candidato, vaga, empresaId, resultado }) => {
  if (!candidato?.id || !vaga?.id || !empresaId) {
    throw new Error('Candidato, vaga e empresa sao obrigatorios para salvar a analise.')
  }

  const analiseId = idAnaliseCompatibilidade(vaga.id, candidato.id)
  await setDoc(doc(colecaoAnalises, analiseId), {
    candidatoId: candidato.id,
    candidatoNome: String(candidato.nome || ''),
    vagaId: vaga.id,
    vagaTitulo: String(vaga.titulo || candidato.vagaTitulo || ''),
    empresaId,
    indicadorId: String(candidato.indicadorId || candidato.indicadorUid || ''),
    status: 'concluida',
    nota: Number(resultado.nota || 0),
    cobertura: Number(resultado.cobertura || 0),
    requerRevisao: Boolean(resultado.requerRevisao),
    criterios: Array.isArray(resultado.criterios) ? resultado.criterios : [],
    alertas: Array.isArray(resultado.alertas) ? resultado.alertas : [],
    discrepancias: Array.isArray(resultado.discrepancias) ? resultado.discrepancias : [],
    extracao: resultado.extracao || {},
    semantica: resultado.semantica || {},
    versao: String(resultado.versao || ''),
    rubricaVersao: Number(vaga.rubricaCompatibilidade?.versao || 1),
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp()
  })

  return { id: analiseId, ...resultado, candidatoId: candidato.id, vagaId: vaga.id, empresaId }
}
