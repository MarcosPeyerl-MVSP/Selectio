import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions'
import app from './firebase'

const functions = getFunctions(app, 'southamerica-east1')
if (import.meta.env.DEV && import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === 'true') {
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
}
const call = httpsCallable(functions, 'assistenteCandidatosApi', { timeout: 120000 })
export const chamarAssistente = async (payload) => (await call(payload)).data
