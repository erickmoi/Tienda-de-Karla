import { Logo, useApariencia } from '../lib/apariencia'
import GuiaInstalar from '../components/GuiaInstalar'

// Página pública (sin iniciar sesión): tienditadekarla.netlify.app/instalar
export default function Instalar() {
  const { apariencia } = useApariencia()
  return (
    <div className="min-h-screen bg-gradient-to-b from-marca to-marca-oscuro px-4 py-8">
      <div className="animar-entrada mx-auto w-full max-w-sm rounded-3xl bg-superficie p-6 shadow-xl">
        <div className="mb-5 flex flex-col items-center text-center">
          <Logo className="animar-pop h-16 w-16 text-5xl" />
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{apariencia.nombre_tienda}</h1>
          <p className="text-sm text-slate-500">Instala la app en tu celular en 30 segundos</p>
        </div>
        <GuiaInstalar onInstalada={() => window.location.assign('/')} />
        <a href="/" className="btn-secundario mt-5 block w-full text-center">Abrir la tienda →</a>
        <p className="mt-3 text-center text-xs text-slate-500">
          ¿Dudas? Pregúntale a {apariencia.nombre_encargada}.
        </p>
      </div>
    </div>
  )
}
