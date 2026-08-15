export const POLICY_TYPES = [
  { id: 'life', label: 'Life' },
  { id: 'health', label: 'Health' },
  { id: 'critical_illness', label: 'Critical illness' },
  { id: 'personal_accident', label: 'Personal accident' },
  { id: 'disability', label: 'Disability' },
  { id: 'travel', label: 'Travel' },
  { id: 'auto', label: 'Auto' },
  { id: 'home', label: 'Home' },
  { id: 'other', label: 'Other' },
] as const

export type PolicyTypeId = (typeof POLICY_TYPES)[number]['id']

export const POLICY_STATUSES = [
  { id: 'active', label: 'Active' },
  { id: 'pending', label: 'Pending' },
  { id: 'expired', label: 'Expired' },
  { id: 'cancelled', label: 'Cancelled' },
] as const

export type PolicyStatusId = (typeof POLICY_STATUSES)[number]['id']

export const PREMIUM_FREQUENCIES = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'annual', label: 'Annual' },
] as const

export type PremiumFrequencyId = (typeof PREMIUM_FREQUENCIES)[number]['id']

export const DOCUMENT_FILE_TYPES = [
  { id: 'pdf', label: 'PDF' },
  { id: 'image', label: 'Images' },
  { id: 'doc', label: 'Doc' },
  { id: 'other', label: 'Other' },
] as const

export type DocumentFileType = (typeof DOCUMENT_FILE_TYPES)[number]['id']

export type DocumentFilter = 'all' | DocumentFileType

export interface InsurancePolicy {
  id: string
  insurer: string
  policyName: string
  policyNumber: string
  policyType: PolicyTypeId
  coverageAmount: number | null
  premium: number
  premiumFrequency: PremiumFrequencyId
  renewalDate: string | null
  status: PolicyStatusId
  notes: string
  createdAt: string
  updatedAt: string
}

export interface InsuranceDocument {
  id: string
  policyId: string | null
  fileName: string
  storagePath: string
  fileType: DocumentFileType
  fileSize: number
  notes: string
  uploadedAt: string
  /** Joined from policy when available */
  insurer?: string
  policyName?: string
}

export interface InsurancePolicyRow {
  id: string
  user_id: string
  insurer: string
  policy_name: string
  policy_number?: string | null
  policy_type: string
  coverage_amount: number | null
  premium: number
  premium_frequency: string
  renewal_date: string | null
  status: string
  notes: string
  created_at: string
  updated_at: string
}

export interface InsuranceDocumentRow {
  id: string
  policy_id: string | null
  user_id: string
  file_name: string
  storage_path: string
  file_type: string
  file_size: number
  notes: string
  uploaded_at: string
  insurance_policies?: {
    insurer: string
    policy_name: string
  } | null
}

export type InsurancePolicyInput = {
  insurer: string
  policyName: string
  policyNumber?: string
  policyType: PolicyTypeId
  coverageAmount: number | null
  premium: number
  premiumFrequency: PremiumFrequencyId
  renewalDate: string | null
  status: PolicyStatusId
  notes?: string
}

export type InsurancePolicyPatch = Partial<InsurancePolicyInput>

export type InsuranceDocumentInput = {
  file: File
  policyId?: string | null
  notes?: string
  /** When set and no policyId, create a policy alongside the upload */
  newPolicy?: InsurancePolicyInput
}

const POLICY_TYPE_IDS = new Set<string>(POLICY_TYPES.map((t) => t.id))
const STATUS_IDS = new Set<string>(POLICY_STATUSES.map((s) => s.id))
const FREQUENCY_IDS = new Set<string>(PREMIUM_FREQUENCIES.map((f) => f.id))
const FILE_TYPE_IDS = new Set<string>(DOCUMENT_FILE_TYPES.map((t) => t.id))

export function normalizePolicyType(value: string): PolicyTypeId {
  return POLICY_TYPE_IDS.has(value) ? (value as PolicyTypeId) : 'other'
}

export function normalizePolicyStatus(value: string): PolicyStatusId {
  return STATUS_IDS.has(value) ? (value as PolicyStatusId) : 'active'
}

