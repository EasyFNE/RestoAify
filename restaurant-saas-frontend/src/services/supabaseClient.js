import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Lazy export: only fail if someone actually tries to use Supabase without config.
export const supabase = (url && anonKey)
  ? createClient(url, anonKey)
  : null

export function assertSupabase() {
  if (!supabase) {
    throw new Error(
      'Supabase non configuré. Renseigne VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env, ' +
      'ou bascule VITE_DATA_SOURCE=mock.'
    )
  }
  return supabase
}
