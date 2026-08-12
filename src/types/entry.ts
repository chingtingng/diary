export interface Entry {
  id: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface EntryRow {
  id: string
  user_id: string
  content: string
  created_at: string
  updated_at: string
}

export function rowToEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
