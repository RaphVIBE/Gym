import { createClient } from '@supabase/supabase-js'

// The publishable (anon) key is safe to ship in the browser: access is
// governed by Row Level Security policies on the database. Values can be
// overridden per-environment via VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://utdxignykkpgszdoudqm.supabase.co'
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_wl9VuEwfQpRXnwN5i97M7A_bzSUknV2'

export const supabase = createClient(url, anonKey)
