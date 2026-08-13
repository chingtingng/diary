import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Accept common paste mistakes (trailing /rest/v1, quotes, whitespace)
 * and rebuild a clean project URL: https://<ref>.supabase.co
 */
function normalizeSupabaseUrl(raw: string | undefined): string | null {
  if (!raw) return null
  const cleaned = raw.trim().replace(/^["']|["']$/g, '')
  const match = cleaned.match(/([a-z0-9-]+)\.supabase\.co/i)
  if (!match) {
    console.error(
      '[daybook] VITE_SUPABASE_URL must contain <project-ref>.supabase.co — got:',
      raw
    )
    return null
  }
  return `https://${match[1].toLowerCase()}.supabase.co`
}

function normalizeKey(raw: string | undefined): string | null {
  if (!raw) return null
  // Newlines / spaces in Vercel env values cause: Failed to execute 'fetch': Invalid value
  const key = raw.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '')
  return key || null
}

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL)
const supabaseAnonKey = normalizeKey(import.meta.env.VITE_SUPABASE_ANON_KEY)

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null

if (import.meta.env.DEV && isSupabaseConfigured) {
  console.info('[daybook] Supabase URL:', supabaseUrl)
}
