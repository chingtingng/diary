import type { InsurancePolicyInput, PolicyTypeId, PremiumFrequencyId } from '../types/insurance'

export type ExtractedPolicyDraft = Partial<InsurancePolicyInput> & {
  source: 'pdf' | 'filename' | 'none'
  confidence: 'high' | 'medium' | 'low'
  textLength?: number
  error?: string
}

export type ParseExtractOptions = {
  /** Used when inferring the next policy anniversary. Defaults to now. */
  asOf?: Date
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

const KNOWN_INSURERS: { name: string; pattern: RegExp }[] = [
  { name: 'China Taiping', pattern: /\bchina\s+taiping\b|\bctpis\b/i },
  { name: 'Great Eastern', pattern: /\bgreat\s+eastern\b|\bge\s+life\b/i },
  { name: 'NTUC Income', pattern: /\bntuc\s+income\b/i },
  { name: 'HSBC Life', pattern: /\bhsbc\s+life\b/i },
  { name: 'Tokio Marine', pattern: /\btokio\s+marine\b/i },
  { name: 'Raffles Health', pattern: /\braffles\s+health\b/i },
  { name: 'Liberty Insurance', pattern: /\bliberty\s+insurance\b/i },
  { name: 'China Life', pattern: /\bchina\s+life\b/i },
  { name: 'Prudential', pattern: /\bprudential\b/i },
  { name: 'Manulife', pattern: /\bmanulife\b/i },
  { name: 'Singlife', pattern: /\bsinglife\b/i },
  { name: 'FWD', pattern: /\bfwd\b/i },
  { name: 'AIA', pattern: /\baia\b/i },
  { name: 'AXA', pattern: /\baxa\b/i },
  { name: 'Aviva', pattern: /\baviva\b/i },
  { name: 'Allianz', pattern: /\ballianz\b/i },
  { name: 'Etiqa', pattern: /\betiqa\b/i },
  { name: 'MSIG', pattern: /\bmsig\b/i },
  { name: 'Sompo', pattern: /\bsompo\b/i },
  { name: 'Cigna', pattern: /\bcigna\b/i },
  { name: 'Aetna', pattern: /\baetna\b/i },
  { name: 'MetLife', pattern: /\bmetlife\b/i },
  { name: 'Zurich', pattern: /\bzurich\b/i },
  { name: 'DirectAsia', pattern: /\bdirectasia\b/i },
]

const STOP_LABELS = [
  'currency',
  'issue date',
  'commencement date',
  'effective date',
  'inception date',
  'premium mode',
  'payment frequency',
  'frequency of premium payment',
  'plan name',
  'product name',
  'policy name',
  'policy number',
  'policy no',
  'policy owner',
  'life insured',
  'identity number',
  'gender',
  'age next birthday',
  'total instalment premium',
  'sum assured',
  'sum insured',
  'guaranteed benefit factor',
  'guaranteed benefit age option',
  'coverage end date',
  'premium end date',
  'period of insurance',
  'renewal date',
  'expiry date',
]

const MONEY_RE = /(?:SGD|USD|HKD|RM|S\$|HK\$|\$)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i
const BARE_MONEY_RE = /([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]+\.[0-9]{2})/

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function labelPattern(labels: string[]): string {
  return labels
    .map((label) => escapeRe(label).replace(/\\ /g, '\\s+'))
    .join('|')
}

function normalizeText(text: string): string {
  return text
    .replace(/[\u00B9\u00B2\u00B3\u2070-\u2079]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
}

function compactText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function extractScheduleBlock(text: string): string {
  const start = text.search(
    /policy schedule|certificate of insurance|schedule of benefits|policy information\b/i
  )
  if (start < 0) return ''
  const rest = text.slice(start)
  const end = rest.search(
    /\n\s*(general provisions|policy provisions|important notes?\b|your policy wording|table of contents|definitions\b)/i
  )
  const block = end > 200 ? rest.slice(0, end) : rest.slice(0, 6000)
  return block.slice(0, 6000)
}

function primaryText(text: string): string {
  const schedule = extractScheduleBlock(text)
  const head = text.slice(0, 4000)
  if (!schedule) return head
  if (schedule.length >= 80 && head.includes(schedule.slice(0, 80))) return head
  return `${head}\n${schedule}`
}

function cleanLabelValue(raw: string): string {
  return raw
    .replace(/[\u00B9\u00B2\u00B3\u2070-\u2079]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+[:-]\s*$/g, '')
    .trim()
}

function labeledValue(text: string, labels: string[]): string | undefined {
  const labelsPart = labelPattern(labels)
  const stopPart = labelPattern(STOP_LABELS)
  const pattern = new RegExp(
    `(?:^|[\\n\\r]|\\s)(?:${labelsPart})\\s*[:\\-]\\s*(.+?)(?=\\s+(?:${stopPart})\\s*[:\\-]|[\\n\\r]|$)`,
    'i'
  )
  const match = text.match(pattern)
  if (!match?.[1]) return undefined
  const value = cleanLabelValue(match[1])
  return value || undefined
}

function cleanMoney(raw: string): number | null {
  const normalized = raw.replace(/[, ]/g, '')
  const value = Number(normalized)
  if (!Number.isFinite(value) || value < 0) return null
  return value
}

function parseMoney(raw: string): number | null {
  const withCurrency = raw.match(MONEY_RE)
  if (withCurrency?.[1]) return cleanMoney(withCurrency[1])
  const bare = raw.match(BARE_MONEY_RE)
  if (bare?.[1]) return cleanMoney(bare[1])
  const simple = raw.match(/([0-9]+(?:\.[0-9]{1,2})?)/)
  if (!simple?.[1]) return null
  return cleanMoney(simple[1])
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

function firstDateIn(raw: string): string | undefined {
  const candidates = raw.match(
    /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}\s+[A-Za-z]+\s+\d{4}/g
  )
  if (!candidates) return undefined
  for (const candidate of candidates) {
    const parsed = parseDateCandidate(candidate)
    if (parsed) return parsed
  }
  return undefined
}

function looksLikeTableNoise(value: string): boolean {
  return /benefits|sum insured|period of insurance|premium payment|section\b|application form|policy owner|how much you would pay|life insured|identity number|policy number|customer service/i.test(
    value
  )
}

function looksLikeCompanyName(value: string, insurer?: string): boolean {
  if (insurer) {
    const brand = new RegExp(
      `^${escapeRe(insurer)}(?:\\s+insurance(?:\\s+\\([^)]+\\))?(?:\\s+pte\\.?\\s*ltd\\.?)?)?$`,
      'i'
    )
    if (brand.test(value)) return true
  }
  return (
    /pte\.?\s*ltd/i.test(value) ||
    /insurance\s+\(/i.test(value) ||
    /insurance\s+(singapore|company|group)\b/i.test(value) ||
    /association|practice|code of/i.test(value)
  )
}

function isPlausiblePolicyName(value: string, insurer?: string): boolean {
  const trimmed = value.trim()
  if (trimmed.length < 2 || trimmed.length > 80) return false
  if (/^(sgd|usd|hkd|rm|yearly|monthly|quarterly|whole life|female|male|active)$/i.test(trimmed)) {
    return false
  }
  if (/^\d+$/.test(trimmed)) return false
  if (looksLikeTableNoise(trimmed) || looksLikeCompanyName(trimmed, insurer)) return false
  return true
}

function canonicalInsurer(raw: string): string {
  const flattened = raw.replace(/\s+/g, ' ').trim()
  for (const insurer of KNOWN_INSURERS) {
    if (insurer.pattern.test(flattened)) return insurer.name
  }
  return flattened
    .replace(/\s+pte\.?\s*ltd\.?$/i, '')
    .replace(/\s+\([^)]*\)\s*$/g, '')
    .replace(/\s+insurance$/i, '')
    .trim() || flattened
}

function detectInsurer(text: string): string | undefined {
  const legal = text.match(
    /\b((?:[A-Z][A-Za-z]+(?:\s+|&))+Insurance(?:\s+\((?:Singapore|Hong Kong|Malaysia)\))?(?:\s+Pte\.?\s*Ltd\.?)?)/
  )
  if (
    legal?.[1] &&
    !/association|practice|code of|^life insurance$|^general insurance$/i.test(legal[1])
  ) {
    return canonicalInsurer(legal[1])
  }

  const letterhead = text.match(
    /\b(China Taiping|FWD|AIA|Prudential|Great Eastern|Aviva|AXA|Allianz|Manulife|Singlife|Etiqa|MSIG|Sompo|Income)\s+(?:Insurance\s+)?Singapore(?:\s+Pte\.?\s*Ltd\.?)?/i
  )
  if (letterhead?.[1] && !/^income$/i.test(letterhead[1])) {
    return canonicalInsurer(letterhead[1])
  }

  const brandedProduct = text.match(
    /\b(FWD|AIA|Prudential|Great Eastern|Aviva|AXA|Allianz|Manulife|Singlife|Etiqa|China Taiping)\s+(?:Life|Health|Shield|PA|Medical|Travel|Car|Home)\b/i
  )
  if (brandedProduct?.[1]) return canonicalInsurer(brandedProduct[1])

  const labeled = labeledValue(text, ['insurer', 'insurance company', 'underwriter', 'issued by'])
  if (labeled && !/annual|monthly|premium|\bincome\b/i.test(labeled)) {
    return canonicalInsurer(labeled)
  }

  if (
    /\bNTUC\s+Income\b/i.test(text) ||
    /\bIncome\s+Insurance\b/i.test(text) ||
    /\bIncome\s+Singapore\b/i.test(text)
  ) {
    return 'Income'
  }

  for (const insurer of KNOWN_INSURERS) {
    if (insurer.pattern.test(text)) return insurer.name
  }
  return undefined
}

function detectPolicyType(policyName: string | undefined, text: string): PolicyTypeId | undefined {
  const name = policyName ?? ''
  // Name rules first — product titles like “Life PA” are more reliable than body text.
  const nameRules: { id: PolicyTypeId; pattern: RegExp }[] = [
    { id: 'travel', pattern: /\btravel\b/i },
    { id: 'auto', pattern: /\b(?:auto|motor|car)\b/i },
    { id: 'home', pattern: /\b(?:home|house|householder|fire)\b/i },
    // “Life PA” / “Personal Accident” are PA products, not life or disability.
    {
      id: 'personal_accident',
      pattern: /\blife\s*pa\b|\bpersonal\s+accident\b|\bpa\s+insurance\b|\baccidental\b/i,
    },
    {
      id: 'critical_illness',
      pattern: /\bcritical\s+illness\b|\bearly\s+ci\b|\bci\s+(?:cover|rider|plan)\b|\bdread\s+disease\b/i,
    },
    {
      id: 'disability',
      pattern: /\bdisability\b|\bincome\s+protection\b|\btotal\s+(?:and\s+)?permanent\s+disability\b|\btpd\b/i,
    },
    {
      id: 'health',
      pattern: /\b(?:health|hospital|medical|medi\s?shield|integrated\s+shield)\b/i,
    },
    {
      id: 'life',
      pattern: /\bwhole\s+life\b|\bterm\s+life\b|\bendowment\b|\blegacy\b|\blife\s+insurance\b|\blife\b/i,
    },
  ]
  for (const rule of nameRules) {
    if (rule.pattern.test(name)) return rule.id
  }

  const textRules: { id: PolicyTypeId; patterns: RegExp[] }[] = [
    { id: 'travel', patterns: [/\btravel insurance\b/i] },
    { id: 'auto', patterns: [/\b(?:motor|car) insurance\b/i] },
    { id: 'home', patterns: [/\b(?:home|householder|fire) insurance\b/i] },
    {
      id: 'personal_accident',
      patterns: [
        /\bpersonal accident\b/i,
        /\blife\s*pa\b/i,
        /\baccidental death\b/i,
        /\baccidental (?:permanent )?disability\b/i,
      ],
    },
    {
      id: 'critical_illness',
      patterns: [/\bcritical illness\b/i, /\bdread disease\b/i],
    },
    {
      id: 'disability',
      patterns: [
        /\bincome protection\b/i,
        /\bdisability income\b/i,
        /\btotal (?:and )?permanent disability\b/i,
      ],
    },
    {
      id: 'health',
      patterns: [/\bintegrated shield\b/i, /\bhospital(?:isation)?\b/i, /\bmedi\s?shield\b/i],
    },
    {
      id: 'life',
      patterns: [/\bwhole life\b/i, /\bterm life\b/i, /\blife insurance\b/i, /\blife insured\b/i],
    },
  ]
  for (const rule of textRules) {
    if (rule.patterns.some((pattern) => pattern.test(text))) return rule.id
  }
  return undefined
}

function detectPolicyName(text: string, insurer?: string): string | undefined {
  const named = labeledValue(text, ['plan name', 'product name', 'policy name'])
  if (named && isPlausiblePolicyName(named, insurer)) return named

  const plan = labeledValue(text, ['plan'])
  if (plan && isPlausiblePolicyName(plan, insurer)) return plan

  const schedule = text.match(
    /Your\s+((?:FWD|AIA|Prudential|Income|Aviva|AXA|Allianz|Manulife|Singlife|Etiqa|China Taiping)\s+[A-Za-z0-9 &/'().-]{2,40}?)\s+insurance policy schedule/i
  )
  if (schedule?.[1] && !looksLikeTableNoise(schedule[1])) {
    const name = schedule[1].replace(/\s{2,}/g, ' ').trim()
    if (/life pa/i.test(name)) return 'Life PA Insurance'
    if (isPlausiblePolicyName(name, insurer)) return name
  }

  const titled = text.match(
    /\b((?:FWD|AIA|Prudential|Income|Aviva|AXA|Allianz|Manulife|Singlife|Etiqa|China Taiping)\s+)?(Life PA Insurance|Life PA|Hospital Shield|[A-Z][A-Za-z0-9 &/'().-]{2,40} Insurance)\b/i
  )
  if (titled) {
    const brand = titled[1]?.trim()
    const product = titled[2].replace(/\s{2,}/g, ' ').trim()
    if (!looksLikeTableNoise(product) && !looksLikeCompanyName(product, insurer ?? brand)) {
      if (/^life pa(?: insurance)?$/i.test(product)) return 'Life PA Insurance'
      if (brand && !new RegExp(`^${escapeRe(brand)}`, 'i').test(product)) {
        const combined = `${brand} ${product}`.replace(/\s{2,}/g, ' ').trim()
        if (isPlausiblePolicyName(combined, insurer)) return combined
      }
      if (isPlausiblePolicyName(product, insurer)) return product
    }
  }

  const lifePa = text.match(/\bLife PA(?:\s+Insurance)?\b/i)
  if (lifePa) return 'Life PA Insurance'

  if (insurer) {
    const around = text.match(
      new RegExp(
        `${escapeRe(insurer)}\\s+(Life PA(?:\\s+Insurance)?|[A-Z][A-Za-z0-9 &/'().-]{2,40})`,
        'i'
      )
    )
    if (around?.[1] && isPlausiblePolicyName(around[1], insurer)) {
      if (/life pa/i.test(around[1])) return 'Life PA Insurance'
      return around[1].replace(/\s{2,}/g, ' ').trim()
    }
  }
  return undefined
}

function detectFrequency(text: string): {
  frequency?: PremiumFrequencyId
  multiplier: number
} {
  const mode =
    labeledValue(text, [
      'premium mode',
      'payment frequency',
      'frequency of premium payment',
      'premium frequency',
    ]) ?? ''
  if (/monthly/i.test(mode) || /frequency of premium payment(?:\s+selected)?\s*monthly/i.test(text)) {
    return { frequency: 'monthly', multiplier: 1 }
  }
  if (/quarterly/i.test(mode)) {
    return { frequency: 'annual', multiplier: 4 }
  }
  if (/half[-\s]?year/i.test(mode)) {
    return { frequency: 'annual', multiplier: 2 }
  }
  if (
    /(yearly|annual)/i.test(mode) ||
    /frequency of premium payment(?:\s+selected)?\s*(?:yearly|annual)/i.test(text)
  ) {
    return { frequency: 'annual', multiplier: 1 }
  }
  return { multiplier: 1 }
}

function firstMoneyAfter(text: string, label: RegExp, maxGap = 80): number | undefined {
  const match = text.match(label)
  if (!match || match.index == null) return undefined
  const window = text.slice(match.index, match.index + match[0].length + maxGap)
  const money = window.match(MONEY_RE) ?? window.match(BARE_MONEY_RE)
  if (!money?.[1] && !money?.[0]) return undefined
  const amount = parseMoney(money[0])
  return amount ?? undefined
}

function detectPremium(
  text: string
): { amount: number; frequency?: PremiumFrequencyId } | undefined {
  const { frequency, multiplier } = detectFrequency(text)
  const labeled = labeledValue(text, [
    'total instalment premium',
    'total premium during the 1st year',
    'yearly premium payable',
    'annual premium',
    'yearly premium',
    'total premium payable',
    'total premium',
    'modal premium',
    'regular premium',
    'premium payable',
    'monthly premium',
  ])
  if (labeled) {
    const amount = parseMoney(labeled)
    if (amount != null && amount > 0 && amount < 100000) {
      return { amount: roundMoney(amount * multiplier), frequency }
    }
  }

  const patterns: RegExp[] = [
    /total\s+instalment\s+premium/i,
    /total premium during the 1st year/i,
    /yearly premium payable/i,
    /annual premium/i,
    /yearly premium/i,
    /total premium payable/i,
    /modal premium/i,
    /regular premium/i,
    /monthly premium/i,
  ]
  for (const pattern of patterns) {
    const amount = firstMoneyAfter(text, pattern, 60)
    if (amount != null && amount > 0 && amount < 100000) {
      const nearbyMonthly = /monthly premium/i.test(pattern.source)
      return {
        amount: roundMoney(amount * multiplier),
        frequency: frequency ?? (nearbyMonthly ? 'monthly' : undefined),
      }
    }
  }

  const fwdTable = text.match(
    /Annual premium\s+Monthly premium\s+Total premium during the 1st year\s*(?:SGD\s*)?([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i
  )
  if (fwdTable?.[1]) {
    const amount = cleanMoney(fwdTable[1])
    if (amount != null) return { amount, frequency: frequency ?? 'annual' }
  }

  const generic = text.match(
    /\bpremium\b[^0-9]{0,24}(?:SGD|USD|S\$|\$)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i
  )
  if (generic?.[1]) {
    const amount = cleanMoney(generic[1])
    if (amount != null && amount > 0 && amount < 100000) {
      return { amount: roundMoney(amount * multiplier), frequency }
    }
  }
  return undefined
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function detectCoverage(text: string): number | undefined {
  const table = text.match(
    /coverage\s*\/\s*benefit[\s\S]{0,500}?((?:SGD|USD|S\$|HK\$|RM|\$)\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?)/i
  )
  if (table?.[1]) {
    const amount = parseMoney(table[1])
    if (amount != null && amount >= 1000) return amount
  }

  const accidental = text.match(
    /Accidental Death(?:\s+and\s+Disability)? Benefit\s*(?:SGD|USD|S\$|\$)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i
  )
  if (accidental?.[1]) {
    const amount = cleanMoney(accidental[1])
    if (amount != null && amount >= 1000) return amount
  }

  const labels = [
    'guaranteed benefit',
    'sum assured',
    'sum insured',
    'coverage amount',
    'insured amount',
    'death benefit',
    'benefit amount',
    'limit of indemnity',
  ]
  const labeled = labeledValue(text, labels)
  if (labeled) {
    const amount = parseMoney(labeled)
    if (amount != null && amount >= 1000) return amount
  }

  for (const label of [
    /guaranteed benefit(?!\s+factor)/i,
    /sum assured/i,
    /sum insured/i,
    /coverage amount/i,
    /death benefit/i,
  ]) {
    const amount = firstMoneyAfter(text, label, 140)
    if (amount != null && amount >= 1000) return amount
  }
  return undefined
}

function nextAnniversary(fromIso: string, asOf: Date): string {
  const parts = fromIso.split('-')
  const month = Number(parts[1])
  const day = Number(parts[2])
  const asOfIso = `${asOf.getFullYear()}-${String(asOf.getMonth() + 1).padStart(2, '0')}-${String(asOf.getDate()).padStart(2, '0')}`
  let year = asOf.getFullYear()
  const pad = (value: number) => String(value).padStart(2, '0')
  let candidate = `${year}-${pad(month)}-${pad(day)}`
  if (candidate <= asOfIso) {
    year += 1
    candidate = `${year}-${pad(month)}-${pad(day)}`
  }
  return candidate
}

function detectRenewalDate(text: string, asOf: Date): string | undefined {
  const labeled = labeledValue(text, [
    'renewal date',
    'renews on',
    'expiry date',
    'expiration date',
    'valid until',
    'policy end date',
    'next renewal',
    'coverage end date',
    'period of insurance',
  ])
  if (labeled) {
    const parsed = parseDateCandidate(labeled) ?? firstDateIn(labeled)
    if (parsed) return parsed
  }

  const inline = text.match(
    /(?:renewal date|renews on|expiry date|expiration date|valid until|policy end date|next renewal)\s*[:-]?\s*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4}|[0-9]{4}[/-][0-9]{1,2}[/-][0-9]{1,2}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/i
  )
  if (inline?.[1]) {
    const parsed = parseDateCandidate(inline[1])
    if (parsed) return parsed
  }

  const period = text.match(
    /period of insurance[^0-9]{0,40}(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}\s+[A-Za-z]+\s+\d{4})\s*(?:to|-|–|until)\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/i
  )
  if (period?.[2]) {
    const parsed = parseDateCandidate(period[2])
    if (parsed) return parsed
  }

  const start = labeledValue(text, [
    'commencement date',
    'effective date',
    'inception date',
    'policy start date',
    'start date',
  ])
  if (start) {
    const parsed = parseDateCandidate(start) ?? firstDateIn(start)
    if (parsed) return nextAnniversary(parsed, asOf)
  }
  return undefined
}

function looksLikeGeneratedFileName(fileName: string): boolean {
  const base = fileName.replace(/\.[^.]+$/, '')
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(base)
}

function fromFilename(fileName: string, error?: string): ExtractedPolicyDraft {
  if (looksLikeGeneratedFileName(fileName)) {
    return { source: 'none', confidence: 'low', error }
  }

  const base = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
  if (!base) return { source: 'none', confidence: 'low', error }

  const insurer = detectInsurer(base)
  const policyType = detectPolicyType(base, base)
  const policyName = base
    .replace(new RegExp(`\\b${escapeRe(insurer ?? '')}\\b`, 'ig'), '')
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

export function parseExtractedText(
  text: string,
  fileName: string,
  options: ParseExtractOptions = {}
): ExtractedPolicyDraft {
  const normalized = normalizeText(text)
  const compact = compactText(normalized)
  if (compact.length < 20) {
    return { ...fromFilename(fileName), textLength: compact.length }
  }

  const asOf = options.asOf ?? new Date()
  const focused = primaryText(normalized)
  const focusedCompact = compactText(focused)
  const search = `${focused}\n${focusedCompact}`

  const insurer = detectInsurer(search) ?? detectInsurer(compact) ?? detectInsurer(fileName)
  const policyName =
    detectPolicyName(search, insurer) ??
    detectPolicyName(compact, insurer) ??
    (fromFilename(fileName).policyName && !looksLikeGeneratedFileName(fileName)
      ? fromFilename(fileName).policyName
      : undefined)
  const policyType =
    detectPolicyType(policyName, search) ??
    detectPolicyType(policyName, compact) ??
    detectPolicyType(fileName, fileName)

  const premium = detectPremium(search) ?? detectPremium(compact)
  const coverage = detectCoverage(search) ?? detectCoverage(compact)
  const renewalDate = detectRenewalDate(search, asOf) ?? detectRenewalDate(compact, asOf)
  const yearlySelected = /frequency of premium payment(?:\s+selected)?\s*yearly/i.test(search)

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
    coverageAmount: coverage ?? null,
    renewalDate: renewalDate ?? null,
  }
}

type PdfTextItem = {
  str?: string
  transform?: number[]
  width?: number
}

function isTextItem(item: unknown): item is PdfTextItem {
  return Boolean(item && typeof item === 'object' && 'str' in item)
}

function pageItemsToText(items: unknown[]): string {
  const rows: { x: number; y: number; str: string; width: number }[] = []
  for (const item of items) {
    if (!isTextItem(item)) continue
    const str = String(item.str ?? '')
    if (!str) continue
    const transform = Array.isArray(item.transform) ? item.transform : []
    rows.push({
      x: Number(transform[4]) || 0,
      y: Number(transform[5]) || 0,
      str,
      width: Number(item.width) || 0,
    })
  }
  if (rows.length === 0) return ''

  rows.sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: string[] = []
  const yTol = 4
  let bucket: typeof rows = []
  let bucketY = 0

  const flush = () => {
    if (!bucket.length) return
    bucket.sort((a, b) => a.x - b.x)
    let line = bucket[0].str
    let prev = bucket[0]
    for (let i = 1; i < bucket.length; i += 1) {
      const cur = bucket[i]
      const gap = cur.x - (prev.x + prev.width)
      if (gap > 12) line += '   '
      else if (!line.endsWith(' ') && !cur.str.startsWith(' ')) line += ' '
      line += cur.str
      prev = cur
    }
    lines.push(line.replace(/[ \t]+$/g, ''))
    bucket = []
  }

  for (const row of rows) {
    if (!bucket.length) {
      bucket = [row]
      bucketY = row.y
      continue
    }
    if (Math.abs(row.y - bucketY) <= yTol) {
      bucket.push(row)
    } else {
      flush()
      bucket = [row]
      bucketY = row.y
    }
  }
  flush()
  return lines.join('\n')
}

async function extractPdfText(file: File): Promise<string> {
  ensurePdfPolyfills()

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  try {
    const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
    if (typeof worker.default === 'string' && worker.default.length > 0) {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    }
  } catch {
    /* Vite `?url` is unavailable outside the bundler; pdf.js can still parse on the main thread. */
  }

  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({
    data,
    // Avoid noisy font fetch failures on static hosts
    useSystemFonts: true,
    disableFontFace: true,
  }).promise

  const maxPages = Math.min(doc.numPages, 15)
  const chunks: string[] = []
  let schedulePage: number | null = null

  try {
    for (let pageNum = 1; pageNum <= maxPages; pageNum += 1) {
      const page = await doc.getPage(pageNum)
      const content = await page.getTextContent()
      const items = Array.isArray(content.items) ? content.items : []
      const pageText = pageItemsToText(items)
      chunks.push(pageText)
      page.cleanup()

      if (schedulePage == null && /policy\s+schedule|certificate of insurance/i.test(pageText)) {
        schedulePage = pageNum
      }
      const enoughContext = schedulePage != null && pageNum >= Math.max(schedulePage + 1, 5)
      if (enoughContext) break
    }
  } finally {
    try {
      await doc.cleanup()
    } catch {
      /* ignore cleanup races */
    }
  }

  return chunks.join('\n\n')
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
