import { useEffect, useMemo, useRef, useState } from 'react'
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { atLocalNoon } from '../lib/dates'
import { extractPolicyDraftFromFile } from '../lib/insuranceDocParse'
import {
  INSURANCE_TABS,
  insuranceHref,
  shouldHandleSpaClick,
  type InsuranceScreen,
} from '../lib/navigation'
import { MenuSelect } from './MenuSelect'
import { DateField } from './DateField'
import { MenuDots } from './MenuDots'
import { useAllowFormScroll } from '../hooks/useAllowFormScroll'
import {
  PREMIUM_FREQUENCIES,
  POLICY_STATUSES,
  POLICY_TYPES,
  annualPremium,
  formatFileSize,
  getPolicyStatusLabel,
  getPolicyTypeLabel,
  type DocumentFilter,
  type DocumentFileType,
  type InsuranceDocument,
  type InsuranceDocumentInput,
  type InsurancePolicy,
  type InsurancePolicyInput,
  type InsurancePolicyPatch,
  type PolicyStatusId,
  type PolicyTypeId,
  type PremiumFrequencyId,
} from '../types/insurance'

type AttachMode = 'existing' | 'new' | 'none'

interface InsuranceTrackerProps {
  policies: InsurancePolicy[]
  documents: InsuranceDocument[]
  loading: boolean
  screen: InsuranceScreen
  onScreenChange: (screen: InsuranceScreen) => void
  onAddPolicy: (input: InsurancePolicyInput) => Promise<InsurancePolicy>
  onSavePolicy: (id: string, patch: InsurancePolicyPatch) => Promise<InsurancePolicy>
  onDeletePolicy: (id: string) => Promise<void>
  onUploadDocument: (input: InsuranceDocumentInput) => Promise<InsuranceDocument>
  onDeleteDocument: (id: string) => Promise<void>
  onRenameDocument: (id: string, fileName: string) => Promise<InsuranceDocument>
  onOpenDocument: (document: InsuranceDocument) => Promise<string | null>
  uploadRequestKey?: number
}

