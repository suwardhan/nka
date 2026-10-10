import { CASE_SEARCH_YEARS, YEAR_CONFIG } from '@/config/years'
import { mergeNamedCounts } from '@/lib/names'

export type NamedCount = {
  name: string
  count: number
  /** Original spellings when case variants were merged into `name`. */
  mergedFrom?: string[]
}

export type ReportLink = {
  label: string
  url: string | null
}

export type CaseRecord = {
  year: number
  row: number
  applicantName: string
  address: string
  projectName: string
  areaOffice: string
  reportLinks: ReportLink[]
}

export type CasesSnapshot = {
  year: number
  updatedAt: string
  timezone?: string
  cases: CaseRecord[]
  github?: {
    ok: boolean
    path?: string
    branch?: string
    commitSha?: string
    error?: string
  }
}

export type DashboardSnapshot = {
  year: number
  updatedAt: string
  timezone?: string
  areaOffices: NamedCount[]
  visitPersons: NamedCount[]
  reportPreparedBy: NamedCount[]
  /** Present on live refresh responses for case-search years; not stored in dashboard JSON. */
  cases?: CaseRecord[]
  github?: {
    ok: boolean
    path?: string
    branch?: string
    commitSha?: string
    error?: string
  }
  casesGithub?: {
    ok: boolean
    path?: string
    branch?: string
    commitSha?: string
    error?: string
  }
  ingest?: {
    ok: boolean
    status?: number
    error?: string
  }
  cache?: {
    ok: boolean
  }
}

type SnapshotResponse = DashboardSnapshot & {
  error?: string
}

type CasesResponse = CasesSnapshot & {
  error?: string
}

// v4: also merge dash placeholders (--/---) into "(blank)"
const cacheKey = (year: number) => `nka_dashboard_snapshot_v4_${year}`

function adminApiBase(): string {
  const base = import.meta.env.VITE_ADMIN_API_URL?.replace(/\/$/, '')
  if (!base) {
    throw new Error(
      'Missing VITE_ADMIN_API_URL. Set it in admin-app/.env (see .env.example).',
    )
  }
  return base
}

function normalizeSnapshot(
  year: number,
  json: Partial<SnapshotResponse>,
): DashboardSnapshot {
  return {
    year: Number(json.year) || year,
    updatedAt: json.updatedAt || new Date().toISOString(),
    timezone: json.timezone || 'Asia/Kolkata',
    areaOffices: json.areaOffices ?? [],
    visitPersons: mergeNamedCounts(json.visitPersons ?? []),
    reportPreparedBy: mergeNamedCounts(json.reportPreparedBy ?? []),
    github: json.github,
    ingest: json.ingest,
    cache: json.cache,
  }
}

function readLocalCache(year: number): DashboardSnapshot | null {
  try {
    const raw = localStorage.getItem(cacheKey(year))
    if (!raw) {
      return null
    }
    return normalizeSnapshot(year, JSON.parse(raw) as SnapshotResponse)
  } catch {
    return null
  }
}

function writeLocalCache(snapshot: DashboardSnapshot): void {
  localStorage.setItem(cacheKey(snapshot.year), JSON.stringify(snapshot))
}

/** Parse JSON from a fetch response; return null for HTML/SPA fallbacks or invalid bodies. */
async function readJsonResponse<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get('content-type') || ''
  const text = await response.text()
  const trimmed = text.trim()
  if (!trimmed || trimmed.startsWith('<')) {
    return null
  }
  if (
    contentType &&
    !contentType.includes('application/json') &&
    !contentType.includes('text/plain') &&
    !trimmed.startsWith('{') &&
    !trimmed.startsWith('[')
  ) {
    return null
  }
  try {
    return JSON.parse(trimmed) as T
  } catch {
    return null
  }
}

async function fetchApiSnapshot(year: number): Promise<DashboardSnapshot | null> {
  const response = await fetch(
    `${adminApiBase()}/snapshot?year=${encodeURIComponent(String(year))}`,
    { cache: 'no-cache', credentials: 'include' },
  )
  if (!response.ok) {
    return null
  }
  const json = await readJsonResponse<SnapshotResponse>(response)
  if (!json || json.error) {
    return null
  }
  return normalizeSnapshot(year, json)
}

/**
 * Fast path: pick the newest of Worker API snapshot vs localStorage cache.
 */
export async function loadDashboardSnapshot(
  year: number,
): Promise<DashboardSnapshot> {
  if (!YEAR_CONFIG[year]) {
    throw new Error(`No spreadsheet configured for year ${year}`)
  }

  const cached = readLocalCache(year)

  let apiSnapshot: DashboardSnapshot | null = null
  try {
    apiSnapshot = await fetchApiSnapshot(year)
  } catch {
    apiSnapshot = null
  }

  if (cached && apiSnapshot) {
    const cachedTime = Date.parse(cached.updatedAt)
    const apiTime = Date.parse(apiSnapshot.updatedAt)
    const newest =
      !Number.isNaN(cachedTime) &&
      !Number.isNaN(apiTime) &&
      cachedTime >= apiTime
        ? cached
        : apiSnapshot
    writeLocalCache(newest)
    return newest
  }

  if (apiSnapshot) {
    writeLocalCache(apiSnapshot)
    return apiSnapshot
  }

  if (cached) {
    return cached
  }

  throw new Error(
    `No snapshot found for ${year}. Click Refresh to build one from the spreadsheet.`,
  )
}

