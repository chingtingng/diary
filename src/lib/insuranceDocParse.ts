import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import type { InsurancePolicyInput, PolicyTypeId, PremiumFrequencyId } from '../types/insurance'

export type ExtractedPolicyDraft = Partial<InsurancePolicyInput> & {
  source: 'pdf' | 'filename' | 'none'
  confidence: 'high' | 'medium' | 'low'
  textLength?: number
  error?: string
}

/** Safari still lacks ReadableStream async iteration used by pdf.js getTextContent. */
function ensurePdfPolyfills() {
  const promiseCtor = Promise as typeof Promise & {
    withResolvers?: () => {
      promise: Promise<unknown>
      resolve: (value?: unknown) => void
      reject: (reason?: unknown) => void
    }
  }
  if (typeof promiseCtor.withResolvers !== 'function') {
    promiseCtor.withResolvers = function withResolvers() {
      let resolve!: (value?: unknown) => void
      let reject!: (reason?: unknown) => void
      const promise = new Promise((res, rej) => {
        resolve = res as (value?: unknown) => void
        reject = rej
      })
      return { promise, resolve, reject }
    }
  }

  if (
    typeof ReadableStream !== 'undefined' &&
    !(Symbol.asyncIterator in ReadableStream.prototype)
  ) {
    Object.defineProperty(ReadableStream.prototype, Symbol.asyncIterator, {
      configurable: true,
      value: async function* (this: ReadableStream<unknown>) {
        const reader = this.getReader()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) return
            yield value
          }
        } finally {
          reader.releaseLock()
        }
      },
    })
  }
}

const KNOWN_INSURERS = [
  'FWD',
  'AIA',
  'Prudential',
  'Income',
  'Great Eastern',
  'GE Life',
  'Aviva',
  'AXA',
  'Allianz',
  'Manulife',
  'HSBC Life',
  'Singlife',
  'Tokio Marine',
  'NTUC Income',
  'Raffles Health',
  'Cigna',
  'Aetna',
  'MetLife',
  'Zurich',
  'China Life',
  'MSIG',
  'Sompo',
  'Liberty Insurance',
  'DirectAsia',
  'Etiqa',
]

const TYPE_KEYWORDS: { id: PolicyTypeId; patterns: RegExp[] }[] = [
  {
    id: 'life',
    patterns: [/\blife\b/i, /\bterm life\b/i, /\bwhole life\b/i, /\blife pa\b/i],
  },
  {
    id: 'disability',
    patterns: [
      /\bdisability\b/i,
      /\bincome protection\b/i,
      /\bcritical illness\b/i,
      /\bpersonal accident\b/i,
      /\baccidental death\b/i,
    ],
  },
  { id: 'health', patterns: [/\bhealth\b/i, /\bhospital\b/i, /\bmedical\b/i, /\bmedi\b/i, /\bshield\b/i] },
  { id: 'auto', patterns: [/\bauto\b/i, /\bmotor\b/i, /\bcar insurance\b/i, /\bvehicle\b/i] },
  { id: 'home', patterns: [/\bhome\b/i, /\bhouse\b/i, /\bproperty\b/i, /\bfire\b/i] },
  { id: 'travel', patterns: [/\btravel\b/i, /\btrip\b/i] },
]

function cleanMoney(raw: string): number | null {
  const normalized = raw.replace(/[, ]/g, '')
  const value = Number(normalized)
  if (!Number.isFinite(value) || value < 0) return null
  return value
}

