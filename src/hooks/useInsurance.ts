import { useCallback, useEffect, useState } from 'react'
import type {
  InsuranceDocument,
  InsuranceDocumentInput,
  InsurancePolicy,
  InsurancePolicyInput,
  InsurancePolicyPatch,
} from '../types/insurance'
import {
  createPolicy,
  deleteDocument,
  deletePolicy,
  fetchDocuments,
  fetchPolicies,
  getDocumentUrl,
  renameDocument,
  updatePolicy,
  uploadDocument,
} from '../lib/insuranceStorage'
import { getStorageMode } from '../lib/storage'

export function useInsurance(userId?: string) {
  const [policies, setPolicies] = useState<InsurancePolicy[]>([])
  const [documents, setDocuments] = useState<InsuranceDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const mode = getStorageMode()
    if (mode === 'supabase' && !userId) {
      setPolicies([])
      setDocuments([])
      setLoading(false)
      return
    }

    try {
      setError(null)
      const [nextPolicies, nextDocuments] = await Promise.all([
        fetchPolicies(userId),
        fetchDocuments(userId),
      ])
      setPolicies(nextPolicies)
      setDocuments(nextDocuments)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load insurance data')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  const addPolicy = useCallback(
    async (input: InsurancePolicyInput) => {
      const policy = await createPolicy(input, userId)
      setPolicies((prev) =>
        [...prev, policy].sort((a, b) => {
          const aTime = a.renewalDate
            ? new Date(a.renewalDate).getTime()
            : Number.POSITIVE_INFINITY
          const bTime = b.renewalDate
            ? new Date(b.renewalDate).getTime()
            : Number.POSITIVE_INFINITY
          return aTime - bTime
        })
      )
      return policy
    },
    [userId]
  )

  const savePolicy = useCallback(
    async (id: string, patch: InsurancePolicyPatch) => {
      const updated = await updatePolicy(id, patch, userId)
      setPolicies((prev) => prev.map((p) => (p.id === id ? updated : p)))
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.policyId === id
            ? { ...doc, insurer: updated.insurer, policyName: updated.policyName }
            : doc
        )
      )
      return updated
    },
    [userId]
  )

  const removePolicy = useCallback(
    async (id: string) => {
      await deletePolicy(id, userId)
      setPolicies((prev) => prev.filter((p) => p.id !== id))
      setDocuments((prev) =>
        prev.map((doc) => (doc.policyId === id ? { ...doc, policyId: null } : doc))
      )
    },
    [userId]
  )

  const addDocument = useCallback(
    async (input: InsuranceDocumentInput) => {
      const result = await uploadDocument(input, userId)
      if (result.policy) {
        setPolicies((prev) => [...prev, result.policy!])
      }
      setDocuments((prev) => [result.document, ...prev])
      return result.document
    },
    [userId]
  )

  const removeDocument = useCallback(
    async (id: string) => {
      await deleteDocument(id, userId)
      setDocuments((prev) => prev.filter((d) => d.id !== id))
    },
    [userId]
  )

  const renameDoc = useCallback(
    async (id: string, fileName: string) => {
      const updated = await renameDocument(id, fileName, userId)
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === id
            ? {
                ...doc,
                ...updated,
                insurer: updated.insurer ?? doc.insurer,
                policyName: updated.policyName ?? doc.policyName,
              }
            : doc
        )
      )
      return updated
    },
    [userId]
  )

  const openDocument = useCallback(
    async (document: InsuranceDocument) => {
      return getDocumentUrl(document, userId)
    },
    [userId]
  )

  return {
    policies,
    documents,
    loading,
    error,
    addPolicy,
    savePolicy,
    removePolicy,
    addDocument,
    removeDocument,
    renameDocument: renameDoc,
    openDocument,
    reload: load,
  }
}
