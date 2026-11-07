import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

// Llama a una Edge Function y devuelve los datos, o lanza un Error con el mensaje en español
export async function invocar(nombre, body) {
  const { data, error } = await supabase.functions.invoke(nombre, { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const detalle = await error.context.json().catch(() => null)
      throw new Error(detalle?.error || 'No se pudo completar la acción.')
    }
    throw new Error('Sin conexión con el servidor. Intenta de nuevo.')
  }
  return data
}

export const pinAleatorio = () =>
  String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0')
