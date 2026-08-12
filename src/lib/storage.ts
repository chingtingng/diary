import type { Entry, EntryPatch, EntryRow } from '../types/entry'
import { rowToEntry } from '../types/entry'
import { isSupabaseConfigured, supabase } from './supabase'

const LOCAL_STORAGE_KEY = 'diary-entries'

function readLocalEntries(): Entry[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Entry[]
    return parsed.map((e) => ({ ...e, mood: e.mood ?? null }))
  } catch {
    return []
  }
}

function writeLocalEntries(entries: Entry[]) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(entries))
}

function generateId(): string {
  return crypto.randomUUID()
}

export type StorageMode = 'supabase' | 'local'

export function getStorageMode(): StorageMode {
  return isSupabaseConfigured ? 'supabase' : 'local'
}

export async function fetchEntries(userId?: string): Promise<Entry[]> {
  if (getStorageMode() === 'local') {
    return readLocalEntries().sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  if (!supabase || !userId) return []

  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data as EntryRow[]).map(rowToEntry)
}

export async function createEntry(
  userId?: string,
  createdAt?: string
): Promise<Entry> {
  const now = createdAt ?? new Date().toISOString()

  if (getStorageMode() === 'local') {
    const entry: Entry = {
      id: generateId(),
      content: '',
      mood: null,
      createdAt: now,
      updatedAt: now,
    }
    const entries = readLocalEntries()
    entries.unshift(entry)
    writeLocalEntries(entries)
    return entry
  }

  if (!supabase || !userId) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('entries')
    .insert({ user_id: userId, content: '', mood: null, created_at: now })
    .select()
    .single()

  if (error) throw error
  return rowToEntry(data as EntryRow)
}

export async function updateEntry(
  id: string,
  patch: EntryPatch,
  userId?: string
): Promise<Entry> {
  if (getStorageMode() === 'local') {
    const entries = readLocalEntries()
    const index = entries.findIndex((e) => e.id === id)
    if (index === -1) throw new Error('Entry not found')

    const updated: Entry = {
      ...entries[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    entries[index] = updated
    writeLocalEntries(entries)
    return updated
  }

  if (!supabase || !userId) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('entries')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error
  return rowToEntry(data as EntryRow)
}

export async function deleteEntry(id: string, userId?: string): Promise<void> {
  if (getStorageMode() === 'local') {
    const entries = readLocalEntries().filter((e) => e.id !== id)
    writeLocalEntries(entries)
    return
  }

  if (!supabase || !userId) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('entries')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error
}

export async function getEntry(id: string, userId?: string): Promise<Entry | null> {
  if (getStorageMode() === 'local') {
    return readLocalEntries().find((e) => e.id === id) ?? null
  }

  if (!supabase || !userId) return null

  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error) return null
  return rowToEntry(data as EntryRow)
}
