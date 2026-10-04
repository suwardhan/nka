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

  // Longer codes first so e.g. TJSB wins over a hypothetical TJ.
  return [...vocabulary].sort((a, b) => b.length - a.length || a.localeCompare(b))
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
    const haystack = ` ${tokenize(name).join(' ')} `
    const matched = banks.find((bank) => haystack.includes(` ${bank} `))

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
    rows.push({ name: 'Others', count: others })
  }

  return rows
}
