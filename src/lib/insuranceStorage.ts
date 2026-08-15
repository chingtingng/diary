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
    const parsed = JSON.parse(raw) as InsurancePolicy[]
    return parsed.map((policy) => ({
      ...policy,
      policyNumber: policy.policyNumber ?? '',
      insurer: policy.insurer ?? '',
      notes: policy.notes ?? '',
    }))
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
  return name
    .replace(/[^\w.\-+()]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 180) || 'document'
}

function errorMessage(err: unknown, fallback = 'Upload failed'): string {
  if (err instanceof Error && err.message.trim()) return err.message
  if (err && typeof err === 'object') {
    const record = err as Record<string, unknown>
    for (const key of ['message', 'error', 'msg', 'details', 'hint']) {
      const value = record[key]
      if (typeof value === 'string' && value.trim()) return value
    }
  }
  if (typeof err === 'string' && err.trim()) return err
  return fallback
}

function isMissingRelationError(message: string): boolean {
  return /relation|does not exist|Could not find the table|schema cache/i.test(message)
}

function isMissingBucketError(message: string): boolean {
  return /bucket not found|not found|No such bucket|row-level security|Unauthorized|Jwt/i.test(
    message
  )
}

function guessContentType(file: File): string {
  if (file.type) return file.type
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) return 'application/pdf'
  if (name.endsWith('.png')) return 'image/png'
  if (/\.jpe?g$/.test(name)) return 'image/jpeg'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.heic')) return 'image/heic'
  if (name.endsWith('.heif')) return 'image/heif'
  if (name.endsWith('.doc')) return 'application/msword'
  if (name.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }
  return 'application/octet-stream'
}

const LOCAL_PATH_PREFIX = 'idb://'

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

  if (error) {
    // Older projects / missing FK embed: still load documents without joined policy labels.
    const fallback = await supabase
      .from('insurance_documents')
      .select('*')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false })
    if (fallback.error) throw fallback.error
    return sortDocuments((fallback.data as InsuranceDocumentRow[]).map(rowToDocument))
  }
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
      policyNumber: input.policyNumber?.trim() ?? '',
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
      policy_number: input.policyNumber?.trim() ?? '',
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

  if (error) {
    const message = errorMessage(error, 'Could not save policy')
    if (isMissingRelationError(message)) {
      throw new Error(
        'Insurance tables are missing in Supabase. Run supabase/migrations/007_create_insurance.sql in the SQL editor, then try again.'
      )
    }
    throw new Error(message)
  }
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
      policyNumber:
        patch.policyNumber !== undefined
          ? patch.policyNumber.trim()
          : policies[index].policyNumber,
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
  if (patch.policyNumber !== undefined) payload.policy_number = patch.policyNumber.trim()
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
  const objectPath = `${owner}/${docId}/${sanitizeFileName(fileName)}`
  const contentType = guessContentType(input.file)

  if (getStorageMode() === 'local') {
    await putLocalBlob(objectPath, input.file)
    const document: InsuranceDocument = {
      id: docId,
      policyId,
      fileName,
      storagePath: `${LOCAL_PATH_PREFIX}${objectPath}`,
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

  let storagePath = objectPath
  let usedLocalFallback = false

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, input.file, {
      cacheControl: '3600',
      upsert: false,
      contentType,
    })

  if (uploadError) {
    const message = errorMessage(uploadError, 'Storage upload failed')
    // Keep the upload usable even before the Storage bucket migration is applied.
    try {
      await putLocalBlob(objectPath, input.file)
      storagePath = `${LOCAL_PATH_PREFIX}${objectPath}`
      usedLocalFallback = true
      console.warn('[daybook] Supabase Storage upload failed; saved file locally.', message)
    } catch {
      if (createdPolicy) {
        await deletePolicy(createdPolicy.id, userId).catch(() => undefined)
      }
      if (isMissingBucketError(message) || /bucket/i.test(message)) {
        throw new Error(
          'Could not upload the file. Create the insurance-documents Storage bucket by running supabase/migrations/007_create_insurance.sql, then try again.'
        )
      }
      throw new Error(message)
    }
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
      notes: usedLocalFallback
        ? `${input.notes?.trim() ?? ''}${input.notes?.trim() ? ' · ' : ''}Stored on this device only`
            .trim()
        : input.notes?.trim() ?? '',
    })
    .select('*')
    .single()

  if (error) {
    if (!usedLocalFallback) {
      await supabase.storage.from(BUCKET).remove([objectPath]).catch(() => undefined)
    } else {
      await deleteLocalBlob(objectPath).catch(() => undefined)
    }
    if (createdPolicy) {
      await deletePolicy(createdPolicy.id, userId).catch(() => undefined)
    }
    const message = errorMessage(error, 'Could not save document')
    if (isMissingRelationError(message)) {
      throw new Error(
        'Insurance tables are missing in Supabase. Run supabase/migrations/007_create_insurance.sql in the SQL editor, then try again.'
      )
    }
    throw new Error(message)
  }

  const document = rowToDocument(data as InsuranceDocumentRow)
  if (createdPolicy) {
    document.insurer = createdPolicy.insurer
    document.policyName = createdPolicy.policyName
  }

  return { document, policy: createdPolicy }
}

