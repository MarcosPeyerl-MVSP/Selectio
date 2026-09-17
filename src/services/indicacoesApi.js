import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions'
import app from './firebase'
import { enviarCurriculo } from './storageCurriculos'

const functions = getFunctions(app, 'southamerica-east1')
if (import.meta.env.DEV && import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === 'true') {
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
}
const chamar = httpsCallable(functions, 'indicacoesApi', { timeout: 120000 })

export const analisarIndicacao = async ({ dados, indicadorId, vagaId, candidatoPreSalvoId = '', arquivoCurriculo }) => {
  const curriculo = arquivoCurriculo ? await enviarCurriculo({
    arquivo: arquivoCurriculo, indicadorId, registroId: crypto.randomUUID(), tipoRegistro: 'temporarios'
  }) : dados.curriculo
  const curriculoCaminho = curriculo?.caminho || ''
  const resposta = await chamar({ acao: 'analisar', dados, vagaId, candidatoPreSalvoId, curriculoCaminho })
  return { ...resposta.data, curriculoCaminho }
}

export const finalizarIndicacaoValidada = async (payload) => (await chamar({ ...payload, acao: 'finalizar' })).data
