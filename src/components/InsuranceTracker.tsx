import { useEffect, useMemo, useRef, useState } from 'react'
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { atLocalNoon } from '../lib/dates'
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
  type PolicyStatusId,
  type PolicyTypeId,
  type PremiumFrequencyId,
} from '../types/insurance'

interface InsuranceTrackerProps {
  policies: InsurancePolicy[]
  documents: InsuranceDocument[]
  loading: boolean
  screen: InsuranceScreen
  onScreenChange: (screen: InsuranceScreen) => void
  onAddPolicy: (input: InsurancePolicyInput) => Promise<InsurancePolicy>
  onDeletePolicy: (id: string) => Promise<void>
  onUploadDocument: (input: InsuranceDocumentInput) => Promise<InsuranceDocument>
  onDeleteDocument: (id: string) => Promise<void>
  onOpenDocument: (document: InsuranceDocument) => Promise<string | null>
  uploadRequestKey?: number
}

function formatMoney(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatShortDate(iso: string | null): string {
  if (!iso) return '—'
  const date = iso.length <= 10 ? parseISO(iso) : new Date(iso)
  return format(date, 'd MMM yyyy')
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

export function InsuranceTracker({
  policies,
  documents,
  loading,
  screen,
  onScreenChange,
  onAddPolicy,
  onDeletePolicy,
  onUploadDocument,
  onDeleteDocument,
  onOpenDocument,
  uploadRequestKey = 0,
}: InsuranceTrackerProps) {
  const [showUpload, setShowUpload] = useState(false)
  const [showPolicyForm, setShowPolicyForm] = useState(false)
  const [search, setSearch] = useState('')
  const [docFilter, setDocFilter] = useState<DocumentFilter>('all')
  const [docMenuId, setDocMenuId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [file, setFile] = useState<File | null>(null)
  const [uploadNotes, setUploadNotes] = useState('')
  const [linkPolicyId, setLinkPolicyId] = useState<string>('')
  const [createPolicyOnUpload, setCreatePolicyOnUpload] = useState(false)
  const [uploadPolicy, setUploadPolicy] = useState<InsurancePolicyInput>(EMPTY_POLICY)

  const [policyDraft, setPolicyDraft] = useState<InsurancePolicyInput>(EMPTY_POLICY)
  const [renewalDate, setRenewalDate] = useState(() => atLocalNoon(new Date()))
  const [uploadRenewalDate, setUploadRenewalDate] = useState(() => atLocalNoon(new Date()))

  const fileInputRef = useRef<HTMLInputElement>(null)
  const formCardRef = useRef<HTMLElement | null>(null)
  useAllowFormScroll(formCardRef, showUpload || showPolicyForm)

  useEffect(() => {
    if (uploadRequestKey > 0) setShowUpload(true)
  }, [uploadRequestKey])

  const activePolicies = useMemo(
    () => policies.filter((p) => p.status === 'active'),
    [policies]
  )

  const totalAnnualPremium = useMemo(
    () => activePolicies.reduce((sum, policy) => sum + annualPremium(policy), 0),
    [activePolicies]
  )

  const upcomingRenewals = useMemo(() => {
    const now = Date.now()
    return [...activePolicies]
      .filter((p) => p.renewalDate)
      .sort(
        (a, b) =>
          new Date(a.renewalDate!).getTime() - new Date(b.renewalDate!).getTime()
      )
      .filter((p) => new Date(p.renewalDate!).getTime() >= now - 1000 * 60 * 60 * 24)
      .slice(0, 4)
  }, [activePolicies])

  const nextPayment = upcomingRenewals[0]?.renewalDate ?? null

  const expiringSoon = useMemo(() => {
    const horizon = Date.now() + 1000 * 60 * 60 * 24 * 60
    return activePolicies.filter(
      (p) => p.renewalDate && new Date(p.renewalDate).getTime() <= horizon
    ).length
  }, [activePolicies])

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
  }

  const resetUpload = () => {
    setFile(null)
    setUploadNotes('')
    setLinkPolicyId('')
    setCreatePolicyOnUpload(false)
    setUploadPolicy(EMPTY_POLICY)
    setUploadRenewalDate(atLocalNoon(new Date()))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Choose a PDF or image to upload.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const input: InsuranceDocumentInput = {
        file,
        notes: uploadNotes,
        policyId: createPolicyOnUpload ? null : linkPolicyId || null,
        newPolicy: createPolicyOnUpload
          ? {
              ...uploadPolicy,
              insurer: uploadPolicy.insurer.trim(),
              policyName: uploadPolicy.policyName.trim() || file.name.replace(/\.[^.]+$/, ''),
              renewalDate: toIsoDate(uploadRenewalDate),
              premium: Number(uploadPolicy.premium) || 0,
              coverageAmount:
                uploadPolicy.coverageAmount === null || Number.isNaN(Number(uploadPolicy.coverageAmount))
                  ? null
                  : Number(uploadPolicy.coverageAmount),
            }
          : undefined,
      }
      await onUploadDocument(input)
      resetUpload()
      setShowUpload(false)
      onScreenChange('documents')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
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
    try {
      await onAddPolicy({
        ...policyDraft,
        insurer: policyDraft.insurer.trim(),
        policyName: policyDraft.policyName.trim(),
        renewalDate: toIsoDate(renewalDate),
        premium: Number(policyDraft.premium) || 0,
        coverageAmount:
          policyDraft.coverageAmount === null || Number.isNaN(Number(policyDraft.coverageAmount))
            ? null
            : Number(policyDraft.coverageAmount),
      })
      setPolicyDraft(EMPTY_POLICY)
      setRenewalDate(atLocalNoon(new Date()))
      setShowPolicyForm(false)
      onScreenChange('policies')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save policy')
    } finally {
      setSubmitting(false)
    }
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

      {error && <p className="expense-error">{error}</p>}

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

          <div className="insurance-file-picker">
            <span className="date-field-label">File</span>
            <input
              ref={fileInputRef}
              id="insurance-file-input"
              type="file"
              accept="application/pdf,image/*,.pdf,.doc,.docx"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              className="insurance-file-picker-button"
              data-haptic="select"
              onClick={() => fileInputRef.current?.click()}
            >
              {file ? file.name : 'Choose PDF or image'}
            </button>
          </div>

          {policies.length > 0 && !createPolicyOnUpload && (
            <MenuSelect
              label="Link to policy"
              variant="field"
              value={linkPolicyId || 'none'}
              options={[
                { id: 'none', label: 'No policy' },
                ...policies.map((p) => ({ id: p.id, label: p.policyName })),
              ]}
              onChange={(next) => setLinkPolicyId(next === 'none' ? '' : next)}
            />
          )}

          <label className="insurance-check">
            <input
              type="checkbox"
              checked={createPolicyOnUpload}
              onChange={(event) => setCreatePolicyOnUpload(event.target.checked)}
            />
            <span>Also create a policy from this upload</span>
          </label>

          {createPolicyOnUpload && (
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
                <span>Annual / monthly premium</span>
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
            disabled={submitting}
            onClick={handleUpload}
          >
            {submitting ? 'Uploading…' : 'Upload document'}
          </button>
        </section>
      ) : showPolicyForm ? (
        <section className="expense-summary-card insurance-form-card" ref={formCardRef}>
          <div className="expense-form-heading">
            <h2 className="expenses-title">Add policy</h2>
            <button
              type="button"
              className="expense-form-cancel"
              data-haptic="light"
              onClick={() => setShowPolicyForm(false)}
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
          </div>

          <button
            type="button"
            className="expense-add-toggle"
            data-haptic="light"
            disabled={submitting}
            onClick={handleAddPolicy}
          >
            {submitting ? 'Saving…' : 'Save policy'}
          </button>
        </section>
      ) : screen === 'overview' ? (
        <>
          <section className="expense-summary-card insurance-summary-card">
            <div className="insurance-metrics">
              <div>
                <p className="expenses-total-label">Total annual premium</p>
                <p className="expenses-total-amount">${formatMoney(totalAnnualPremium)}</p>
              </div>
              <div className="insurance-metric">
                <span className="expenses-total-label">Active policies</span>
                <strong>{activePolicies.length}</strong>
              </div>
              <div className="insurance-metric">
                <span className="expenses-total-label">Next payment</span>
                <strong>{formatShortDate(nextPayment)}</strong>
              </div>
              <div className="insurance-metric">
                <span className="expenses-total-label">Expiring soon</span>
                <strong>{expiringSoon}</strong>
              </div>
            </div>
          </section>

          <section className="insurance-section">
            <div className="insurance-section-heading">
              <h2>Upcoming renewals</h2>
              <button
                type="button"
                className="insurance-link"
                data-haptic="select"
                onClick={() => onScreenChange('policies')}
              >
                View all
              </button>
            </div>
            {upcomingRenewals.length === 0 ? (
              <p className="insurance-empty">No upcoming renewals yet.</p>
            ) : (
              <ul className="insurance-list">
                {upcomingRenewals.map((policy) => (
                  <li key={policy.id}>
                    <button
                      type="button"
                      className="insurance-list-row"
                      data-haptic="select"
                      onClick={() => onScreenChange('policies')}
                    >
                      <div className="insurance-list-main">
                        <span className="insurance-list-title">{policy.policyName}</span>
                        <span className="insurance-list-meta">
                          {formatShortDate(policy.renewalDate)} · ${formatMoney(policy.premium)}/
                          {policy.premiumFrequency === 'monthly' ? 'mo' : 'yr'}
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
                  </div>
                  <div className="insurance-policy-card-meta">
                    <div>
                      <span className="expenses-total-label">Premium</span>
                      <strong>
                        ${formatMoney(policy.premium)}/
                        {policy.premiumFrequency === 'monthly' ? 'mo' : 'yr'}
                      </strong>
                    </div>
                    <div>
                      <span className="expenses-total-label">Coverage</span>
                      <strong>
                        {policy.coverageAmount == null
                          ? '—'
                          : `$${formatMoney(policy.coverageAmount)}`}
                      </strong>
                    </div>
                    <div>
                      <span className="expenses-total-label">Renewal</span>
                      <strong>{formatShortDate(policy.renewalDate)}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="insurance-card-delete"
                    data-haptic="light"
                    onClick={() => {
                      if (confirm(`Delete “${policy.policyName}”?`)) {
                        void onDeletePolicy(policy.id)
                      }
                    }}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            className="expense-add-toggle"
            data-haptic="light"
            onClick={() => {
              setError(null)
              setShowPolicyForm(true)
            }}
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
