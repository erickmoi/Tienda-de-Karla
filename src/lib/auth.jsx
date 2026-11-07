import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { aplicarModo } from './tema'
import { desactivarPush } from './push'
import { olvidarActividadAdmin } from './acceso'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = cargando
  const [perfil, setPerfil] = useState(null)
  const [cargandoPerfil, setCargandoPerfil] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    // No hacer llamadas a Supabase dentro de este callback (evita bloqueos)
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const cargarPerfil = useCallback(async () => {
    if (!session?.user) {
      setPerfil(null)
      return
    }
    setCargandoPerfil(true)
    const { data } = await supabase
      .from('perfiles')
      .select('id, usuario, nombre, rol, permisos, activo, aprobado, limite_deuda, tema, telefono, tutorial_visto')
      .eq('id', session.user.id)
      .maybeSingle()
    setPerfil(data)
    setCargandoPerfil(false)
  }, [session?.user?.id])

  useEffect(() => {
    cargarPerfil()
  }, [cargarPerfil])

  // El modo claro/oscuro sigue la preferencia guardada del usuario
  useEffect(() => {
    if (perfil?.tema) aplicarModo(perfil.tema)
  }, [perfil?.tema])

  const salir = async () => {
    await desactivarPush().catch(() => {})
    olvidarActividadAdmin()
    await supabase.auth.signOut()
  }

  // Cierra la sesión en todos los dispositivos y apaga los avisos en todos ellos
  const salirDeTodo = async () => {
    await desactivarPush().catch(() => {})
    if (session?.user) await supabase.from('push_suscripciones').delete().eq('usuario_id', session.user.id)
    olvidarActividadAdmin()
    const { error } = await supabase.auth.signOut({ scope: 'global' })
    if (error) await supabase.auth.signOut({ scope: 'local' })
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        perfil,
        // Solo pantalla de carga la primera vez; recargar el perfil no la vuelve a mostrar
        cargando: session === undefined || (cargandoPerfil && !perfil),
        recargarPerfil: cargarPerfil,
        salir,
        salirDeTodo,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

// ¿Este perfil puede hacer X? (mismo criterio que la base de datos)
export function puede(perfil, permiso) {
  if (!perfil?.activo) return false
  if (perfil.rol === 'superadmin' || perfil.rol === 'admin') return true
  return perfil.rol === 'colaborador' && perfil.permisos?.includes(permiso)
}

export const esPersonal = (perfil) =>
  ['superadmin', 'admin', 'colaborador'].includes(perfil?.rol) && perfil?.activo

export const esJefatura = (perfil) => ['superadmin', 'admin'].includes(perfil?.rol) && perfil?.activo
