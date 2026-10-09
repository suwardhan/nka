import type { NamedCount } from '@/lib/sheets'

/** Title Case each whitespace-separated word. */
export function toTitleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

const BLANK_KEY = '__blank__'
const BLANK_DISPLAY = '(blank)'

/** Placeholder-only values from the sheet (--, ---, ----, etc.). */
function isBlankPlaceholder(value: string): boolean {
  return /^[-–—_.\s]+$/.test(value)
}

/**
 * Normalize a raw name for grouping:
 * - newlines → spaces (fixes blank chart labels)
 * - dash placeholders (-- / --- / ----) → "(blank)"
 * - optional spaces around `/`
 * - "Siddhi Siddhi" / "Siddhi/Siddhi" → "Siddhi"
 * - multi-person slash lists get a stable sorted key
 */
export function canonicalizeName(raw: string): {
  key: string
  display: string
} {
  let cleaned = raw.trim().replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ')
  cleaned = cleaned.replace(/\s*\/\s*/g, '/')

  if (!cleaned || isBlankPlaceholder(cleaned)) {
    return { key: BLANK_KEY, display: BLANK_DISPLAY }
  }

  const slashParts = cleaned
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const words = part.split(/\s+/).filter(Boolean)
      if (
        words.length > 1 &&
        words.every((w) => w.toLowerCase() === words[0].toLowerCase())
      ) {
        return words[0]
      }
      return part
    })

  const unique: string[] = []
  const seen = new Set<string>()
  for (const part of slashParts) {
    const lower = part.toLowerCase()
    if (!seen.has(lower)) {
      seen.add(lower)
      unique.push(part)
    }
  }

  if (unique.length === 0) {
    return { key: '', display: '' }
  }

  if (unique.length === 1) {
    return {
      key: unique[0].toLowerCase(),
      display: toTitleCase(unique[0]),
    }
  }

  const sorted = [...unique].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  )
  return {
    key: sorted.map((p) => p.toLowerCase()).join('/'),
    display: sorted.map((p) => toTitleCase(p)).join(' / '),
  }
}

/**
 * Merge rows that are the same person/people under different spellings.
 * Display name is Title Case; `mergedFrom` lists originals when variants existed.
 *
 * Re-running on already-merged rows preserves prior `mergedFrom` spellings
 * (important for localStorage cache round-trips).
 */
export function mergeNamedCounts(rows: NamedCount[]): NamedCount[] {
  const groups = new Map<
    string,
    { count: number; display: string; originals: Set<string> }
  >()

  for (const row of rows) {
    const trimmed = row.name.trim()
    if (!trimmed) {
      continue
    }

    const { key, display } = canonicalizeName(trimmed)
    if (!key) {
      continue
    }

    const spellings = [trimmed, ...(row.mergedFrom ?? [])].filter(Boolean)
    const existing = groups.get(key)

    if (existing) {
      existing.count += row.count
      for (const spelling of spellings) {
        existing.originals.add(spelling)
      }
    } else {
      groups.set(key, {
        count: row.count,
        display,
        originals: new Set(spellings),
      })
    }
  }

  return [...groups.values()]
    .map((group) => {
      const originals = [...group.originals].sort((a, b) => a.localeCompare(b))
      const item: NamedCount = {
        name: group.display,
        count: group.count,
      }
      if (originals.length > 1) {
        item.mergedFrom = originals
      }
      return item
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}
