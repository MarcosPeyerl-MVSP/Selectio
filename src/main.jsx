import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './styles/global.css'
import App from './App.jsx'
import AuthProvider from './components/auth/AuthProvider.jsx'
import ToastProvider from './components/ui/ToastProvider.jsx'
import { ProvedorConfirmacao } from './components/ui/DialogoConfirmacao.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <ToastProvider>
        <ProvedorConfirmacao>
          <App />
        </ProvedorConfirmacao>
      </ToastProvider>
    </AuthProvider>
  </StrictMode>,
)