export function normalizePremiumFrequency(value: string): PremiumFrequencyId {
  return FREQUENCY_IDS.has(value) ? (value as PremiumFrequencyId) : 'annual'
}

export function normalizeFileType(value: string): DocumentFileType {
  return FILE_TYPE_IDS.has(value) ? (value as DocumentFileType) : 'other'
}

export function detectFileType(file: File | { name: string; type: string }): DocumentFileType {
  const mime = file.type.toLowerCase()
  const name = file.name.toLowerCase()
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  if (mime.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|gif)$/.test(name)) {
    return 'image'
  }
  if (
    mime.includes('word') ||
    name.endsWith('.doc') ||
    name.endsWith('.docx')
  ) {
    return 'doc'
  }
  return 'other'
}

export function rowToPolicy(row: InsurancePolicyRow): InsurancePolicy {
  return {
    id: row.id,
    insurer: row.insurer ?? '',
    policyName: row.policy_name,
    policyNumber: row.policy_number ?? '',
    policyType: normalizePolicyType(row.policy_type),
    coverageAmount:
      row.coverage_amount === null || row.coverage_amount === undefined
        ? null
        : Number(row.coverage_amount),
    premium: Number(row.premium),
    premiumFrequency: normalizePremiumFrequency(row.premium_frequency),
    renewalDate: row.renewal_date,
    status: normalizePolicyStatus(row.status),
    notes: row.notes ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function rowToDocument(row: InsuranceDocumentRow): InsuranceDocument {
  return {
    id: row.id,
    policyId: row.policy_id,
    fileName: row.file_name,
    storagePath: row.storage_path,
    fileType: normalizeFileType(row.file_type),
    fileSize: Number(row.file_size) || 0,
    notes: row.notes ?? '',
    uploadedAt: row.uploaded_at,
    insurer: row.insurance_policies?.insurer,
    policyName: row.insurance_policies?.policy_name,
  }
}

export function getPolicyTypeLabel(id: PolicyTypeId): string {
  return POLICY_TYPES.find((t) => t.id === id)?.label ?? 'Other'
}

/** Type-aware label for the single primary coverage field. */
export function getCoverageFieldMeta(type: PolicyTypeId): {
  label: string
  hint: string
  listLabel: string
} {
  switch (type) {
    case 'life':
      return {
        label: 'Sum insured',
        hint: 'Main death benefit / face amount',
        listLabel: 'Sum insured',
      }
    case 'critical_illness':
      return {
        label: 'Sum insured',
        hint: 'Lump sum paid on a covered diagnosis',
        listLabel: 'Sum insured',
      }
    case 'personal_accident':
      return {
        label: 'Sum insured',
        hint: 'Main accidental death & disability benefit (not double/triple indemnity)',
        listLabel: 'Sum insured',
      }
    case 'disability':
      return {
        label: 'Benefit amount',
        hint: 'Monthly income benefit or lump-sum TPD cover',
        listLabel: 'Benefit',
      }
    case 'health':
      return {
        label: 'Coverage limit',
        hint: 'Annual or lifetime medical limit, if known',
        listLabel: 'Limit',
      }
    case 'travel':
      return {
        label: 'Coverage limit',
        hint: 'Main medical or trip cancellation limit',
        listLabel: 'Limit',
      }
    case 'auto':
      return {
        label: 'Sum insured',
        hint: 'Vehicle value or liability cover',
        listLabel: 'Sum insured',
      }
    case 'home':
      return {
        label: 'Sum insured',
        hint: 'Building and/or contents cover',
        listLabel: 'Sum insured',
      }
    default:
      return {
        label: 'Coverage amount',
        hint: 'Primary benefit or limit for this policy',
        listLabel: 'Coverage',
      }
  }
}

export function getPolicyStatusLabel(id: PolicyStatusId): string {
  return POLICY_STATUSES.find((s) => s.id === id)?.label ?? 'Active'
}

export function annualPremium(policy: InsurancePolicy): number {
  if (policy.premiumFrequency === 'monthly') return policy.premium * 12
  return policy.premium
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
