import { createClient, SupabaseClient } from '@supabase/supabase-js'

/** Trim quotes/whitespace and strip accidental /rest/v1 paths from the project URL. */
function normalizeSupabaseUrl(raw: string | undefined): string | null {
  if (!raw) return null
  let url = raw.trim().replace(/^["']|["']$/g, '')
  url = url.replace(/\/rest\/v1\/?$/i, '')
  url = url.replace(/\/+$/, '')
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
    console.error(
      '[diary] VITE_SUPABASE_URL looks wrong. Expected https://xxxx.supabase.co — got:',
      raw
    )
  }
  return url
}

function normalizeKey(raw: string | undefined): string | null {
  if (!raw) return null
  // Newlines / spaces in Vercel env values cause: Failed to execute 'fetch': Invalid value
  return raw.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '')
}

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL)
const supabaseAnonKey = normalizeKey(import.meta.env.VITE_SUPABASE_ANON_KEY)

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== 'https://your-project.supabase.co' &&
    supabaseAnonKey !== 'your-anon-key'
)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null
