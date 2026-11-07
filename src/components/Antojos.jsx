import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { puede, useAuth } from '../lib/auth'
import { useEncargada } from '../lib/apariencia'
import { mensajeError } from '../lib/format'
import { vibrar } from '../lib/tema'
import { Hoja } from './ui'

const RECIENTES_DIAS = 14

// Buzón de antojos: cada quien pide productos y vota por los de otros
export default function Antojos({ onCerrar, avisar, inicial = '' }) {
  const { perfil } = useAuth()
  const encargada = useEncargada()
  const admin = puede(perfil, 'productos')
  const [lista, setLista] = useState(null)
  const [texto, setTexto] = useState(inicial)
  const [enviando, setEnviando] = useState(false)

  const cargar = useCallback(async () => {
    const desde = new Date(Date.now() - RECIENTES_DIAS * 864e5).toISOString()
    const { data, error } = await supabase.from('antojos')
      .select('id, texto, estado, created_at, resuelto_at, antojo_votos(usuario_id)')
      .or(`estado.eq.abierto,and(estado.eq.traido,resuelto_at.gte.${desde})`)
      .order('created_at', { ascending: false }).limit(100)
    if (error) return avisar('error', mensajeError(error))
    setLista(data.map((a) => ({
      ...a,
      votos: a.antojo_votos.length,
      mio: a.antojo_votos.some((v) => v.usuario_id === perfil.id),
    })))
  }, [avisar, perfil.id])

  useEffect(() => { cargar() }, [cargar])

  async function pedir(e) {
    e.preventDefault()
    const t = texto.trim()
    if (t.length < 2) return
    setEnviando(true)
    const { error } = await supabase.rpc('proponer_antojo', { p_texto: t })
    setEnviando(false)
    if (error) return avisar('error', mensajeError(error))
    vibrar([10, 40, 10])
    setTexto('')
    avisar('ok', `¡Listo! ${encargada} verá tu pedido.`)
    cargar()
  }

  async function votar(a) {
    vibrar(8)
    // Cambio inmediato en pantalla; si falla, se recarga
    setLista((l) => l.map((x) => (x.id === a.id ? { ...x, mio: !x.mio, votos: x.votos + (x.mio ? -1 : 1) } : x)))
    const { error } = await supabase.rpc('votar_antojo', { p_id: a.id })
    if (error) { avisar('error', mensajeError(error)); cargar() }
  }

  async function resolver(a, estado) {
    if (estado === 'descartado' && !confirm(`¿Quitar “${a.texto}” de la lista?`)) return
    const { error } = await supabase.rpc('resolver_antojo', { p_id: a.id, p_estado: estado })
    if (error) return avisar('error', mensajeError(error))
    avisar('ok', estado === 'traido' ? 'Les avisamos a quienes lo pidieron. 🎉' : 'Quitado de la lista.')
    cargar()
  }

  const abiertos = (lista ?? []).filter((a) => a.estado === 'abierto').sort((a, b) => b.votos - a.votos || b.id - a.id)
  const traidos = (lista ?? []).filter((a) => a.estado === 'traido')

  return (
    <Hoja titulo="💡 Buzón de antojos" onCerrar={onCerrar}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          ¿Qué quieres que {encargada} traiga? Pídelo o vota por lo que otros pidieron: lo más votado tiene más chance.
        </p>
        <form onSubmit={pedir} className="flex gap-2">
          <input className="input" maxLength={60} placeholder="ej. Takis Fuego, Coca Zero…" value={texto}
            onChange={(e) => setTexto(e.target.value)} />
          <button disabled={enviando || texto.trim().length < 2} className="btn-primario shrink-0 px-4">Pedir</button>
        </form>

        {!lista ? <div className="esqueleto h-24" /> : abiertos.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-3 text-center text-sm text-slate-500">Nadie ha pedido nada todavía. ¡Sé el primero!</p>
        ) : (
          <ul className="space-y-2">
            {abiertos.map((a, i) => (
              <li key={a.id} className="flex items-center gap-2 rounded-xl bg-superficie p-2.5 ring-1 ring-slate-200">
                <span className="w-6 shrink-0 text-center text-sm font-bold text-slate-400">{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>
                <span className="min-w-0 flex-1 text-sm font-semibold text-slate-900">{a.texto}</span>
                {admin && (
                  <>
                    <button onClick={() => resolver(a, 'traido')} aria-label={`Ya traje ${a.texto}`}
                      className="shrink-0 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">✓ Traje</button>
                    <button onClick={() => resolver(a, 'descartado')} aria-label={`Quitar ${a.texto}`}
                      className="shrink-0 rounded-lg px-1.5 py-1 text-xs text-slate-400">✕</button>
                  </>
                )}
                <button onClick={() => votar(a)} aria-pressed={a.mio} aria-label={a.mio ? 'Quitar mi voto' : 'Votar'}
                  className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold transition active:scale-90 ${
                    a.mio ? 'bg-marca text-sobre-marca' : 'bg-slate-100 text-slate-600'}`}>
                  👍 <span className="tabular-nums">{a.votos}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {traidos.length > 0 && (
          <div>
            <p className="etiqueta">🎉 Ya llegaron</p>
            <div className="flex flex-wrap gap-1.5">
              {traidos.map((a) => (
                <span key={a.id} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">{a.texto}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Hoja>
  )
}
