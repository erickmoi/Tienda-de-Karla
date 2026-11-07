import { useState } from 'react'
import { supabase, emailDe, normalizarUsuario } from '../lib/supabase'
import { mensajeError } from '../lib/format'

export default function Login() {
  const [modo, setModo] = useState('entrar') // 'entrar' | 'crear'
  const [usuario, setUsuario] = useState('')
  const [nombre, setNombre] = useState('')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const soloDigitos = (v) => v.replace(/\D/g, '').slice(0, 6)

  async function enviar(e) {
    e.preventDefault()
    setError('')
    const u = normalizarUsuario(usuario)
    if (!/^[a-z0-9._]{3,30}$/.test(u))
      return setError('El usuario debe tener de 3 a 30 letras, números, punto o guion bajo (sin espacios).')
    if (!/^\d{6}$/.test(pin)) return setError('El PIN debe tener 6 dígitos.')

    setEnviando(true)
    try {
      if (modo === 'crear') {
        if (!nombre.trim()) throw new Error('Escribe tu nombre.')
        if (pin !== pin2) throw new Error('Los PIN no coinciden.')
        const { error } = await supabase.auth.signUp({
          email: emailDe(u),
          password: pin,
          options: { data: { usuario: u, nombre: nombre.trim() } },
        })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: emailDe(u), password: pin })
        if (error) throw error
      }
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-marca to-indigo-700 px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
        <div className="mb-6 text-center">
          <div className="text-4xl">🍿</div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Tienda de Karla</h1>
          <p className="text-sm text-slate-500">Anota lo que tomas y paga después</p>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
          {['entrar', 'crear'].map((m) => (
            <button
              key={m}
              onClick={() => { setModo(m); setError('') }}
              className={`rounded-lg py-2 ${modo === m ? 'bg-white text-marca shadow' : 'text-slate-500'}`}
            >
              {m === 'entrar' ? 'Entrar' : 'Crear cuenta'}
            </button>
          ))}
        </div>

        <form onSubmit={enviar} className="space-y-4">
          <div>
            <label className="etiqueta" htmlFor="usuario">Usuario</label>
            <input id="usuario" className="input" autoCapitalize="none" autoCorrect="off" autoComplete="username"
              placeholder="ej. maria.lopez" value={usuario} onChange={(e) => setUsuario(e.target.value)} />
          </div>
          {modo === 'crear' && (
            <div>
              <label className="etiqueta" htmlFor="nombre">Tu nombre (como te conocen)</label>
              <input id="nombre" className="input" maxLength={60} placeholder="ej. María López"
                value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
          )}
          <div>
            <label className="etiqueta" htmlFor="pin">PIN de 6 dígitos</label>
            <input id="pin" className="input tracking-[0.5em]" type="password" inputMode="numeric"
              autoComplete={modo === 'crear' ? 'new-password' : 'current-password'}
              value={pin} onChange={(e) => setPin(soloDigitos(e.target.value))} />
          </div>
          {modo === 'crear' && (
            <div>
              <label className="etiqueta" htmlFor="pin2">Repite el PIN</label>
              <input id="pin2" className="input tracking-[0.5em]" type="password" inputMode="numeric"
                autoComplete="new-password" value={pin2} onChange={(e) => setPin2(soloDigitos(e.target.value))} />
            </div>
          )}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button type="submit" disabled={enviando} className="btn-primario w-full">
            {enviando ? 'Un momento…' : modo === 'entrar' ? 'Entrar' : 'Crear mi cuenta'}
          </button>
          {modo === 'entrar' && (
            <p className="text-center text-xs text-slate-500">¿Olvidaste tu PIN? Pídele a la encargada que lo restablezca.</p>
          )}
        </form>
      </div>
    </div>
  )
}
