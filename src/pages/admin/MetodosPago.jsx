import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { mensajeError } from '../../lib/format'
import { borrarQR, subirQR } from '../../lib/fotos'
import { olvidarCuentas, tipoCuenta, urlQR } from '../../components/Cuentas'
import { Hoja, Interruptor } from '../../components/ui'

const VACIA = { banco: '', tipo_cuenta: 'ahorro', numero: '', titular: '', nota: '', qr_path: null, activo: true }

export default function MetodosPago({ avisar }) {
  const [cuentas, setCuentas] = useState(null)
  const [editando, setEditando] = useState(null)

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from('metodos_pago').select('*').order('orden').order('id')
    if (error) return avisar('error', mensajeError(error))
    setCuentas(data)
    olvidarCuentas()
  }, [avisar])

  useEffect(() => { cargar() }, [cargar])

  async function mover(c, dir) {
    const i = cuentas.findIndex((x) => x.id === c.id)
    const otro = cuentas[i + dir]
    if (!otro) return
    await Promise.all([
      supabase.from('metodos_pago').update({ orden: i + dir }).eq('id', c.id),
      supabase.from('metodos_pago').update({ orden: i }).eq('id', otro.id),
    ])
    cargar()
  }

  return (
    <section className="tarjeta space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-900">🏦 Métodos de pago</h3>
        <button onClick={() => setEditando({ ...VACIA, orden: cuentas?.length ?? 0 })} className="btn-primario py-1.5 text-sm">+ Cuenta</button>
      </div>
      <p className="text-xs text-slate-500">
        Aparecen cuando alguien elige “Ya pagué → Transferencia” y en Mi cuenta → “Cómo pagar”. Cada quien elige a qué cuenta pagó.
      </p>
      {!cuentas ? <div className="esqueleto h-16" /> : cuentas.length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Aún no hay cuentas. Agrega la primera.</p>
      ) : (
        <ul className="space-y-2">
          {cuentas.map((c, i) => (
            <li key={c.id} className={`flex items-center gap-2 rounded-xl p-2.5 ring-1 ring-slate-200 ${c.activo ? '' : 'opacity-50'}`}>
              <div className="flex flex-col">
                <button type="button" onClick={() => mover(c, -1)} disabled={i === 0} className="px-1 text-xs text-slate-500 disabled:opacity-20" aria-label="Subir">▲</button>
                <button type="button" onClick={() => mover(c, 1)} disabled={i === cuentas.length - 1} className="px-1 text-xs text-slate-500 disabled:opacity-20" aria-label="Bajar">▼</button>
              </div>
              <button type="button" onClick={() => setEditando(c)} className="min-w-0 flex-1 text-left">
                <p className="truncate font-semibold text-slate-900">🏦 {c.banco}{c.qr_path ? ' · 🔳' : ''}</p>
                <p className="truncate text-xs text-slate-500">{tipoCuenta(c.tipo_cuenta)} · {c.numero} · {c.titular}{!c.activo && ' · oculta'}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
      {editando && (
        <EditarCuenta cuenta={editando} avisar={avisar} onCerrar={() => setEditando(null)}
          onGuardado={() => { setEditando(null); cargar() }} />
      )}
    </section>
  )
}

function EditarCuenta({ cuenta, avisar, onCerrar, onGuardado }) {
  const nueva = !cuenta.id
  const [f, setF] = useState({ ...cuenta, nota: cuenta.nota ?? '' })
  const [archivo, setArchivo] = useState(null)
  const [vista, setVista] = useState(null)
  const [quitarQR, setQuitarQR] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  useEffect(() => {
    if (cuenta.qr_path) urlQR(cuenta.qr_path).then(setVista).catch(() => {})
  }, [cuenta.qr_path])

  async function guardar(e) {
    e.preventDefault()
    if (!f.banco.trim() || !f.numero.trim() || !f.titular.trim()) return avisar('error', 'Completa banco, número y titular.')
    setGuardando(true)
    try {
      let qr_path = f.qr_path
      if (archivo) qr_path = await subirQR(archivo)
      if (quitarQR && !archivo) qr_path = null
      const fila = {
        banco: f.banco.trim(), tipo_cuenta: f.tipo_cuenta, numero: f.numero.trim(), titular: f.titular.trim(),
        nota: f.nota.trim() || null, qr_path, activo: f.activo, orden: f.orden ?? 0,
      }
      const { error } = nueva
        ? await supabase.from('metodos_pago').insert(fila)
        : await supabase.from('metodos_pago').update(fila).eq('id', cuenta.id)
      if (error) throw error
      if (cuenta.qr_path && qr_path !== cuenta.qr_path) await borrarQR(cuenta.qr_path).catch(() => {})
      avisar('ok', nueva ? 'Cuenta agregada.' : 'Cuenta actualizada.')
      onGuardado()
    } catch (err) {
      avisar('error', mensajeError(err))
    } finally {
      setGuardando(false)
    }
  }

  async function borrar() {
    if (!confirm(`¿Borrar la cuenta de ${cuenta.banco}? Los pagos pasados no se afectan.`)) return
    const { error } = await supabase.from('metodos_pago').delete().eq('id', cuenta.id)
    if (error) return avisar('error', mensajeError(error))
    await borrarQR(cuenta.qr_path).catch(() => {})
    avisar('ok', 'Cuenta borrada.')
    onGuardado()
  }

  return (
    <Hoja titulo={nueva ? 'Nueva cuenta' : `Editar ${cuenta.banco}`} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="space-y-3">
        <div>
          <label className="etiqueta" htmlFor="cbanco">Banco o app</label>
          <input id="cbanco" className="input" maxLength={40} placeholder="ej. Banco Agrícola" value={f.banco} onChange={set('banco')} />
        </div>
        <div>
          <label className="etiqueta" htmlFor="ctipo">Tipo</label>
          <select id="ctipo" className="input" value={f.tipo_cuenta} onChange={set('tipo_cuenta')}>
            <option value="ahorro">Cuenta de ahorro</option>
            <option value="corriente">Cuenta corriente</option>
            <option value="billetera">Billetera / app (número de teléfono)</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div>
          <label className="etiqueta" htmlFor="cnum">Número de cuenta {f.tipo_cuenta === 'billetera' ? 'o teléfono' : ''}</label>
          <input id="cnum" className="input font-mono" maxLength={40} inputMode="numeric" value={f.numero} onChange={set('numero')} />
        </div>
        <div>
          <label className="etiqueta" htmlFor="ctit">A nombre de</label>
          <input id="ctit" className="input" maxLength={60} placeholder="ej. Karla Pérez" value={f.titular} onChange={set('titular')} />
        </div>
        <div>
          <label className="etiqueta" htmlFor="cnota">Nota (opcional)</label>
          <input id="cnota" className="input" maxLength={120} placeholder="ej. Pon tu nombre en el concepto" value={f.nota} onChange={set('nota')} />
        </div>

        <div>
          <p className="etiqueta">Código QR (opcional)</p>
          <div className="flex items-center gap-3">
            <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-3xl">
              {!quitarQR && vista ? <img src={vista} alt="QR" className="h-full w-full object-contain" /> : '🔳'}
            </span>
            <div className="flex flex-col gap-2">
              <label className="btn-secundario cursor-pointer py-1.5 text-center text-sm">
                {vista && !quitarQR ? 'Cambiar QR' : 'Subir QR'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const a = e.target.files?.[0]
                  if (a) { setArchivo(a); setVista(URL.createObjectURL(a)); setQuitarQR(false) }
                }} />
              </label>
              {vista && !quitarQR && (
                <button type="button" onClick={() => { setArchivo(null); setQuitarQR(true) }} className="text-sm font-semibold text-red-600">Quitar QR</button>
              )}
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-500">Toma captura del QR en tu app del banco. Solo lo ven quienes tienen cuenta en la tienda.</p>
        </div>

        <Interruptor activo={f.activo} onCambio={(v) => setF({ ...f, activo: v })} etiqueta="Mostrar esta cuenta" />
        <button disabled={guardando} className="btn-primario w-full">{guardando ? 'Guardando…' : 'Guardar cuenta'}</button>
        {!nueva && <button type="button" onClick={borrar} className="w-full py-2 text-sm font-semibold text-red-600">Borrar cuenta</button>}
      </form>
    </Hoja>
  )
}
