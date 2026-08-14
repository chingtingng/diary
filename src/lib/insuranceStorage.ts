import {
  detectFileType,
  rowToDocument,
  rowToPolicy,
  type InsuranceDocument,
  type InsuranceDocumentInput,
  type InsuranceDocumentRow,
  type InsurancePolicy,
  type InsurancePolicyInput,
  type InsurancePolicyPatch,
  type InsurancePolicyRow,
} from '../types/insurance'
import { getStorageMode } from './storage'
import { supabase } from './supabase'

const POLICIES_KEY = 'daybook-insurance-policies'
const DOCUMENTS_KEY = 'daybook-insurance-documents'
const FILE_DB = 'daybook-insurance-files'
const FILE_STORE = 'blobs'
const BUCKET = 'insurance-documents'

function generateId(): string {
  return crypto.randomUUID()
}

function readLocalPolicies(): InsurancePolicy[] {
  try {
    const raw = localStorage.getItem(POLICIES_KEY)
    if (!raw) return []
    return JSON.parse(raw) as InsurancePolicy[]
  } catch {
    return []
  }
}

function writeLocalPolicies(policies: InsurancePolicy[]) {
  localStorage.setItem(POLICIES_KEY, JSON.stringify(policies))
}

function readLocalDocuments(): InsuranceDocument[] {
  try {
    const raw = localStorage.getItem(DOCUMENTS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as InsuranceDocument[]
  } catch {
    return []
  }
}

function writeLocalDocuments(documents: InsuranceDocument[]) {
  localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(documents))
}

function openFileDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FILE_DB, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(FILE_STORE)) {
        db.createObjectStore(FILE_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
  })
}

async function putLocalBlob(path: string, blob: Blob): Promise<void> {
  const db = await openFileDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, 'readwrite')
    tx.objectStore(FILE_STORE).put(blob, path)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'))
  })
  db.close()
}

async function getLocalBlob(path: string): Promise<Blob | null> {
  const db = await openFileDb()
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, 'readonly')
    const request = tx.objectStore(FILE_STORE).get(path)
    request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'))
  })
  db.close()
  return blob
}

async function deleteLocalBlob(path: string): Promise<void> {
  const db = await openFileDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, 'readwrite')
    tx.objectStore(FILE_STORE).delete(path)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'))
  })
  db.close()
}

function sortPolicies(policies: InsurancePolicy[]): InsurancePolicy[] {
  return [...policies].sort((a, b) => {
    const aTime = a.renewalDate ? new Date(a.renewalDate).getTime() : Number.POSITIVE_INFINITY
    const bTime = b.renewalDate ? new Date(b.renewalDate).getTime() : Number.POSITIVE_INFINITY
    if (aTime !== bTime) return aTime - bTime
    return a.policyName.localeCompare(b.policyName)
  })
}

function sortDocuments(documents: InsuranceDocument[]): InsuranceDocument[] {
  return [...documents].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  )
}

function attachPolicyMeta(
  documents: InsuranceDocument[],
  policies: InsurancePolicy[]
): InsuranceDocument[] {
  const byId = new Map(policies.map((p) => [p.id, p]))
  return documents.map((doc) => {
    const policy = doc.policyId ? byId.get(doc.policyId) : undefined
    return {
      ...doc,
      insurer: policy?.insurer ?? doc.insurer,
      policyName: policy?.policyName ?? doc.policyName,
    }
  })
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-()+\s]/g, '_').slice(0, 180)
}

export async function fetchPolicies(userId?: string): Promise<InsurancePolicy[]> {
  if (getStorageMode() === 'local') {
    return sortPolicies(readLocalPolicies())
  }

  if (!supabase || !userId) return []

  const { data, error } = await supabase
    .from('insurance_policies')
    .select('*')
    .eq('user_id', userId)
    .order('renewal_date', { ascending: true, nullsFirst: false })

  if (error) throw error
  return sortPolicies((data as InsurancePolicyRow[]).map(rowToPolicy))
}

