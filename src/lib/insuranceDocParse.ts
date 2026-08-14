import type { InsurancePolicyInput, PolicyTypeId, PremiumFrequencyId } from '../types/insurance'

export type ExtractedPolicyDraft = Partial<InsurancePolicyInput> & {
  source: 'pdf' | 'filename' | 'none'
  confidence: 'high' | 'medium' | 'low'
}

const KNOWN_INSURERS = [
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
  'FWD',
  'China Life',
  'MSIG',
  'Sompo',
  'Liberty Insurance',
  'DirectAsia',
  'Etiqa',
]

const TYPE_KEYWORDS: { id: PolicyTypeId; patterns: RegExp[] }[] = [
  { id: 'health', patterns: [/\bhealth\b/i, /\bhospital\b/i, /\bmedical\b/i, /\bmedi\b/i, /\bshield\b/i] },
  { id: 'life', patterns: [/\blife\b/i, /\bterm life\b/i, /\bwhole life\b/i] },
  { id: 'auto', patterns: [/\bauto\b/i, /\bmotor\b/i, /\bcar insurance\b/i, /\bvehicle\b/i] },
  { id: 'home', patterns: [/\bhome\b/i, /\bhouse\b/i, /\bproperty\b/i, /\bfire\b/i] },
  { id: 'travel', patterns: [/\btravel\b/i, /\btrip\b/i] },
  { id: 'disability', patterns: [/\bdisability\b/i, /\bincome protection\b/i, /\bci\b/i, /\bcritical illness\b/i] },
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
    /(?:policy name|plan name|product name|product|plan)\s*[:\-]\s*([A-Za-z0-9][A-Za-z0-9 &/'().-]{2,80})/i
  )
  if (labeled?.[1]) {
    return labeled[1].replace(/\s{2,}/g, ' ').trim()
  }

  if (insurer) {
    const around = text.match(
      new RegExp(
        `${insurer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+([A-Z][A-Za-z0-9 &/'().-]{3,60})`,
        'i'
      )
    )
    if (around?.[1] && !/policy|insurance|limited|ltd|pte/i.test(around[1])) {
      return around[1].replace(/\s{2,}/g, ' ').trim()
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
      : nearby.includes('year') || nearby.includes('annual')
        ? 'annual'
        : undefined
    return { amount, frequency }
  }
  return undefined
}

function detectRenewalDate(text: string): string | undefined {
  const labeled = text.match(
    /(?:renewal date|renews on|expiry date|expiration date|valid until|policy end date|next renewal)\s*[:\-]?\s*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4}|[0-9]{4}[/-][0-9]{1,2}[/-][0-9]{1,2}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/i
  )
  if (!labeled?.[1]) return undefined
  return parseDateCandidate(labeled[1]) ?? undefined
}

function fromFilename(fileName: string): ExtractedPolicyDraft {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
  if (!base) return { source: 'none', confidence: 'low' }

  const insurer = detectInsurer(base)
  const policyType = detectPolicyType(base)
  const policyName = base
    .replace(new RegExp(`\\b${insurer}\\b`, 'ig'), '')
    .replace(/\b(policy|insurance|document|pdf|scan|copy)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  return {
    source: 'filename',
    confidence: insurer || policyName ? 'medium' : 'low',
    insurer,
    policyName: policyName || base,
    policyType,
  }
}

function parseExtractedText(text: string, fileName: string): ExtractedPolicyDraft {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (compact.length < 20) return fromFilename(fileName)

  const insurer = detectInsurer(compact) ?? detectInsurer(fileName)
  const policyType = detectPolicyType(compact) ?? detectPolicyType(fileName)
  const policyName =
    detectPolicyName(compact, insurer) ?? fromFilename(fileName).policyName

  const premium =
    detectMoney(compact, [
      /(?:annual premium|yearly premium|premium(?:\s+amount)?(?:\s+per\s+year)?)\s*[:\-]?\s*(?:SGD|USD|S\$|\$)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
      /(?:monthly premium|premium(?:\s+amount)?(?:\s+per\s+month)?)\s*[:\-]?\s*(?:SGD|USD|S\$|\$)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
      /\bpremium\b[^0-9]{0,20}(?:SGD|USD|S\$|\$)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
    ]) ?? undefined

  const coverage =
    detectMoney(compact, [
      /(?:sum assured|coverage amount|coverage|insured amount|benefit amount|limit of indemnity)\s*[:\-]?\s*(?:SGD|USD|S\$|\$)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
    ]) ?? undefined

  const renewalDate = detectRenewalDate(compact)

  const filled = Boolean(insurer || policyName || premium || coverage || renewalDate || policyType)

  return {
    source: 'pdf',
    confidence: filled ? (premium || coverage || insurer ? 'high' : 'medium') : 'low',
    insurer,
    policyName,
    policyType,
    premium: premium?.amount,
    premiumFrequency: premium?.frequency ?? (premium ? 'annual' : undefined),
    coverageAmount: coverage?.amount ?? null,
    renewalDate: renewalDate ?? null,
  }
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()

  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data }).promise
  const maxPages = Math.min(doc.numPages, 4)
  const chunks: string[] = []

  try {
    for (let pageNum = 1; pageNum <= maxPages; pageNum += 1) {
      const page = await doc.getPage(pageNum)
      const content = await page.getTextContent()
      const pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .filter(Boolean)
        .join(' ')
      chunks.push(pageText)
      page.cleanup()
    }
  } finally {
    await doc.cleanup()
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
  } catch {
    return fromFilename(file.name)
  }
}
