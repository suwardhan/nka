import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { HorizontalCountChart } from '@/components/HorizontalCountChart'
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
import {
  loadDashboardSnapshot,
  type NamedCount,
} from '@/lib/sheets'
import { formatRelativeTime } from '@/lib/time'

export function ReportPreparedByPage() {
  const [searchParams] = useSearchParams()
  const yearParam = Number(searchParams.get('year'))
  const year = AVAILABLE_YEARS.includes(yearParam) ? yearParam : DEFAULT_YEAR
  const columnLetter = columnIndexToLetter(
    YEAR_CONFIG[year].reportPreparedByColumnIndex,
  )

  const [data, setData] = useState<NamedCount[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const result = await loadDashboardSnapshot(year)
        if (!cancelled) {
          setData(result.reportPreparedBy)
          setUpdatedAt(result.updatedAt)
        }
      } catch (err) {
        if (!cancelled) {
          setData([])
          setUpdatedAt(null)
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

  const totalReports = data.reduce((sum, row) => sum + row.count, 0)

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Narendra Ahirrao and Associates
            </p>
            <h1 className="text-xl font-semibold tracking-tight">
              All Report prepared by
            </h1>
          </div>
          <Button asChild variant="outline">
            <Link to={`/dashboard?year=${year}`}>Back to dashboard</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Report prepared by</CardTitle>
            <CardDescription>
              All values from Office-Register column {columnLetter} for {year}
              {!loading && !error
                ? ` · ${data.length} people · ${totalReports} total reports`
                : ''}
              {updatedAt ? ` · snapshot ${formatRelativeTime(updatedAt)}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
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

            {!loading && !error && data.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                No Report prepared by values found for {year}.
              </p>
            ) : null}

            {!loading && !error && data.length > 0 ? (
              <div className="max-h-[70vh] overflow-y-auto pr-2">
                <HorizontalCountChart data={data} countLabel="Reports" />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
