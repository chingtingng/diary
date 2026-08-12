const USERNAME_DOMAIN = 'diary.local'

/** Normalize and validate a username. Throws if invalid. */
export function normalizeUsername(raw: string): string {
  const username = raw.trim().toLowerCase()

  if (!username) {
    throw new Error('Username is required')
  }
  if (username.length < 3) {
    throw new Error('Username must be at least 3 characters')
  }
  if (username.length > 30) {
    throw new Error('Username must be 30 characters or fewer')
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    throw new Error('Username can only contain letters, numbers, and underscores')
  }

  return username
}

/** Supabase Auth requires an email — map username to a synthetic one. */
export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${USERNAME_DOMAIN}`
}

export function emailToUsername(email: string | undefined): string | undefined {
  if (!email) return undefined
  if (email.endsWith(`@${USERNAME_DOMAIN}`)) {
    return email.slice(0, -(USERNAME_DOMAIN.length + 1))
  }
  return email
}