/**
 * Slow path: rebuild via Cloudflare Worker → Apps Script and cache in KV.
 */
export async function refreshDashboardSnapshot(
  year: number,
): Promise<DashboardSnapshot> {
  if (!YEAR_CONFIG[year]) {
    throw new Error(`No spreadsheet configured for year ${year}`)
  }

  const response = await fetch(
    `${adminApiBase()}/refresh?year=${encodeURIComponent(String(year))}`,
    { method: 'POST', credentials: 'include' },
  )
  if (!response.ok) {
    const failed = await readJsonResponse<SnapshotResponse>(response)
    throw new Error(
      failed?.error || `Snapshot refresh failed (${response.status})`,
    )
  }

  const json = await readJsonResponse<SnapshotResponse>(response)
  if (!json) {
    throw new Error(
      `Snapshot refresh for ${year} returned HTML instead of JSON. Check Cloudflare Access and VITE_ADMIN_API_URL.`,
    )
  }
  if (json.error) {
    throw new Error(json.error)
  }

  const snapshot = normalizeSnapshot(year, json)
  writeLocalCache(snapshot)

  if (YEAR_CONFIG[year]?.caseSearch && Array.isArray(json.cases)) {
    const casesSnapshot = normalizeCasesSnapshot(year, {
      year,
      updatedAt: snapshot.updatedAt,
      timezone: snapshot.timezone,
      cases: json.cases,
      github: json.casesGithub,
    })
    writeCasesLocalCache(casesSnapshot)
    snapshot.cases = casesSnapshot.cases
    snapshot.casesGithub = json.casesGithub
  }

  return snapshot
}

function normalizeReportLinks(raw: unknown): ReportLink[] {
  if (!Array.isArray(raw)) {
    return []
  }
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }
      const record = item as { label?: unknown; url?: unknown }
      const label = String(record.label ?? '').trim()
      const urlRaw = record.url
      const url =
        typeof urlRaw === 'string' && urlRaw.trim() ? urlRaw.trim() : null
      if (!label && !url) {
        return null
      }
      return { label: label || 'Open report', url }
    })
    .filter((item): item is ReportLink => item != null)
}

function normalizeCaseRecord(year: number, raw: unknown): CaseRecord | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }
  const record = raw as Partial<CaseRecord>
  const applicantName = String(record.applicantName ?? '').trim()
  const address = String(record.address ?? '').trim()
  const projectName = String(record.projectName ?? '').trim()
  const areaOffice = String(record.areaOffice ?? '').trim()
  if (!applicantName && !address && !projectName) {
    return null
  }
  return {
    year: Number(record.year) || year,
    row: Number(record.row) || 0,
    applicantName,
    address,
    projectName,
    areaOffice,
    reportLinks: normalizeReportLinks(record.reportLinks),
  }
}

function normalizeCasesSnapshot(
  year: number,
  json: Partial<CasesResponse>,
): CasesSnapshot {
  const cases = Array.isArray(json.cases)
    ? json.cases
        .map((item) => normalizeCaseRecord(year, item))
        .filter((item): item is CaseRecord => item != null)
    : []
  return {
    year: Number(json.year) || year,
    updatedAt: json.updatedAt || new Date().toISOString(),
    timezone: json.timezone || 'Asia/Kolkata',
    cases,
    github: json.github,
  }
}

const casesCacheKey = (year: number) => `nka_cases_snapshot_v1_${year}`

function readCasesLocalCache(year: number): CasesSnapshot | null {
  try {
    const raw = localStorage.getItem(casesCacheKey(year))
    if (!raw) {
      return null
    }
    return normalizeCasesSnapshot(year, JSON.parse(raw) as CasesResponse)
  } catch {
    return null
  }
}

function writeCasesLocalCache(snapshot: CasesSnapshot): void {
  localStorage.setItem(casesCacheKey(snapshot.year), JSON.stringify(snapshot))
}

async function fetchApiCasesSnapshot(
  year: number,
): Promise<CasesSnapshot | null> {
  const response = await fetch(
    `${adminApiBase()}/cases?year=${encodeURIComponent(String(year))}`,
    { cache: 'no-cache', credentials: 'include' },
  )
  if (!response.ok) {
    return null
  }
  const json = await readJsonResponse<CasesResponse>(response)
  if (!json || json.error) {
    return null
  }
  return normalizeCasesSnapshot(year, json)
}

