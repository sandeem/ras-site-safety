// One shared Supabase client for the whole app.
// The URL and anon key come from environment variables (see .env.example).
// The anon key is safe in the browser: it can only do what the RLS policies allow.

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null
