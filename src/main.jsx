import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './lib/auth.jsx'
import { AparienciaProvider } from './lib/apariencia.jsx'
import { temaInicial } from './lib/tema'

temaInicial()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AparienciaProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </AparienciaProvider>
  </StrictMode>,
)

// Hace la app instalable y permite notificaciones (solo en producción)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
