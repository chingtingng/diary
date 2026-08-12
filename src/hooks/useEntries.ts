import { useCallback, useEffect, useState } from 'react'
import type { Entry } from '../types/entry'
import {
  createEntry,
  deleteEntry,
  fetchEntries,
  getStorageMode,
  updateEntry,
} from '../lib/storage'

export function useEntries(userId?: string) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const mode = getStorageMode()
    if (mode === 'supabase' && !userId) {
      setEntries([])
      setLoading(false)
      return
    }

    try {
      setError(null)
      const data = await fetchEntries(userId)
      setEntries(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entries')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  const addEntry = useCallback(async () => {
    const entry = await createEntry(userId)
    setEntries((prev) => [entry, ...prev])
    return entry
  }, [userId])

  const saveEntry = useCallback(
    async (id: string, content: string) => {
      const updated = await updateEntry(id, content, userId)
      setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)))
      return updated
    },
    [userId]
  )

  const removeEntry = useCallback(
    async (id: string) => {
      await deleteEntry(id, userId)
      setEntries((prev) => prev.filter((e) => e.id !== id))
    },
    [userId]
  )

  return {
    entries,
    loading,
    error,
    addEntry,
    saveEntry,
    removeEntry,
    reload: load,
    storageMode: getStorageMode(),
  }
}
