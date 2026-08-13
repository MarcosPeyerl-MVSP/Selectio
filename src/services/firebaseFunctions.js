import { auth } from './firebase'

const functionsRegion = 'southamerica-east1'
const firebaseProjectId = String(import.meta.env.VITE_FIREBASE_PROJECT_ID || '').trim()
const configuredBackendUrl = String(import.meta.env.VITE_MERCADO_PAGO_API_URL || '').trim()
const useFunctionsEmulator = import.meta.env.DEV
  && String(import.meta.env.VITE_USE_FUNCTIONS_EMULATOR || 'false') === 'true'

const functionsApiUrl = configuredBackendUrl || (
  useFunctionsEmulator
    ? `http://127.0.0.1:5001/${firebaseProjectId}/${functionsRegion}/mercadoPagoApi`
    : `https://${functionsRegion}-${firebaseProjectId}.cloudfunctions.net/mercadoPagoApi`
)

export const obterFunctionsApiUrl = () => functionsApiUrl

export const chamarFirebaseFunction = async (caminho, payload, fallback) => {
  if (!functionsApiUrl) throw new Error('Cloud Function não configurada.')

  const currentUser = auth.currentUser
  if (!currentUser) throw new Error('Sua sessão expirou. Entre novamente para continuar.')

  const idToken = await currentUser.getIdToken()
  let resposta

  try {
    resposta = await fetch(`${functionsApiUrl}${caminho}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
  } catch {
    throw new Error(`API indisponível em ${functionsApiUrl}.`)
  }

  const dados = await resposta.json().catch(() => ({}))
  if (!resposta.ok) throw new Error(dados.error || fallback)
  return dados
}
