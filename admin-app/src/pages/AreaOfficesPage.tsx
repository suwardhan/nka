import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { AdminHeader } from '@/components/AdminHeader'
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

export function AreaOfficesPage() {
  const [searchParams] = useSearchParams()
  const yearParam = Number(searchParams.get('year'))
  const year = AVAILABLE_YEARS.includes(yearParam) ? yearParam : DEFAULT_YEAR
  const columnLetter = columnIndexToLetter(
    YEAR_CONFIG[year].areaOfficeColumnIndex,
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
          setData(result.areaOffices)
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

  const totalCases = data.reduce((sum, row) => sum + row.count, 0)

  return (
    <div className="min-h-screen bg-muted/30">
      <AdminHeader
        title="All Area offices"
        actions={
          <Button asChild variant="outline">
            <Link to={`/dashboard?year=${year}`}>Back to dashboard</Link>
          </Button>
        }
      />

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Cases by Area office</CardTitle>
            <CardDescription>
              All offices from Office-Register column {columnLetter} for {year}
              {!loading && !error
                ? ` · ${data.length} offices · ${totalCases} total cases`
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
                No Area office values found for {year}.
              </p>
            ) : null}

            {!loading && !error && data.length > 0 ? (
              <div className="max-h-[70vh] overflow-y-auto pr-2">
                <HorizontalCountChart data={data} />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