export async function fetchDocuments(userId?: string): Promise<InsuranceDocument[]> {
  if (getStorageMode() === 'local') {
    const policies = readLocalPolicies()
    return sortDocuments(attachPolicyMeta(readLocalDocuments(), policies))
  }

  if (!supabase || !userId) return []

  const { data, error } = await supabase
    .from('insurance_documents')
    .select('*, insurance_policies(insurer, policy_name)')
    .eq('user_id', userId)
    .order('uploaded_at', { ascending: false })

  if (error) throw error
  return sortDocuments((data as InsuranceDocumentRow[]).map(rowToDocument))
}

export async function createPolicy(
  input: InsurancePolicyInput,
  userId?: string
): Promise<InsurancePolicy> {
  const now = new Date().toISOString()

  if (getStorageMode() === 'local') {
    const policy: InsurancePolicy = {
      id: generateId(),
      insurer: input.insurer.trim(),
      policyName: input.policyName.trim(),
      policyType: input.policyType,
      coverageAmount: input.coverageAmount,
      premium: input.premium,
      premiumFrequency: input.premiumFrequency,
      renewalDate: input.renewalDate,
      status: input.status,
      notes: input.notes?.trim() ?? '',
      createdAt: now,
      updatedAt: now,
    }
    const policies = readLocalPolicies()
    policies.push(policy)
    writeLocalPolicies(policies)
    return policy
  }

  if (!supabase || !userId) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('insurance_policies')
    .insert({
      user_id: userId,
      insurer: input.insurer.trim(),
      policy_name: input.policyName.trim(),
      policy_type: input.policyType,
      coverage_amount: input.coverageAmount,
      premium: input.premium,
      premium_frequency: input.premiumFrequency,
      renewal_date: input.renewalDate,
      status: input.status,
      notes: input.notes?.trim() ?? '',
    })
    .select()
    .single()

  if (error) throw error
  return rowToPolicy(data as InsurancePolicyRow)
}

export async function updatePolicy(
  id: string,
  patch: InsurancePolicyPatch,
  userId?: string
): Promise<InsurancePolicy> {
  if (getStorageMode() === 'local') {
    const policies = readLocalPolicies()
    const index = policies.findIndex((p) => p.id === id)
    if (index === -1) throw new Error('Policy not found')

    const updated: InsurancePolicy = {
      ...policies[index],
      ...patch,
      insurer: patch.insurer !== undefined ? patch.insurer.trim() : policies[index].insurer,
      policyName:
        patch.policyName !== undefined ? patch.policyName.trim() : policies[index].policyName,
      notes: patch.notes !== undefined ? patch.notes.trim() : policies[index].notes,
      updatedAt: new Date().toISOString(),
    }
    policies[index] = updated
    writeLocalPolicies(policies)
    return updated
  }

  if (!supabase || !userId) throw new Error('Not authenticated')

  const payload: Record<string, unknown> = {}
  if (patch.insurer !== undefined) payload.insurer = patch.insurer.trim()
  if (patch.policyName !== undefined) payload.policy_name = patch.policyName.trim()
  if (patch.policyType !== undefined) payload.policy_type = patch.policyType
  if (patch.coverageAmount !== undefined) payload.coverage_amount = patch.coverageAmount
  if (patch.premium !== undefined) payload.premium = patch.premium
  if (patch.premiumFrequency !== undefined) payload.premium_frequency = patch.premiumFrequency
  if (patch.renewalDate !== undefined) payload.renewal_date = patch.renewalDate
  if (patch.status !== undefined) payload.status = patch.status
  if (patch.notes !== undefined) payload.notes = patch.notes.trim()

  const { data, error } = await supabase
    .from('insurance_policies')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error
  return rowToPolicy(data as InsurancePolicyRow)
}

