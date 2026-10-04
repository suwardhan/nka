import { YEAR_CONFIG } from '@/config/years'

export type NamedCount = {
  name: string
  count: number
}

export type DashboardSnapshot = {
  year: number
  updatedAt: string
  timezone?: string
  areaOffices: NamedCount[]
  visitPersons: NamedCount[]
  reportPreparedBy: NamedCount[]
  github?: {
    ok: boolean
    path?: string
    branch?: string
    commitSha?: string
    error?: string
  }
}

type SnapshotResponse = DashboardSnapshot & {
  error?: string
}

const cacheKey = (year: number) => `nka_dashboard_snapshot_${year}`

function normalizeSnapshot(
  year: number,
  json: Partial<SnapshotResponse>,
): DashboardSnapshot {
  return {
    year: Number(json.year) || year,
    updatedAt: json.updatedAt || new Date().toISOString(),
    timezone: json.timezone || 'Asia/Kolkata',
    areaOffices: json.areaOffices ?? [],
    visitPersons: json.visitPersons ?? [],
    reportPreparedBy: json.reportPreparedBy ?? [],
    github: json.github,
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

async function fetchStaticSnapshot(
  year: number,
): Promise<DashboardSnapshot | null> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${year}.json`, {
    cache: 'no-cache',
  })
  if (!response.ok) {
    return null
  }
  const json = (await response.json()) as SnapshotResponse
  if (json.error) {
    return null
  }
  return normalizeSnapshot(year, json)
}

/**
 * Fast path: pick the newest of static repo JSON vs localStorage cache.
 */
export async function loadDashboardSnapshot(
  year: number,
): Promise<DashboardSnapshot> {
  if (!YEAR_CONFIG[year]) {
    throw new Error(`No spreadsheet configured for year ${year}`)
  }

  const cached = readLocalCache(year)
  const staticSnapshot = await fetchStaticSnapshot(year)

  if (cached && staticSnapshot) {
    const cachedTime = Date.parse(cached.updatedAt)
    const staticTime = Date.parse(staticSnapshot.updatedAt)
    const newest =
      !Number.isNaN(cachedTime) &&
      !Number.isNaN(staticTime) &&
      cachedTime >= staticTime
        ? cached
        : staticSnapshot
    writeLocalCache(newest)
    return newest
  }

  if (staticSnapshot) {
    writeLocalCache(staticSnapshot)
    return staticSnapshot
  }

  if (cached) {
    return cached
  }

  throw new Error(
    `No snapshot found for ${year}. Click Refresh to build one from the spreadsheet.`,
  )
}

/**
 * Slow path: aggregate from Google Sheet via Apps Script and optionally
 * commit admin/public/data/{year}.json to GitHub.
 */
export async function refreshDashboardSnapshot(
  year: number,
): Promise<DashboardSnapshot> {
  const yearConfig = YEAR_CONFIG[year]
  if (!yearConfig) {
    throw new Error(`No spreadsheet configured for year ${year}`)
  }

  const proxyUrl = import.meta.env.VITE_SHEETS_PROXY_URL
  const proxyKey = import.meta.env.VITE_SHEETS_PROXY_KEY

  if (!proxyUrl) {
    throw new Error(
      'Missing VITE_SHEETS_PROXY_URL. Deploy the Apps Script and set it in admin/.env',
    )
  }
  if (!proxyKey) {
    throw new Error(
      'Missing VITE_SHEETS_PROXY_KEY. Set it in admin/.env to match the Apps Script key.',
    )
  }

  const url = new URL(proxyUrl)
  url.searchParams.set('key', proxyKey)
  url.searchParams.set('action', 'refresh')
  url.searchParams.set('year', String(year))
  url.searchParams.set('spreadsheetId', yearConfig.spreadsheetId)
  url.searchParams.set('sheetName', yearConfig.sheetName)
  url.searchParams.set(
    'areaOfficeColumn',
    String(yearConfig.areaOfficeColumnIndex),
  )
  url.searchParams.set(
    'visitPersonColumn',
    String(yearConfig.visitPersonColumnIndex),
  )
  url.searchParams.set(
    'reportPreparedByColumn',
    String(yearConfig.reportPreparedByColumnIndex),
  )

  const response = await fetch(url.toString())
  if (!response.ok) {
    throw new Error(`Snapshot refresh failed (${response.status})`)
  }

  const json = (await response.json()) as SnapshotResponse
  if (json.error) {
    throw new Error(json.error)
  }

  const snapshot = normalizeSnapshot(year, json)
  writeLocalCache(snapshot)
  return snapshot
}