function formatMoney(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatUploadedAt(iso: string): string {
  const date = new Date(iso)
  if (isToday(date)) return 'Uploaded today'
  if (isYesterday(date)) return 'Uploaded yesterday'
  return `Uploaded ${format(date, 'd MMM yyyy')}`
}

function toIsoDate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

function FileTypeIcon({ type }: { type: DocumentFileType }) {
  const label = type === 'pdf' ? 'PDF' : type === 'image' ? 'IMG' : type === 'doc' ? 'DOC' : 'FILE'
  return (
    <span className={`insurance-file-icon insurance-file-icon-${type}`} aria-hidden>
      {label}
    </span>
  )
}

function PolicyMark({ name }: { name: string }) {
  const letter = (name.trim()[0] ?? 'P').toUpperCase()
  return (
    <span className="insurance-policy-mark" aria-hidden>
      {letter}
    </span>
  )
}

function AccordionChevron() {
  return (
    <span className="expense-week-row-chevron" aria-hidden>
      <svg viewBox="0 0 16 16" width="16" height="16" focusable="false">
        <path
          d="M5.5 2.5 L11 8 L5.5 13.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

const EMPTY_POLICY: InsurancePolicyInput = {
  insurer: '',
  policyName: '',
  policyType: 'health',
  coverageAmount: null,
  premium: 0,
  premiumFrequency: 'annual',
  renewalDate: toIsoDate(new Date()),
  status: 'active',
  notes: '',
}

function policyToDraft(policy: InsurancePolicy): InsurancePolicyInput {
  return {
    insurer: policy.insurer,
    policyName: policy.policyName,
    policyType: policy.policyType,
    coverageAmount: policy.coverageAmount,
    premium: policy.premium,
    premiumFrequency: policy.premiumFrequency,
    renewalDate: policy.renewalDate,
    status: policy.status,
    notes: policy.notes,
  }
}

function renewalDateFromPolicy(policy: InsurancePolicy): Date {
  if (!policy.renewalDate) return atLocalNoon(new Date())
  try {
    return atLocalNoon(parseISO(policy.renewalDate))
  } catch {
    return atLocalNoon(new Date())
  }
}

export function InsuranceTracker({
  policies,
  documents,
  loading,
  screen,
  onScreenChange,
  onAddPolicy,
  onSavePolicy,
  onDeletePolicy,
  onUploadDocument,
  onDeleteDocument,
  onRenameDocument,
  onOpenDocument,
  uploadRequestKey = 0,
}: InsuranceTrackerProps) {
  const [showUpload, setShowUpload] = useState(false)
  const [showPolicyForm, setShowPolicyForm] = useState(false)
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [docFilter, setDocFilter] = useState<DocumentFilter>('all')
  const [docMenuId, setDocMenuId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [policyMenuId, setPolicyMenuId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [file, setFile] = useState<File | null>(null)
  const [uploadNotes, setUploadNotes] = useState('')
  const [linkPolicyId, setLinkPolicyId] = useState<string>('')
  const [attachMode, setAttachMode] = useState<AttachMode>('none')
  const [uploadPolicy, setUploadPolicy] = useState<InsurancePolicyInput>(EMPTY_POLICY)
  const [extracting, setExtracting] = useState(false)
  const [extractNote, setExtractNote] = useState<string | null>(null)

  const [policyDraft, setPolicyDraft] = useState<InsurancePolicyInput>(EMPTY_POLICY)
  const [renewalDate, setRenewalDate] = useState(() => atLocalNoon(new Date()))
  const [uploadRenewalDate, setUploadRenewalDate] = useState(() => atLocalNoon(new Date()))

  const fileInputRef = useRef<HTMLInputElement>(null)
  const formCardRef = useRef<HTMLElement | null>(null)
  const extractTokenRef = useRef(0)
  const lastDraftRef = useRef<Awaited<ReturnType<typeof extractPolicyDraftFromFile>> | null>(
    null
  )
  useAllowFormScroll(formCardRef, showUpload || showPolicyForm)

  useEffect(() => {
    if (uploadRequestKey > 0) {
      setShowUpload(true)
      // Autofill only shows on New policy — default there so choosing a PDF fills the form.
      setAttachMode('new')
    }
  }, [uploadRequestKey])

  useEffect(() => {
    if (!showUpload) return
    setAttachMode((current) => (current === 'none' ? 'new' : current))
  }, [showUpload])

  const activePolicies = useMemo(
    () => policies.filter((p) => p.status === 'active'),
    [policies]
  )

  const totalAnnualPremium = useMemo(
    () => activePolicies.reduce((sum, policy) => sum + annualPremium(policy), 0),
    [activePolicies]
  )

  const totalCoverage = useMemo(
    () =>
      activePolicies.reduce(
        (sum, policy) => sum + (policy.coverageAmount ?? 0),
        0
      ),
    [activePolicies]
  )

  const overviewPolicies = useMemo(() => activePolicies.slice(0, 4), [activePolicies])

  const recentDocuments = useMemo(() => documents.slice(0, 4), [documents])

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase()
    return documents.filter((doc) => {
      if (docFilter !== 'all' && doc.fileType !== docFilter) return false
      if (!query) return true
      return (
        doc.fileName.toLowerCase().includes(query) ||
        (doc.insurer ?? '').toLowerCase().includes(query) ||
        (doc.policyName ?? '').toLowerCase().includes(query)
      )
    })
  }, [documents, docFilter, search])

  const openUpload = () => {
    setError(null)
    setShowUpload(true)
    setShowPolicyForm(false)
    setAttachMode('new')
  }

  const resetUpload = () => {
    extractTokenRef.current += 1
    lastDraftRef.current = null
    setFile(null)
    setUploadNotes('')
    setLinkPolicyId('')
    setAttachMode('new')
    setUploadPolicy(EMPTY_POLICY)
    setUploadRenewalDate(atLocalNoon(new Date()))
    setExtracting(false)
    setExtractNote(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const describeDraft = (
    draft: Awaited<ReturnType<typeof extractPolicyDraftFromFile>>
  ): string => {
    if (draft.error) {
      return `Couldn’t fully read this file (${draft.error}). Check the fields below.`
    }
    if (draft.source === 'pdf' && draft.confidence !== 'low') {
      return 'Details filled from the PDF — edit anything that looks off.'
    }
    if (draft.source === 'filename' && draft.confidence !== 'low') {
      return 'Guessed details from the file name — edit before saving.'
    }
    if (draft.source === 'pdf' && (draft.textLength ?? 0) === 0) {
      return 'This PDF looks like a scan with no selectable text. Fill in the details below.'
    }
    return 'Couldn’t detect much automatically — fill in the details below.'
  }

  const applyExtractedDraft = (
    draft: Awaited<ReturnType<typeof extractPolicyDraftFromFile>>
  ) => {
    lastDraftRef.current = draft
    const fallbackName = draft.policyName?.trim()
    setUploadPolicy((prev) => ({
      ...prev,
      insurer: draft.insurer?.trim() || prev.insurer,
      policyName: fallbackName || prev.policyName,
      policyType: draft.policyType ?? prev.policyType,
      premium: draft.premium ?? prev.premium,
      premiumFrequency: draft.premiumFrequency ?? prev.premiumFrequency,
      coverageAmount:
        draft.coverageAmount === undefined ? prev.coverageAmount : draft.coverageAmount,
      renewalDate: draft.renewalDate ?? prev.renewalDate,
      status: 'active',
    }))
    if (draft.renewalDate) {
      try {
        setUploadRenewalDate(atLocalNoon(parseISO(draft.renewalDate)))
      } catch {
        /* ignore bad dates */
      }
    }
    setExtractNote(describeDraft(draft))
  }

  const findPolicyMatch = (
    draft: Awaited<ReturnType<typeof extractPolicyDraftFromFile>>
  ): InsurancePolicy | undefined => {
    const needle = `${draft.insurer ?? ''} ${draft.policyName ?? ''}`.toLowerCase().trim()
    return policies.find((policy) => {
      const haystack = `${policy.insurer} ${policy.policyName}`.toLowerCase()
      return (
        (draft.insurer &&
          policy.insurer.toLowerCase().includes(draft.insurer.toLowerCase())) ||
        (draft.policyName && haystack.includes(draft.policyName.toLowerCase())) ||
        (needle.length > 2 && haystack.includes(needle))
      )
    })
  }

  const handleFileChosen = async (next: File | null) => {
    setFile(next)
    setExtractNote(null)
    lastDraftRef.current = null
    if (!next) return

    const token = ++extractTokenRef.current
    setExtracting(true)
    try {
      const draft = await extractPolicyDraftFromFile(next)
      if (token !== extractTokenRef.current) return
      lastDraftRef.current = draft

      if (attachMode === 'existing' && policies.length > 0) {
        const match = findPolicyMatch(draft)
        if (match) {
          setLinkPolicyId(match.id)
          setExtractNote(`Suggested link: ${match.policyName}. Change it if that’s wrong.`)
          return
        }
        // No match — flip to New policy and autofill so the fields are useful.
        setAttachMode('new')
        applyExtractedDraft(draft)
        return
      }

      if (attachMode !== 'new') setAttachMode('new')
      applyExtractedDraft(draft)
    } catch (err) {
      if (token !== extractTokenRef.current) return
      setExtractNote(err instanceof Error ? err.message : 'Could not read that file')
    } finally {
      if (token === extractTokenRef.current) setExtracting(false)
    }
  }

  const switchAttachMode = (mode: AttachMode) => {
    setAttachMode(mode)
    if (mode === 'new' && lastDraftRef.current) {
      applyExtractedDraft(lastDraftRef.current)
    } else if (mode === 'new' && file && !lastDraftRef.current) {
      void handleFileChosen(file)
    } else if (mode === 'existing' && lastDraftRef.current) {
      const match = findPolicyMatch(lastDraftRef.current)
      if (match) {
        setLinkPolicyId(match.id)
        setExtractNote(`Suggested link: ${match.policyName}. Change it if that’s wrong.`)
      } else {
        setExtractNote('Pick which policy this document belongs to.')
      }
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Choose a PDF or image to upload.')
      return
    }
    if (attachMode === 'existing' && !linkPolicyId) {
      setError('Choose which policy this document belongs to.')
      return
    }
    if (attachMode === 'new' && !uploadPolicy.policyName.trim()) {
      setError('Policy name is required when creating a policy.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const input: InsuranceDocumentInput = {
        file,
        notes: uploadNotes,
        policyId: attachMode === 'existing' ? linkPolicyId : null,
        newPolicy:
          attachMode === 'new'
            ? {
                ...uploadPolicy,
                insurer: uploadPolicy.insurer.trim(),
                policyName: uploadPolicy.policyName.trim() || file.name.replace(/\.[^.]+$/, ''),
                renewalDate: toIsoDate(uploadRenewalDate),
                premium: Number(uploadPolicy.premium) || 0,
                coverageAmount:
                  uploadPolicy.coverageAmount === null ||
                  Number.isNaN(Number(uploadPolicy.coverageAmount))
                    ? null
                    : Number(uploadPolicy.coverageAmount),
              }
            : undefined,
      }
      await onUploadDocument(input)
      resetUpload()
      setShowUpload(false)
      onScreenChange(attachMode === 'new' ? 'policies' : 'documents')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err || 'Upload failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddPolicy = async () => {
    if (!policyDraft.policyName.trim()) {
      setError('Policy name is required.')
      return
    }
    setSubmitting(true)
    setError(null)
    const payload: InsurancePolicyInput = {
      ...policyDraft,
      insurer: policyDraft.insurer.trim(),
      policyName: policyDraft.policyName.trim(),
      renewalDate: toIsoDate(renewalDate),
      premium: Number(policyDraft.premium) || 0,
      coverageAmount:
        policyDraft.coverageAmount === null || Number.isNaN(Number(policyDraft.coverageAmount))
          ? null
          : Number(policyDraft.coverageAmount),
      notes: policyDraft.notes?.trim() ?? '',
    }
    try {
      if (editingPolicyId) {
        await onSavePolicy(editingPolicyId, payload)
      } else {
        await onAddPolicy(payload)
      }
      setPolicyDraft(EMPTY_POLICY)
      setRenewalDate(atLocalNoon(new Date()))
      setEditingPolicyId(null)
      setShowPolicyForm(false)
      onScreenChange('policies')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save policy')
    } finally {
      setSubmitting(false)
    }
  }

  const openAddPolicy = () => {
    setError(null)
    setPolicyMenuId(null)
    setEditingPolicyId(null)
    setPolicyDraft(EMPTY_POLICY)
    setRenewalDate(atLocalNoon(new Date()))
    setShowPolicyForm(true)
  }

  const startEditPolicy = (policy: InsurancePolicy) => {
    setError(null)
    setPolicyMenuId(null)
    setEditingPolicyId(policy.id)
    setPolicyDraft(policyToDraft(policy))
    setRenewalDate(renewalDateFromPolicy(policy))
    setShowPolicyForm(true)
  }

  const cancelPolicyForm = () => {
    setShowPolicyForm(false)
    setEditingPolicyId(null)
    setPolicyDraft(EMPTY_POLICY)
    setRenewalDate(atLocalNoon(new Date()))
    setError(null)
  }

  const handleOpenDoc = async (doc: InsuranceDocument) => {
    try {
      const url = await onOpenDocument(doc)
      if (!url) {
        setError('Could not open that file.')
        return
      }
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open that file')
    }
  }

  const startRename = (doc: InsuranceDocument) => {
    setDocMenuId(null)
    setError(null)
    setRenamingId(doc.id)
    setRenameValue(doc.fileName)
  }

  const cancelRename = () => {
    if (renaming) return
    setRenamingId(null)
    setRenameValue('')
  }

  const commitRename = async (doc: InsuranceDocument) => {
    const next = renameValue.trim()
    if (!next || next === doc.fileName) {
      cancelRename()
      return
    }

    setRenaming(true)
    setError(null)
    try {
      await onRenameDocument(doc.id, next)
      setRenamingId(null)
      setRenameValue('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename document')
    } finally {
      setRenaming(false)
    }
  }

  return (
    <div className="expenses-view insurance-view">
      <div className="insurance-tabs expense-period-tabs" role="tablist" aria-label="Insurance">
        {INSURANCE_TABS.map((tab) => (
          <a
            key={tab.id}
            href={insuranceHref(tab.id)}
            role="tab"
            aria-selected={screen === tab.id}
            className={screen === tab.id ? 'active' : ''}
            data-haptic="select"
            onClick={(event) => {
              if (!shouldHandleSpaClick(event)) return
              event.preventDefault()
              onScreenChange(tab.id)
            }}
          >
            {tab.label}
          </a>
        ))}
      </div>

      {error && <p className="expense-error insurance-error-banner">{error}</p>}

      {loading ? (
        <p className="loading-text">Loading insurance…</p>
      ) : showUpload ? (
        <section className="expense-summary-card insurance-form-card" ref={formCardRef}>
          <div className="expense-form-heading">
            <h2 className="expenses-title">Upload document</h2>
            <button
              type="button"
              className="expense-form-cancel"
              data-haptic="light"
              onClick={() => {
                resetUpload()
                setShowUpload(false)
              }}
            >
              Cancel
            </button>
          </div>

          {error && <p className="expense-error">{error}</p>}

          <div className="insurance-file-picker">
            <span className="date-field-label">File</span>
            <input
              ref={fileInputRef}
              id="insurance-file-input"
              type="file"
              accept="application/pdf,image/*,.pdf,.doc,.docx"
              onChange={(event) => {
                void handleFileChosen(event.target.files?.[0] ?? null)
              }}
            />
            <button
              type="button"
              className="insurance-file-picker-button"
              data-haptic="select"
              onClick={() => fileInputRef.current?.click()}
            >
              {file ? file.name : 'Choose PDF or image'}
            </button>
            {extracting && <p className="insurance-extract-note">Reading document…</p>}
            {!extracting && extractNote && (
              <p className="insurance-extract-note">{extractNote}</p>
            )}
          </div>

          <div className="insurance-attach-modes" role="radiogroup" aria-label="Attach document to">
            {policies.length > 0 && (
              <button
                type="button"
                role="radio"
                aria-checked={attachMode === 'existing'}
                className={attachMode === 'existing' ? 'active' : ''}
                data-haptic="select"
                onClick={() => switchAttachMode('existing')}
              >
                Existing policy
              </button>
            )}
            <button
              type="button"
              role="radio"
              aria-checked={attachMode === 'new'}
              className={attachMode === 'new' ? 'active' : ''}
              data-haptic="select"
              onClick={() => switchAttachMode('new')}
            >
              New policy
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={attachMode === 'none'}
              className={attachMode === 'none' ? 'active' : ''}
              data-haptic="select"
              onClick={() => switchAttachMode('none')}
            >
              No policy
            </button>
          </div>

          {attachMode === 'existing' && (
            <MenuSelect
              label="Policy"
              variant="field"
              value={linkPolicyId || 'none'}
              options={[
                { id: 'none', label: 'Select a policy' },
                ...policies.map((p) => ({
                  id: p.id,
                  label: p.insurer ? `${p.policyName} · ${p.insurer}` : p.policyName,
                })),
              ]}
              onChange={(next) => setLinkPolicyId(next === 'none' ? '' : next)}
            />
          )}

          {attachMode === 'new' && (
            <div className="insurance-form-grid">
              <label className="expense-field">
                <span>Policy name</span>
                <input
                  value={uploadPolicy.policyName}
                  onChange={(e) =>
                    setUploadPolicy((prev) => ({ ...prev, policyName: e.target.value }))
                  }
                  placeholder="AIA Hospital Shield"
                />
              </label>
              <label className="expense-field">
                <span>Insurer</span>
                <input
                  value={uploadPolicy.insurer}
                  onChange={(e) =>
                    setUploadPolicy((prev) => ({ ...prev, insurer: e.target.value }))
                  }
                  placeholder="AIA"
                />
              </label>
              <MenuSelect
                label="Type"
                variant="field"
                value={uploadPolicy.policyType}
                options={POLICY_TYPES.map((t) => ({ id: t.id, label: t.label }))}
                onChange={(next) =>
                  setUploadPolicy((prev) => ({ ...prev, policyType: next as PolicyTypeId }))
                }
              />
              <label className="expense-field">
                <span>Coverage amount</span>
                <input
                  inputMode="decimal"
                  value={uploadPolicy.coverageAmount ?? ''}
                  onChange={(e) =>
                    setUploadPolicy((prev) => ({
                      ...prev,
                      coverageAmount: e.target.value === '' ? null : Number(e.target.value),
                    }))
                  }
                  placeholder="Optional"
                />
              </label>
              <label className="expense-field">
                <span>Premium</span>
                <input
                  inputMode="decimal"
                  value={uploadPolicy.premium || ''}
                  onChange={(e) =>
                    setUploadPolicy((prev) => ({
                      ...prev,
                      premium: Number(e.target.value) || 0,
                    }))
                  }
                  placeholder="0.00"
                />
              </label>
              <MenuSelect
                label="Frequency"
                variant="field"
                value={uploadPolicy.premiumFrequency}
                options={PREMIUM_FREQUENCIES.map((f) => ({ id: f.id, label: f.label }))}
                onChange={(next) =>
                  setUploadPolicy((prev) => ({
                    ...prev,
                    premiumFrequency: next as PremiumFrequencyId,
                  }))
                }
              />
              <DateField
                label="Renewal date"
                value={uploadRenewalDate}
                onChange={setUploadRenewalDate}
              />
            </div>
          )}

          <label className="expense-field">
            <span>Notes</span>
            <input
              value={uploadNotes}
              onChange={(e) => setUploadNotes(e.target.value)}
              placeholder="Optional"
            />
          </label>

          <button
            type="button"
            className="expense-add-toggle"
            data-haptic="light"
            disabled={submitting || extracting}
            onClick={handleUpload}
          >
            {submitting ? 'Uploading…' : 'Upload document'}
          </button>
        </section>
      ) : showPolicyForm ? (
        <section className="expense-summary-card insurance-form-card" ref={formCardRef}>
          <div className="expense-form-heading">
            <h2 className="expenses-title">
              {editingPolicyId ? 'Edit policy' : 'Add policy'}
            </h2>
            <button
              type="button"
              className="expense-form-cancel"
              data-haptic="light"
              onClick={cancelPolicyForm}
            >
              Cancel
            </button>
          </div>

          <div className="insurance-form-grid">
            <label className="expense-field">
              <span>Policy name</span>
              <input
                value={policyDraft.policyName}
                onChange={(e) =>
                  setPolicyDraft((prev) => ({ ...prev, policyName: e.target.value }))
                }
                placeholder="Prudential Life Plus"
              />
            </label>
            <label className="expense-field">
              <span>Insurer</span>
              <input
                value={policyDraft.insurer}
                onChange={(e) =>
                  setPolicyDraft((prev) => ({ ...prev, insurer: e.target.value }))
                }
                placeholder="Prudential"
              />
            </label>
            <MenuSelect
              label="Type"
              variant="field"
              value={policyDraft.policyType}
              options={POLICY_TYPES.map((t) => ({ id: t.id, label: t.label }))}
              onChange={(next) =>
                setPolicyDraft((prev) => ({ ...prev, policyType: next as PolicyTypeId }))
              }
            />
            <MenuSelect
              label="Status"
              variant="field"
              value={policyDraft.status}
              options={POLICY_STATUSES.map((s) => ({ id: s.id, label: s.label }))}
              onChange={(next) =>
                setPolicyDraft((prev) => ({ ...prev, status: next as PolicyStatusId }))
              }
            />
            <label className="expense-field">
              <span>Coverage amount</span>
              <input
                inputMode="decimal"
                value={policyDraft.coverageAmount ?? ''}
                onChange={(e) =>
                  setPolicyDraft((prev) => ({
                    ...prev,
                    coverageAmount: e.target.value === '' ? null : Number(e.target.value),
                  }))
                }
                placeholder="Optional"
              />
            </label>
            <label className="expense-field">
              <span>Premium</span>
              <input
                inputMode="decimal"
                value={policyDraft.premium || ''}
                onChange={(e) =>
                  setPolicyDraft((prev) => ({
                    ...prev,
                    premium: Number(e.target.value) || 0,
                  }))
                }
                placeholder="0.00"
              />
            </label>
            <MenuSelect
              label="Frequency"
              variant="field"
              value={policyDraft.premiumFrequency}
              options={PREMIUM_FREQUENCIES.map((f) => ({ id: f.id, label: f.label }))}
              onChange={(next) =>
                setPolicyDraft((prev) => ({
                  ...prev,
                  premiumFrequency: next as PremiumFrequencyId,
                }))
              }
            />
            <DateField label="Renewal date" value={renewalDate} onChange={setRenewalDate} />
            <label className="expense-field">
              <span>Notes</span>
              <textarea
                value={policyDraft.notes ?? ''}
                onChange={(e) =>
                  setPolicyDraft((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Optional"
                rows={3}
              />
            </label>
          </div>

          <button
            type="button"
            className="expense-add-toggle"
            data-haptic="light"
            disabled={submitting}
            onClick={handleAddPolicy}
          >
            {submitting
              ? 'Saving…'
              : editingPolicyId
                ? 'Save changes'
                : 'Save policy'}
          </button>
        </section>
      ) : screen === 'overview' ? (
        <>
          <section className="expense-summary-card insurance-summary-card">
            <div className="insurance-metrics insurance-metrics-simple">
              <div className="expenses-total-block insurance-premiums-hero">
                <span className="expenses-total-label">Yearly premiums</span>
                <span className="expenses-total-amount">
                  ${formatMoney(totalAnnualPremium)}
                </span>
              </div>
              <div className="insurance-metric">
                <span className="expenses-total-label">Policies</span>
                <strong>{activePolicies.length}</strong>
              </div>
              <div className="insurance-metric">
                <span className="expenses-total-label">Total coverage</span>
                <strong>
                  {totalCoverage > 0 ? `$${formatMoney(totalCoverage)}` : '—'}
                </strong>
              </div>
            </div>
          </section>

          <section className="insurance-section">
            <div className="insurance-section-heading">
              <h2>Your policies</h2>
              <button
                type="button"
                className="insurance-link"
                data-haptic="select"
                onClick={() => onScreenChange('policies')}
              >
                View all
              </button>
            </div>
            {overviewPolicies.length === 0 ? (
              <p className="insurance-empty">No policies yet. Add one to see coverage here.</p>
            ) : (
              <ul className="insurance-list">
                {overviewPolicies.map((policy) => (
                  <li key={policy.id}>
                    <button
                      type="button"
                      className="insurance-list-row"
                      data-haptic="select"
                      onClick={() => onScreenChange('policies')}
                    >
                      <PolicyMark name={policy.insurer || policy.policyName} />
                      <div className="insurance-list-main">
                        <span className="insurance-list-title">{policy.policyName}</span>
                        <span className="insurance-list-meta">
                          {getPolicyTypeLabel(policy.policyType)}
                          {policy.coverageAmount != null
                            ? ` · $${formatMoney(policy.coverageAmount)} cover`
                            : ''}
                          {` · $${formatMoney(annualPremium(policy))}/yr`}
                        </span>
                      </div>
                      <AccordionChevron />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="insurance-section">
            <div className="insurance-section-heading">
              <h2>Recent documents</h2>
              <button
                type="button"
                className="insurance-link"
                data-haptic="select"
                onClick={() => onScreenChange('documents')}
              >
                View all
              </button>
            </div>
            {recentDocuments.length === 0 ? (
              <p className="insurance-empty">Upload your first policy PDF to get started.</p>
            ) : (
              <ul className="insurance-list">
                {recentDocuments.map((doc) => (
                  <li key={doc.id}>
                    <button
                      type="button"
                      className="insurance-list-row"
                      data-haptic="select"
                      onClick={() => handleOpenDoc(doc)}
                    >
                      <FileTypeIcon type={doc.fileType} />
                      <div className="insurance-list-main">
                        <span className="insurance-list-title">{doc.fileName}</span>
                        <span className="insurance-list-meta">
                          {formatFileSize(doc.fileSize)} · {formatUploadedAt(doc.uploadedAt)}
                        </span>
                      </div>
                      <AccordionChevron />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <button
            type="button"
            className="expense-add-toggle"
            data-haptic="light"
            onClick={openUpload}
          >
            + Upload insurance document
          </button>
        </>
      ) : screen === 'policies' ? (
        <>
          {policies.length === 0 ? (
            <p className="insurance-empty-card">No policies yet. Add one or upload a document.</p>
          ) : (
            <ul className="insurance-policy-list">
              {policies.map((policy) => (
                <li key={policy.id} className="insurance-policy-card">
                  <div className="insurance-policy-card-top">
                    <button
                      type="button"
                      className="insurance-policy-card-main"
                      data-haptic="select"
                      onClick={() => startEditPolicy(policy)}
                    >
                      <PolicyMark name={policy.insurer || policy.policyName} />
                      <div className="insurance-policy-card-copy">
                        <div className="insurance-policy-card-title-row">
                          <h3>{policy.policyName}</h3>
                          <span className={`insurance-status insurance-status-${policy.status}`}>
                            {getPolicyStatusLabel(policy.status)}
                          </span>
                        </div>
                        <p>
                          {policy.insurer || 'Insurer'} · {getPolicyTypeLabel(policy.policyType)}
                        </p>
                      </div>
                    </button>
                    <div className="insurance-policy-menu">
                      <button
                        type="button"
                        className="header-btn menu-toggle"
                        data-haptic="light"
                        aria-label={`Actions for ${policy.policyName}`}
                        onClick={() =>
                          setPolicyMenuId((current) =>
                            current === policy.id ? null : policy.id
                          )
                        }
                      >
                        <MenuDots />
                      </button>
                      {policyMenuId === policy.id && (
                        <>
                          <div
                            className="menu-backdrop"
                            onClick={() => setPolicyMenuId(null)}
                          />
                          <div
                            className="header-menu insurance-policy-menu-panel"
                            role="menu"
                          >
                            <button
                              type="button"
                              className="menu-item"
                              role="menuitem"
                              data-haptic="select"
                              onClick={() => startEditPolicy(policy)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="menu-item menu-item-danger"
                              role="menuitem"
                              data-haptic="light"
                              onClick={() => {
                                setPolicyMenuId(null)
                                if (confirm(`Delete “${policy.policyName}”?`)) {
                                  void onDeletePolicy(policy.id)
                                }
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="insurance-policy-card-meta insurance-policy-card-meta-button"
                    data-haptic="select"
                    onClick={() => startEditPolicy(policy)}
                  >
                    <div>
                      <span className="expenses-total-label">Coverage</span>
                      <strong>
                        {policy.coverageAmount == null
                          ? '—'
                          : `$${formatMoney(policy.coverageAmount)}`}
                      </strong>
                    </div>
                    <div>
                      <span className="expenses-total-label">Yearly premium</span>
                      <strong>${formatMoney(annualPremium(policy))}</strong>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            className="expense-add-toggle"
            data-haptic="light"
            onClick={openAddPolicy}
          >
            + Add policy
          </button>
        </>
      ) : (
        <>
          <div className="insurance-docs-toolbar">
            <label className="insurance-search">
              <span className="visually-hidden">Search documents</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="m10.2 10.2 3 3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search documents"
              />
            </label>
            <div className="insurance-filter-chips" role="group" aria-label="File type">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'pdf', label: 'PDF' },
                  { id: 'image', label: 'Images' },
                  { id: 'doc', label: 'Doc' },
                  { id: 'other', label: 'Other' },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  className={docFilter === chip.id ? 'active' : ''}
                  data-haptic="select"
                  onClick={() => setDocFilter(chip.id)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {filteredDocuments.length === 0 ? (
            <p className="insurance-empty-card">No documents match this filter.</p>
          ) : (
            <ul className="insurance-list insurance-doc-list">
              {filteredDocuments.map((doc) => (
                <li key={doc.id} className="insurance-doc-row-wrap">
                  {renamingId === doc.id ? (
                    <form
                      className="insurance-rename-form"
                      onSubmit={(event) => {
                        event.preventDefault()
                        void commitRename(doc)
                      }}
                    >
                      <FileTypeIcon type={doc.fileType} />
                      <label className="insurance-rename-field">
                        <span className="visually-hidden">Rename document</span>
                        <input
                          value={renameValue}
                          autoFocus
                          disabled={renaming}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              e.preventDefault()
                              cancelRename()
                            }
                          }}
                        />
                      </label>
                      <div className="insurance-rename-actions">
                        <button
                          type="submit"
                          className="header-btn"
                          data-haptic="select"
                          disabled={renaming || !renameValue.trim()}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="header-btn"
                          data-haptic="light"
                          disabled={renaming}
                          onClick={cancelRename}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="insurance-list-row"
                        data-haptic="select"
                        onClick={() => handleOpenDoc(doc)}
                      >
                        <FileTypeIcon type={doc.fileType} />
                        <div className="insurance-list-main">
                          <span className="insurance-list-title">{doc.fileName}</span>
                          <span className="insurance-list-meta">
                            {doc.insurer || doc.policyName || 'Unlinked'} ·{' '}
                            {formatFileSize(doc.fileSize)} · {formatUploadedAt(doc.uploadedAt)}
                          </span>
                        </div>
                      </button>
                      <div className="insurance-doc-menu">
                        <button
                          type="button"
                          className="header-btn menu-toggle"
                          data-haptic="light"
                          aria-label={`Actions for ${doc.fileName}`}
                          onClick={() =>
                            setDocMenuId((current) => (current === doc.id ? null : doc.id))
                          }
                        >
                          <MenuDots />
                        </button>
                        {docMenuId === doc.id && (
                          <>
                            <div className="menu-backdrop" onClick={() => setDocMenuId(null)} />
                            <div className="header-menu insurance-doc-menu-panel" role="menu">
                              <button
                                type="button"
                                className="menu-item"
                                role="menuitem"
                                data-haptic="select"
                                onClick={() => {
                                  setDocMenuId(null)
                                  void handleOpenDoc(doc)
                                }}
                              >
                                Open
                              </button>
                              <button
                                type="button"
                                className="menu-item"
                                role="menuitem"
                                data-haptic="select"
                                onClick={() => startRename(doc)}
                              >
                                Rename
                              </button>
                              <button
                                type="button"
                                className="menu-item menu-item-danger"
                                role="menuitem"
                                data-haptic="light"
                                onClick={() => {
                                  setDocMenuId(null)
                                  if (confirm(`Delete “${doc.fileName}”?`)) {
                                    void onDeleteDocument(doc.id)
                                  }
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            className="expense-add-toggle"
            data-haptic="light"
            onClick={openUpload}
          >
            + Upload insurance document
          </button>
        </>
      )}
    </div>
  )
}
