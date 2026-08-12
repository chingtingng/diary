import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { emailToUsername, usernameToEmail } from '../lib/username'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = useCallback(async (username: string, password: string) => {
    if (!supabase) throw new Error('Supabase not configured')
    const email = usernameToEmail(username)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signUp = useCallback(async (username: string, password: string) => {
    if (!supabase) throw new Error('Supabase not configured')
    const normalized = username.trim().toLowerCase()
    const email = usernameToEmail(normalized)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: normalized },
      },
    })
    if (error) throw error
    // If email confirmation is required, session will be null
    if (!data.session) {
      throw new Error(
        'Account created, but email confirmation is still on in Supabase. Turn off Confirm email under Authentication → Providers → Email, then sign in.'
      )
    }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const username =
    (user?.user_metadata?.username as string | undefined) ||
    emailToUsername(user?.email)

  return {
    user,
    username,
    loading,
    signIn,
    signUp,
    signOut,
    isSupabaseConfigured,
  }
}
