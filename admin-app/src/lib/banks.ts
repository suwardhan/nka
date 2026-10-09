import type { NamedCount } from '@/lib/sheets'

/** First tokens that look like codes but are not banks. */
const NON_BANK_TOKENS = new Set([
  'PERSONAL',
  'AREA',
  'LATUR',
  'INCOME',
  'BRANCH',
  'OFFICE',
  'THE',
  'AND',
  'BANK', // generic word in "TJSB BANK", "Bank of Maharashtra", …
])

/**
 * Seed vocabulary from banks on the public site / common lenders.
 * Additional codes are discovered by scanning area-office first tokens.
 */
const SEED_BANKS = [
  'LIC',
  'SBI',
  'TJSB',
  'UNION',
  'BOM',
  'GIC',
  'BOI',
  'PNB',
  'HDFC',
  'ICICI',
  'AXIS',
]

/**
 * Multi-word (or alternate) phrases that map to a seed bank code.
 * Checked before single-token matching.
 */
const BANK_PHRASES: Array<{ bank: string; phrase: string }> = [
  { bank: 'BOM', phrase: 'BANK OF MAHARASHTRA' },
]

export const BANK_FILTER_OTHERS = 'Others'

function tokenize(name: string): string[] {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

function discoverBankVocabulary(areaOffices: NamedCount[]): string[] {
  const vocabulary = new Set(SEED_BANKS)

  for (const { name } of areaOffices) {
    const first = tokenize(name)[0]
    if (
      first &&
      /^[A-Z]{2,6}$/.test(first) &&
      !NON_BANK_TOKENS.has(first)
    ) {
      vocabulary.add(first)
    }
  }

  // Longer codes first so e.g. TJSB / CANFIN win over shorter prefixes.
  return [...vocabulary].sort((a, b) => b.length - a.length || a.localeCompare(b))
}

/** Matched bank code for an office name, or null if unrecognized. */
export function bankForOffice(name: string, banks: string[]): string | null {
  const haystack = ` ${tokenize(name).join(' ')} `

  for (const { bank, phrase } of BANK_PHRASES) {
    if (haystack.includes(` ${phrase} `)) {
      return bank
    }
  }

  return banks.find((bank) => haystack.includes(` ${bank} `)) ?? null
}

/**
 * Banks present in the data (by case count desc), plus "Others" when needed.
 * Used to populate the Area offices filter.
 */
export function listPresentBanks(areaOffices: NamedCount[]): {
  banks: string[]
  hasOthers: boolean
} {
  const vocabulary = discoverBankVocabulary(areaOffices)
  const totals = new Map<string, number>()
  let hasOthers = false

  for (const { name, count } of areaOffices) {
    const matched = bankForOffice(name, vocabulary)
    if (matched) {
      totals.set(matched, (totals.get(matched) ?? 0) + count)
    } else {
      hasOthers = true
    }
  }

  const banks = [...totals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name)

  return { banks, hasOthers }
}

/**
 * Filter offices by one or more bank codes.
 * Empty selection means show all offices.
 */
export function filterAreaOfficesByBank(
  areaOffices: NamedCount[],
  selectedBanks: string[],
): NamedCount[] {
  if (selectedBanks.length === 0) {
    return areaOffices
  }

  const vocabulary = discoverBankVocabulary(areaOffices)
  const selected = new Set(selectedBanks)

  return areaOffices.filter((office) => {
    const matched = bankForOffice(office.name, vocabulary)
    if (matched == null) {
      return selected.has(BANK_FILTER_OTHERS)
    }
    return selected.has(matched)
  })
}

/**
 * Aggregate case counts by bank token found case-insensitively in the
 * area-office name. Names with no recognized bank go to "Others".
 */
export function countCasesByBank(areaOffices: NamedCount[]): NamedCount[] {
  const banks = discoverBankVocabulary(areaOffices)
  const totals = new Map<string, number>()
  let others = 0

  for (const { name, count } of areaOffices) {
    const matched = bankForOffice(name, banks)

    if (matched) {
      totals.set(matched, (totals.get(matched) ?? 0) + count)
    } else {
      others += count
    }
  }

  const rows = [...totals.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  if (others > 0) {
    rows.push({ name: BANK_FILTER_OTHERS, count: others })
  }

  return rows
}