/**
 * Load case-search index for one year (Worker API vs localStorage).
 */
export async function loadCasesSnapshot(year: number): Promise<CasesSnapshot> {
  if (!YEAR_CONFIG[year]?.caseSearch) {
    throw new Error(`Case search is not configured for year ${year}`)
  }

  const cached = readCasesLocalCache(year)

  let apiSnapshot: CasesSnapshot | null = null
  try {
    apiSnapshot = await fetchApiCasesSnapshot(year)
  } catch {
    apiSnapshot = null
  }

  if (cached && apiSnapshot) {
    const cachedTime = Date.parse(cached.updatedAt)
    const apiTime = Date.parse(apiSnapshot.updatedAt)
    const newest =
      !Number.isNaN(cachedTime) &&
      !Number.isNaN(apiTime) &&
      cachedTime >= apiTime
        ? cached
        : apiSnapshot
    writeCasesLocalCache(newest)
    return newest
  }

  if (apiSnapshot) {
    writeCasesLocalCache(apiSnapshot)
    return apiSnapshot
  }

  if (cached) {
    return cached
  }

  throw new Error(
    `No case search index for ${year}. Click Refresh to build one from the spreadsheet.`,
  )
}

/**
 * Load case-search indexes for all configured years (2024–2026).
 * Years that fail still return an empty list so partial data remains usable.
 */
export async function loadAllCasesSnapshots(): Promise<{
  cases: CaseRecord[]
  updatedAt: string | null
  errors: string[]
}> {
  const results = await Promise.all(
    CASE_SEARCH_YEARS.map(async (year) => {
      try {
        const snapshot = await loadCasesSnapshot(year)
        return { snapshot, error: null as string | null }
      } catch (err) {
        return {
          snapshot: null,
          error:
            err instanceof Error
              ? err.message
              : `Failed to load cases for ${year}`,
        }
      }
    }),
  )

  const cases: CaseRecord[] = []
  const errors: string[] = []
  let newestUpdatedAt: string | null = null
  let newestTime = Number.NEGATIVE_INFINITY

  for (const result of results) {
    if (result.error) {
      errors.push(result.error)
      continue
    }
    if (!result.snapshot) {
      continue
    }
    cases.push(...result.snapshot.cases)
    const time = Date.parse(result.snapshot.updatedAt)
    if (!Number.isNaN(time) && time > newestTime) {
      newestTime = time
      newestUpdatedAt = result.snapshot.updatedAt
    }
  }

  return { cases, updatedAt: newestUpdatedAt, errors }
}

/**
 * Refresh dashboard + case index for every case-search year.
 */
export async function refreshAllCasesSnapshots(): Promise<{
  cases: CaseRecord[]
  updatedAt: string | null
  notes: string[]
  errors: string[]
}> {
  const notes: string[] = []
  const errors: string[] = []
  const cases: CaseRecord[] = []
  let newestUpdatedAt: string | null = null
  let newestTime = Number.NEGATIVE_INFINITY

  for (const year of CASE_SEARCH_YEARS) {
    try {
      const snapshot = await refreshDashboardSnapshot(year)
      const yearCases = Array.isArray(snapshot.cases) ? snapshot.cases : []
      if (yearCases.length > 0) {
        cases.push(...yearCases)
      } else {
        try {
          const loaded = await loadCasesSnapshot(year)
          cases.push(...loaded.cases)
        } catch {
          notes.push(`${year}: refreshed dashboard, but no cases returned yet.`)
        }
      }

      const time = Date.parse(snapshot.updatedAt)
      if (!Number.isNaN(time) && time > newestTime) {
        newestTime = time
        newestUpdatedAt = snapshot.updatedAt
      }

      if (snapshot.cache?.ok || snapshot.ingest?.ok) {
        notes.push(`${year}: refreshed and cached on server.`)
      } else if (snapshot.ingest?.error) {
        notes.push(
          `${year}: refreshed. Server cache note: ${snapshot.ingest.error}`,
        )
      } else {
        notes.push(`${year}: refreshed.`)
      }
    } catch (err) {
      errors.push(
        err instanceof Error
          ? `${year}: ${err.message}`
          : `${year}: refresh failed`,
      )
    }
  }

  return { cases, updatedAt: newestUpdatedAt, notes, errors }
}

const MIN_SEARCH_LENGTH = 2

/** Case-insensitive partial match on applicant, address, or project name. */
export function searchCases(
  cases: CaseRecord[],
  query: string,
): CaseRecord[] {
  const needle = query.trim().toLowerCase()
  if (needle.length < MIN_SEARCH_LENGTH) {
    return []
  }
  return cases.filter((item) => {
    return (
      item.applicantName.toLowerCase().includes(needle) ||
      item.address.toLowerCase().includes(needle) ||
      item.projectName.toLowerCase().includes(needle)
    )
  })
}

export { MIN_SEARCH_LENGTH }
