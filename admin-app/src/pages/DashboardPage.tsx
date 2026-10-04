import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { HorizontalCountChart } from '@/components/HorizontalCountChart'
import { YearTabs } from '@/components/YearTabs'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  AVAILABLE_YEARS,
  DEFAULT_YEAR,
  YEAR_CONFIG,
  columnIndexToLetter,
} from '@/config/years'
import { logout } from '@/lib/auth'
import { countCasesByBank } from '@/lib/banks'
import {
  loadDashboardSnapshot,
  refreshDashboardSnapshot,
  type DashboardSnapshot,
} from '@/lib/sheets'
import { formatIstDateTime, formatRelativeTime } from '@/lib/time'

const TOP_N = 8

export function DashboardPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const yearParam = Number(searchParams.get('year'))
  const year = AVAILABLE_YEARS.includes(yearParam) ? yearParam : DEFAULT_YEAR

  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshNote, setRefreshNote] = useState<string | null>(null)

  useEffect(() => {
    if (!AVAILABLE_YEARS.includes(yearParam)) {
      setSearchParams({ year: String(DEFAULT_YEAR) }, { replace: true })
    }
  }, [yearParam, setSearchParams])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      setRefreshNote(null)
      try {
        const result = await loadDashboardSnapshot(year)
        if (!cancelled) {
          setSnapshot(result)
        }
      } catch (err) {
        if (!cancelled) {
          setSnapshot(null)
          setError(err instanceof Error ? err.message : 'Failed to load data')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [year])

  const counts = snapshot ?? {
    areaOffices: [],
    visitPersons: [],
    reportPreparedBy: [],
  }

  const topOffices = useMemo(
    () => counts.areaOffices.slice(0, TOP_N),
    [counts.areaOffices],
  )
  const topVisitPersons = useMemo(
    () => counts.visitPersons.slice(0, TOP_N),
    [counts.visitPersons],
  )
  const topReportPreparedBy = useMemo(
    () => counts.reportPreparedBy.slice(0, TOP_N),
    [counts.reportPreparedBy],
  )
  const bankCounts = useMemo(
    () => countCasesByBank(counts.areaOffices),
    [counts.areaOffices],
  )
  const topBanks = useMemo(
    () => bankCounts.slice(0, TOP_N),
    [bankCounts],
  )

  const totalOfficeCases = counts.areaOffices.reduce(
    (sum, row) => sum + row.count,
    0,
  )
  const totalBankCases = bankCounts.reduce((sum, row) => sum + row.count, 0)
  const totalVisitCases = counts.visitPersons.reduce(
    (sum, row) => sum + row.count,
    0,
  )
  const totalReportCases = counts.reportPreparedBy.reduce(
    (sum, row) => sum + row.count,
    0,
  )
  const officeColumnLetter = columnIndexToLetter(
    YEAR_CONFIG[year].areaOfficeColumnIndex,
  )
  const visitColumnLetter = columnIndexToLetter(
    YEAR_CONFIG[year].visitPersonColumnIndex,
  )
  const reportColumnLetter = columnIndexToLetter(
    YEAR_CONFIG[year].reportPreparedByColumnIndex,
  )

  async function handleRefresh() {
    setRefreshing(true)
    setError(null)
    setRefreshNote(null)
    try {
      const result = await refreshDashboardSnapshot(year)
      setSnapshot(result)
      if (result.github?.ok) {
        setRefreshNote('Snapshot saved to GitHub.')
      } else if (result.github?.error) {
        setRefreshNote(
          `Data refreshed locally. GitHub save skipped: ${result.github.error}`,
        )
      } else {
        setRefreshNote('Data refreshed.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  function handleLogout() {
    logout()
    navigate('/', { replace: true })
  }

  function handleYearChange(nextYear: number) {
    setSearchParams({ year: String(nextYear) })
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Narendra Ahirrao and Associates
            </p>
            <h1 className="text-xl font-semibold tracking-tight">
              Admin dashboard
            </h1>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <YearTabs value={year} onChange={handleYearChange} />

          <div className="flex flex-col items-start gap-2 sm:items-end">
            {snapshot?.updatedAt ? (
              <p className="text-sm text-muted-foreground">
                Refreshed {formatRelativeTime(snapshot.updatedAt)}
                <span className="hidden sm:inline">
                  {' '}
                  · {formatIstDateTime(snapshot.updatedAt)} IST
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No snapshot yet</p>
            )}
            <Button onClick={handleRefresh} disabled={refreshing || loading}>
              {refreshing ? 'Refreshing…' : 'Refresh data'}
            </Button>
          </div>
        </div>

        {refreshNote ? (
          <p className="text-sm text-muted-foreground">{refreshNote}</p>
        ) : null}

        {loading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Loading snapshot…
          </p>
        ) : null}

        {!loading && error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {!loading && !error && snapshot ? (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div className="space-y-1.5">
                    <CardTitle>Cases by Bank</CardTitle>
                    <CardDescription>
                      Top {TOP_N} from Area office names for {year}
                      {` · ${totalBankCases} total cases`}
                    </CardDescription>
                  </div>
                  {bankCounts.length > 0 ? (
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/dashboard/banks?year=${year}`}>View all</Link>
                    </Button>
                  ) : null}
                </CardHeader>
                <CardContent>
                  {topBanks.length === 0 ? (
                    <p className="py-16 text-center text-sm text-muted-foreground">
                      No bank values found for {year}.
                    </p>
                  ) : (
                    <HorizontalCountChart data={topBanks} />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div className="space-y-1.5">
                    <CardTitle>Cases by Area office</CardTitle>
                    <CardDescription>
                      Top {TOP_N} from column {officeColumnLetter} for {year}
                      {` · ${totalOfficeCases} total cases`}
                    </CardDescription>
                  </div>
                  {counts.areaOffices.length > 0 ? (
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/dashboard/area-offices?year=${year}`}>
                        View all
                      </Link>
                    </Button>
                  ) : null}
                </CardHeader>
                <CardContent>
                  {topOffices.length === 0 ? (
                    <p className="py-16 text-center text-sm text-muted-foreground">
                      No Area office values found for {year}.
                    </p>
                  ) : (
                    <HorizontalCountChart data={topOffices} />
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div className="space-y-1.5">
                    <CardTitle>Visits by person</CardTitle>
                    <CardDescription>
                      Top {TOP_N} from column {visitColumnLetter} for {year}
                      {` · ${totalVisitCases} total visits`}
                    </CardDescription>
                  </div>
                  {counts.visitPersons.length > 0 ? (
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/dashboard/visit-persons?year=${year}`}>
                        View all
                      </Link>
                    </Button>
                  ) : null}
                </CardHeader>
                <CardContent>
                  {topVisitPersons.length === 0 ? (
                    <p className="py-16 text-center text-sm text-muted-foreground">
                      No Visit person values found for {year}.
                    </p>
                  ) : (
                    <HorizontalCountChart
                      data={topVisitPersons}
                      countLabel="Visits"
                    />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div className="space-y-1.5">
                    <CardTitle>Report prepared by</CardTitle>
                    <CardDescription>
                      Top {TOP_N} from column {reportColumnLetter} for {year}
                      {` · ${totalReportCases} total reports`}
                    </CardDescription>
                  </div>
                  {counts.reportPreparedBy.length > 0 ? (
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/dashboard/report-prepared-by?year=${year}`}>
                        View all
                      </Link>
                    </Button>
                  ) : null}
                </CardHeader>
                <CardContent>
                  {topReportPreparedBy.length === 0 ? (
                    <p className="py-16 text-center text-sm text-muted-foreground">
                      No Report prepared by values found for {year}.
                    </p>
                  ) : (
                    <HorizontalCountChart
                      data={topReportPreparedBy}
                      countLabel="Reports"
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}