export async function deletePolicy(id: string, userId?: string): Promise<void> {
  if (getStorageMode() === 'local') {
    writeLocalPolicies(readLocalPolicies().filter((p) => p.id !== id))
    const docs = readLocalDocuments().map((doc) =>
      doc.policyId === id ? { ...doc, policyId: null } : doc
    )
    writeLocalDocuments(docs)
    return
  }

  if (!supabase || !userId) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('insurance_policies')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error
}

export async function uploadDocument(
  input: InsuranceDocumentInput,
  userId?: string
): Promise<{ document: InsuranceDocument; policy?: InsurancePolicy }> {
  let policyId = input.policyId ?? null
  let createdPolicy: InsurancePolicy | undefined

  if (!policyId && input.newPolicy) {
    createdPolicy = await createPolicy(input.newPolicy, userId)
    policyId = createdPolicy.id
  }

  const fileType = detectFileType(input.file)
  const fileName = input.file.name
  const fileSize = input.file.size
  const now = new Date().toISOString()
  const docId = generateId()
  const owner = userId ?? 'local'
  const storagePath = `${owner}/${docId}/${sanitizeFileName(fileName)}`

  if (getStorageMode() === 'local') {
    await putLocalBlob(storagePath, input.file)
    const document: InsuranceDocument = {
      id: docId,
      policyId,
      fileName,
      storagePath,
      fileType,
      fileSize,
      notes: input.notes?.trim() ?? '',
      uploadedAt: now,
      insurer: createdPolicy?.insurer,
      policyName: createdPolicy?.policyName,
    }

    if (!createdPolicy && policyId) {
      const policy = readLocalPolicies().find((p) => p.id === policyId)
      document.insurer = policy?.insurer
      document.policyName = policy?.policyName
    }

    const documents = readLocalDocuments()
    documents.unshift(document)
    writeLocalDocuments(documents)
    return { document, policy: createdPolicy }
  }

  if (!supabase || !userId) throw new Error('Not authenticated')

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, input.file, {
      cacheControl: '3600',
      upsert: false,
      contentType: input.file.type || undefined,
    })

  if (uploadError) {
    if (createdPolicy) {
      await deletePolicy(createdPolicy.id, userId).catch(() => undefined)
    }
    throw uploadError
  }

  const { data, error } = await supabase
    .from('insurance_documents')
    .insert({
      id: docId,
      user_id: userId,
      policy_id: policyId,
      file_name: fileName,
      storage_path: storagePath,
      file_type: fileType,
      file_size: fileSize,
      notes: input.notes?.trim() ?? '',
    })
    .select('*, insurance_policies(insurer, policy_name)')
    .single()

  if (error) {
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => undefined)
    if (createdPolicy) {
      await deletePolicy(createdPolicy.id, userId).catch(() => undefined)
    }
    throw error
  }

  return {
    document: rowToDocument(data as InsuranceDocumentRow),
    policy: createdPolicy,
  }
}

export async function deleteDocument(id: string, userId?: string): Promise<void> {
  if (getStorageMode() === 'local') {
    const documents = readLocalDocuments()
    const doc = documents.find((d) => d.id === id)
    if (doc) await deleteLocalBlob(doc.storagePath).catch(() => undefined)
    writeLocalDocuments(documents.filter((d) => d.id !== id))
    return
  }

  if (!supabase || !userId) throw new Error('Not authenticated')

  const { data, error: fetchError } = await supabase
    .from('insurance_documents')
    .select('storage_path')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (fetchError) throw fetchError

  const { error } = await supabase
    .from('insurance_documents')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error

  if (data?.storage_path) {
    await supabase.storage.from(BUCKET).remove([data.storage_path]).catch(() => undefined)
  }
}

export async function getDocumentUrl(
  document: InsuranceDocument,
  userId?: string
): Promise<string | null> {
  if (getStorageMode() === 'local') {
    const blob = await getLocalBlob(document.storagePath)
    if (!blob) return null
    return URL.createObjectURL(blob)
  }

  if (!supabase || !userId) return null

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(document.storagePath, 60 * 10)

  if (error) throw error
  return data.signedUrl
}
