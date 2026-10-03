import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { HorizontalCountChart } from '@/components/HorizontalCountChart'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AVAILABLE_YEARS, DEFAULT_YEAR } from '@/config/years'
import { logout } from '@/lib/auth'
import {
  loadDashboardSnapshot,
  refreshDashboardSnapshot,
  type DashboardSnapshot,
} from '@/lib/sheets'
import { formatIstDateTime, formatRelativeTime } from '@/lib/time'

const TOP_N = 10

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

  const counts = snapshot ?? { areaOffices: [], visitPersons: [] }

  const topOffices = useMemo(
    () => counts.areaOffices.slice(0, TOP_N),
    [counts.areaOffices],
  )
  const topVisitPersons = useMemo(
    () => counts.visitPersons.slice(0, TOP_N),
    [counts.visitPersons],
  )

  const totalOfficeCases = counts.areaOffices.reduce(
    (sum, row) => sum + row.count,
    0,
  )
  const totalVisitCases = counts.visitPersons.reduce(
    (sum, row) => sum + row.count,
    0,
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

  function handleYearChange(value: string) {
    setSearchParams({ year: value })
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
          <div className="flex flex-col gap-2 sm:max-w-xs">
            <Label htmlFor="year-filter">Year</Label>
            <Select value={String(year)} onValueChange={handleYearChange}>
              <SelectTrigger id="year-filter">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_YEARS.map((availableYear) => (
                  <SelectItem key={availableYear} value={String(availableYear)}>
                    {availableYear}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div className="space-y-1.5">
                  <CardTitle>Cases by Area office</CardTitle>
                  <CardDescription>
                    Top {TOP_N} from column L for {year}
                    {` · ${totalOfficeCases} total cases`}
                  </CardDescription>
                </div>
                {counts.areaOffices.length > TOP_N ? (
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

            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div className="space-y-1.5">
                  <CardTitle>Visits by person</CardTitle>
                  <CardDescription>
                    Top {TOP_N} from column R for {year}
                    {` · ${totalVisitCases} total visits`}
                  </CardDescription>
                </div>
                {counts.visitPersons.length > TOP_N ? (
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
          </div>
        ) : null}
      </main>
    </div>
  )
}
