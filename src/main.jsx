import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './lib/auth.jsx'
import { AparienciaProvider } from './lib/apariencia.jsx'
import { temaInicial } from './lib/tema'
import { escucharInstalacion } from './lib/instalar'
import Instalar from './pages/Instalar.jsx'
import AvisoActualizacion from './components/AvisoActualizacion.jsx'

temaInicial()
escucharInstalacion()

// /instalar es una página pública (se comparte por WhatsApp antes de tener cuenta)
const esGuia = window.location.pathname.replace(/\/$/, '') === '/instalar'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AparienciaProvider>
      <AvisoActualizacion />
      {esGuia ? <Instalar /> : (
        <AuthProvider>
          <App />
        </AuthProvider>
      )}
    </AparienciaProvider>
  </StrictMode>,
)

// Hace la app instalable y permite notificaciones (solo en producción)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
