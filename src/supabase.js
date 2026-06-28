import { createClient } from '@supabase/supabase-js'

// The publishable (anon) key is safe to ship in the browser: access is
// governed by Row Level Security policies on the database. Values can be
// overridden per-environment via VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://utdxignykkpgszdoudqm.supabase.co'
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_wl9VuEwfQpRXnwN5i97M7A_bzSUknV2'

// "Rester connecté" — when on (default), the auth token lives in localStorage and
// survives app restarts. When off, it lives in sessionStorage and is cleared when
// the app/tab is fully closed. AuthScreen writes the KEEP flag before signing in.
export const KEEP_KEY = 'pulse-keep'
const hasWindow = typeof window !== 'undefined'

const hybridStorage = {
  getItem: (k) => {
    if (!hasWindow) return null
    try { return window.localStorage.getItem(k) ?? window.sessionStorage.getItem(k) } catch { return null }
  },
  setItem: (k, v) => {
    if (!hasWindow) return
    try {
      const keep = window.localStorage.getItem(KEEP_KEY) !== '0'
      if (keep) { window.localStorage.setItem(k, v); window.sessionStorage.removeItem(k) }
      else { window.sessionStorage.setItem(k, v); window.localStorage.removeItem(k) }
    } catch { /* storage unavailable */ }
  },
  removeItem: (k) => {
    if (!hasWindow) return
    try { window.localStorage.removeItem(k); window.sessionStorage.removeItem(k) } catch { /* */ }
  },
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'pulse-auth',
    storage: hybridStorage,
  },
})
