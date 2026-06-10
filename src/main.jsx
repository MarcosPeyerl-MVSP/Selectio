import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.jsx'
import ToastProvider from './components/ui/ToastProvider.jsx'
import { ProvedorConfirmacao } from './components/ui/DialogoConfirmacao.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <ProvedorConfirmacao>
        <App />
      </ProvedorConfirmacao>
    </ToastProvider>
  </StrictMode>,
)
