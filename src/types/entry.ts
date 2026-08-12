import type { MoodId } from '../lib/moods'

export interface Entry {
  id: string
  content: string
  mood: MoodId | null
  createdAt: string
  updatedAt: string
}

export interface EntryRow {
  id: string
  user_id: string
  content: string
  mood: MoodId | null
  created_at: string
  updated_at: string
}

export function rowToEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    content: row.content,
    mood: row.mood ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export type EntryPatch = {
  content?: string
  mood?: MoodId | null
}