function parseDateCandidate(raw: string): string | null {
  const trimmed = raw.trim()
  const iso = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
  if (iso) {
    const [, y, m, d] = iso
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (dmy) {
    const [, d, m, yRaw] = dmy
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const named = trimmed.match(
    /^(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})$/i
  )
  if (named) {
    const months: Record<string, string> = {
      jan: '01',
      january: '01',
      feb: '02',
      february: '02',
      mar: '03',
      march: '03',
      apr: '04',
      april: '04',
      may: '05',
      jun: '06',
      june: '06',
      jul: '07',
      july: '07',
      aug: '08',
      august: '08',
      sep: '09',
      sept: '09',
      september: '09',
      oct: '10',
      october: '10',
      nov: '11',
      november: '11',
      dec: '12',
      december: '12',
    }
    const month = months[named[2].toLowerCase()]
    if (month) return `${named[3]}-${month}-${named[1].padStart(2, '0')}`
  }
  return null
}

function detectInsurer(text: string): string | undefined {
  const labeled = text.match(
    /(?:insurer|insurance company|underwriter|provider)\s*[:\-]\s*([A-Za-z][A-Za-z0-9 &.'-]{1,60})/i
  )
  if (labeled?.[1]) return labeled[1].trim()

  const company = text.match(
    /\b(FWD|AIA|Prudential|Income|Great Eastern|Aviva|AXA|Allianz|Manulife|Singlife|Etiqa)\b(?:\s+Singapore)?(?:\s+Pte\.?\s*Ltd\.?)?/i
  )
  if (company?.[1]) {
    const name = company[1]
    if (/^fwd$/i.test(name)) return 'FWD'
    if (/^aia$/i.test(name)) return 'AIA'
    return name
  }

  for (const insurer of KNOWN_INSURERS) {
    const pattern = new RegExp(`\\b${insurer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (pattern.test(text)) return insurer
  }
  return undefined
}

function detectPolicyType(text: string): PolicyTypeId | undefined {
  for (const entry of TYPE_KEYWORDS) {
    if (entry.patterns.some((pattern) => pattern.test(text))) return entry.id
  }
  return undefined
}

function detectPolicyName(text: string, insurer?: string): string | undefined {
  const labeled = text.match(
    /(?:policy name|plan name|product name|your plan|base plan)\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9 &/'().-]{2,80})/i
  )
  if (labeled?.[1]) {
    return labeled[1].replace(/\s{2,}/g, ' ').trim()
  }

  const branded = text.match(
    /\b((?:FWD|AIA|Prudential|Income|Aviva|AXA|Allianz|Manulife|Singlife|Etiqa)\s+[A-Za-z0-9][A-Za-z0-9 &/'().-]{2,50}?)\s+(?:insurance|policy|base plan|application)/i
  )
  if (branded?.[1]) return branded[1].replace(/\s{2,}/g, ' ').trim()

  const lifePa = text.match(/\b((?:FWD\s+)?Life PA)\b/i)
  if (lifePa?.[1]) return /fwd/i.test(lifePa[1]) ? lifePa[1] : `FWD ${lifePa[1]}`

  if (insurer) {
    const around = text.match(
      new RegExp(
        `${insurer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+([A-Z][A-Za-z0-9 &/'().-]{3,60})`,
        'i'
      )
    )
    if (around?.[1] && !/policy|insurance|limited|ltd|pte|singapore/i.test(around[1])) {
      return `${insurer} ${around[1]}`.replace(/\s{2,}/g, ' ').trim()
    }
  }
  return undefined
}

function detectMoney(
  text: string,
  labels: RegExp[]
): { amount: number; frequency?: PremiumFrequencyId } | undefined {
  for (const label of labels) {
    const match = text.match(label)
    if (!match) continue
    const amount = cleanMoney(match[1])
    if (amount == null) continue
    const nearby = match[0].toLowerCase()
    const frequency: PremiumFrequencyId | undefined = nearby.includes('month')
      ? 'monthly'
      : nearby.includes('year') || nearby.includes('annual') || nearby.includes('yearly')
        ? 'annual'
        : undefined
    return { amount, frequency }
  }
  return undefined
}

function detectRenewalDate(text: string): string | undefined {
  const labeled = text.match(
    /(?:renewal date|renews on|expiry date|expiration date|valid until|policy end date|next renewal|coverage end date)\s*[:\-]?\s*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4}|[0-9]{4}[/-][0-9]{1,2}[/-][0-9]{1,2}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/i
  )
  if (!labeled?.[1]) return undefined
  return parseDateCandidate(labeled[1]) ?? undefined
}

function fromFilename(fileName: string, error?: string): ExtractedPolicyDraft {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
  if (!base) return { source: 'none', confidence: 'low', error }

  const insurer = detectInsurer(base)
  const policyType = detectPolicyType(base)
  const policyName = base
    .replace(new RegExp(`\\b${insurer}\\b`, 'ig'), '')
    .replace(/\b(policy|insurance|document|pdf|scan|copy|pack)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  return {
    source: 'filename',
    confidence: insurer || policyName ? 'medium' : 'low',
    insurer,
    policyName: policyName || base,
    policyType,
    error,
  }
}

export function parseExtractedText(text: string, fileName: string): ExtractedPolicyDraft {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (compact.length < 20) {
    return { ...fromFilename(fileName), textLength: compact.length }
  }

  const insurer = detectInsurer(compact) ?? detectInsurer(fileName)
  const policyType = detectPolicyType(compact) ?? detectPolicyType(fileName)
  const policyName =
    detectPolicyName(compact, insurer) ?? fromFilename(fileName).policyName

  const premium =
    detectMoney(compact, [
      /(?:annual premium|yearly premium|yearly premium payable[^\d]{0,40}|total premium during the 1st year)\s*[:\-]?\s*(?:SGD|USD|S\$|\$)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
      /Annual premium\s+Monthly premium\s+Total premium during the 1st year\s*(?:SGD\s*)?([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
      /(?:monthly premium|premium(?:\s+amount)?(?:\s+per\s+month)?)\s*[:\-]?\s*(?:SGD|USD|S\$|\$)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
      /\bpremium\b[^0-9]{0,24}(?:SGD|USD|S\$|\$)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
    ]) ?? undefined

  const coverage =
    detectMoney(compact, [
      /(?:sum assured|sum insured|coverage amount|coverage|insured amount|benefit amount|limit of indemnity)\s*[:\-]?\s*(?:SGD|USD|S\$|\$)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
      /Accidental Death and Disability Benefit\s*(?:SGD|USD|S\$|\$)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
    ]) ?? undefined

  const renewalDate = detectRenewalDate(compact)
  const yearlySelected = /frequency of premium payment(?:\s+selected)?\s*yearly/i.test(compact)

  const filled = Boolean(insurer || policyName || premium || coverage || renewalDate || policyType)

  return {
    source: 'pdf',
    confidence: filled ? (premium || coverage || insurer ? 'high' : 'medium') : 'low',
    textLength: compact.length,
    insurer,
    policyName,
    policyType,
    premium: premium?.amount,
    premiumFrequency:
      premium?.frequency ?? (yearlySelected ? 'annual' : premium ? 'annual' : undefined),
    coverageAmount: coverage?.amount ?? null,
    renewalDate: renewalDate ?? null,
  }
}

async function extractPdfText(file: File): Promise<string> {
  ensurePdfPolyfills()

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker

  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({
    data,
    // Avoid noisy font fetch failures on static hosts
    useSystemFonts: true,
    disableFontFace: true,
  }).promise

  // Policy packs often put the schedule a few pages in.
  const maxPages = Math.min(doc.numPages, 10)
  const chunks: string[] = []

  try {
    for (let pageNum = 1; pageNum <= maxPages; pageNum += 1) {
      const page = await doc.getPage(pageNum)
      const content = await page.getTextContent()
      const items = Array.isArray(content.items) ? content.items : []
      const pageText = items
        .map((item) => (item && typeof item === 'object' && 'str' in item ? String(item.str) : ''))
        .filter(Boolean)
        .join(' ')
      chunks.push(pageText)
      page.cleanup()
    }
  } finally {
    try {
      await doc.cleanup()
    } catch {
      /* ignore cleanup races */
    }
  }

  return chunks.join('\n')
}

/** Best-effort policy details from a PDF (text layer) or filename. */
export async function extractPolicyDraftFromFile(file: File): Promise<ExtractedPolicyDraft> {
  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

  if (!isPdf) return fromFilename(file.name)

  try {
    const text = await extractPdfText(file)
    return parseExtractedText(text, file.name)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not read PDF'
    return fromFilename(file.name, message)
  }
}
