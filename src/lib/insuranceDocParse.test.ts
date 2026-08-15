import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseExtractedText } from './insuranceDocParse'

const AS_OF = new Date('2026-08-14T00:00:00Z')

const CHINA_TAIPING_SCHEDULE = `
China Taiping Insurance (Singapore) Pte. Ltd.
Dear Valued Customer
POLICY NO.          : 0000521620
LIFE INSURED        : JANE TAN
PLAN                : i-Secure Legacy (II)
A very warm welcome to China Taiping family!
Thank you for choosing China Taiping Insurance Singapore as your financial partner.
Lance Tay
General Manager
Life Insurance

POLICY SCHEDULE
Policy Number: 0000521620

POLICY DETAILS
Plan Name                           : i-Secure Legacy (II)          Currency                        : SGD
Issue Date                          : 10/01/2024                    Premium Mode                    : Yearly
Commencement Date                   : 22/10/2023                    Total Instalment Premium        : $1,555.10
Guaranteed Benefit Factor           :4
Guaranteed Benefit Age Option : 76

Coverage / Benefit                                 Guaranteed            Sum              Instalment      Premium        Coverage
                                                    Benefit             Assured            Premium        End Date       End Date

i-Secure Legacy (II)                               $200,000.00         $50,000.00          $833.90        21/10/2048     Whole Life
(Basic Benefit)

Total and Permanent Disability Rider               $200,000.00         $50,000.00            $85.80       21/10/2048     Whole Life

GENERAL PROVISIONS
Life Insurance Association has prepared a Code of Life Insurance Practice.
`

const FWD_LIFE_PA = `
FWD Singapore Pte. Ltd.
Your FWD Life PA insurance policy schedule
Policy owner
Jane Tan
Accidental Death and Disability Benefit
SGD 100,000.00
Annual premium Monthly premium Total premium during the 1st year
SGD 180.00
Frequency of premium payment selected Yearly
Period of insurance 01/06/2025 to 31/05/2026
`

const AIA_SAMPLE = `
AIA Singapore Private Limited
Product Name: AIA Platinum Retirement
Sum Assured: SGD 150,000
Regular Premium: SGD 2,400.00
Premium Frequency: Annual
Policy Inception Date: 15/03/2022
`

test('extracts China Taiping i-Secure Legacy schedule fields', () => {
  const draft = parseExtractedText(CHINA_TAIPING_SCHEDULE, 'policy.pdf', { asOf: AS_OF })
  assert.equal(draft.insurer, 'China Taiping')
  assert.equal(draft.policyName, 'i-Secure Legacy (II)')
  assert.equal(draft.policyType, 'life')
  assert.equal(draft.premium, 1555.1)
  assert.equal(draft.premiumFrequency, 'annual')
  assert.equal(draft.coverageAmount, 200000)
  assert.equal(draft.renewalDate, '2026-10-22')
  assert.equal(draft.source, 'pdf')
  assert.equal(draft.confidence, 'high')
})

test('extracts China Taiping fields from space-joined PDF text', () => {
  const compact = CHINA_TAIPING_SCHEDULE.replace(/\s+/g, ' ')
  const draft = parseExtractedText(compact, 'policy.pdf', { asOf: AS_OF })
  assert.equal(draft.insurer, 'China Taiping')
  assert.equal(draft.policyName, 'i-Secure Legacy (II)')
  assert.equal(draft.premium, 1555.1)
  assert.equal(draft.coverageAmount, 200000)
  assert.equal(draft.premiumFrequency, 'annual')
})

test('still extracts FWD Life PA schedule fields', () => {
  const draft = parseExtractedText(FWD_LIFE_PA, 'fwd-life-pa.pdf', { asOf: AS_OF })
  assert.equal(draft.insurer, 'FWD')
  assert.equal(draft.policyName, 'Life PA Insurance')
  assert.equal(draft.policyType, 'personal_accident')
  assert.equal(draft.premiumFrequency, 'annual')
  assert.equal(draft.coverageAmount, 100000)
  assert.equal(draft.renewalDate, '2026-05-31')
})

test('extracts AIA-style labeled policy details', () => {
  const draft = parseExtractedText(AIA_SAMPLE, 'aia.pdf', { asOf: AS_OF })
  assert.equal(draft.insurer, 'AIA')
  assert.equal(draft.policyName, 'AIA Platinum Retirement')
  assert.equal(draft.premium, 2400)
  assert.equal(draft.premiumFrequency, 'annual')
  assert.equal(draft.coverageAmount, 150000)
  assert.equal(draft.renewalDate, '2027-03-15')
})

test('does not treat annual income as Income the insurer', () => {
  const draft = parseExtractedText(
    'Annual income SGD 80,000. This illustration is not a policy schedule.',
    'notes.pdf'
  )
  assert.notEqual(draft.insurer, 'Income')
})

test('ignores UUID filenames when the PDF has no text', () => {
  const draft = parseExtractedText('n/a', 'f30d4198-3622-43a5-a1da-ab6df8cc6f9a.pdf')
  assert.equal(draft.source, 'none')
  assert.equal(draft.policyName, undefined)
})