function normalizeDocumentFileName(next: string, previous: string): string {
  const trimmed = next.trim().replace(/[/\\]/g, '-')
  if (!trimmed) throw new Error('Document name cannot be empty')

  const prevExtMatch = previous.match(/(\.[a-z0-9]{1,8})$/i)
  const prevExt = prevExtMatch?.[1] ?? ''
  const nextHasExt = /\.[a-z0-9]{1,8}$/i.test(trimmed)
  if (prevExt && !nextHasExt) return `${trimmed}${prevExt}`
  return trimmed
}

export async function renameDocument(
  id: string,
  fileName: string,
  userId?: string
): Promise<InsuranceDocument> {
  if (getStorageMode() === 'local') {
    const documents = readLocalDocuments()
    const index = documents.findIndex((d) => d.id === id)
    if (index === -1) throw new Error('Document not found')

    const updated: InsuranceDocument = {
      ...documents[index],
      fileName: normalizeDocumentFileName(fileName, documents[index].fileName),
    }
    documents[index] = updated
    writeLocalDocuments(documents)
    return updated
  }

  if (!supabase || !userId) throw new Error('Not authenticated')

  const { data: existing, error: fetchError } = await supabase
    .from('insurance_documents')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (fetchError) throw new Error(errorMessage(fetchError))
  if (!existing) throw new Error('Document not found')

  const nextName = normalizeDocumentFileName(
    fileName,
    (existing as InsuranceDocumentRow).file_name
  )

  const { data, error } = await supabase
    .from('insurance_documents')
    .update({ file_name: nextName })
    .eq('id', id)
    .eq('user_id', userId)
    .select('*, insurance_policies(insurer, policy_name)')
    .single()

  if (error) {
    // Older projects / missing FK embed: still rename without joined policy labels.
    const fallback = await supabase
      .from('insurance_documents')
      .update({ file_name: nextName })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single()
    if (fallback.error) throw new Error(errorMessage(fallback.error, 'Could not rename document'))
    return rowToDocument(fallback.data as InsuranceDocumentRow)
  }

  return rowToDocument(data as InsuranceDocumentRow)
}

export async function deleteDocument(id: string, userId?: string): Promise<void> {
  if (getStorageMode() === 'local') {
    const documents = readLocalDocuments()
    const doc = documents.find((d) => d.id === id)
    if (doc) {
      const path = doc.storagePath.startsWith(LOCAL_PATH_PREFIX)
        ? doc.storagePath.slice(LOCAL_PATH_PREFIX.length)
        : doc.storagePath
      await deleteLocalBlob(path).catch(() => undefined)
    }
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

  if (fetchError) throw new Error(errorMessage(fetchError))

  const { error } = await supabase
    .from('insurance_documents')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw new Error(errorMessage(error))

  if (data?.storage_path) {
    if (data.storage_path.startsWith(LOCAL_PATH_PREFIX)) {
      await deleteLocalBlob(data.storage_path.slice(LOCAL_PATH_PREFIX.length)).catch(
        () => undefined
      )
    } else {
      await supabase.storage.from(BUCKET).remove([data.storage_path]).catch(() => undefined)
    }
  }
}

export async function getDocumentUrl(
  document: InsuranceDocument,
  userId?: string
): Promise<string | null> {
  if (
    getStorageMode() === 'local' ||
    document.storagePath.startsWith(LOCAL_PATH_PREFIX)
  ) {
    const path = document.storagePath.startsWith(LOCAL_PATH_PREFIX)
      ? document.storagePath.slice(LOCAL_PATH_PREFIX.length)
      : document.storagePath
    const blob = await getLocalBlob(path)
    if (!blob) return null
    return URL.createObjectURL(blob)
  }

  if (!supabase || !userId) return null

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(document.storagePath, 60 * 10)

  if (error) throw new Error(errorMessage(error))
  return data.signedUrl
}
