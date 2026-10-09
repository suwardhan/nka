import { useEffect, useMemo, useState } from 'react'
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
  BANK_FILTER_OTHERS,
  filterAreaOfficesByBank,
  listPresentBanks,
} from '@/lib/banks'
import {
  loadDashboardSnapshot,
  type NamedCount,
} from '@/lib/sheets'
import { formatRelativeTime } from '@/lib/time'
import { cn } from '@/lib/utils'

function readBankParams(searchParams: URLSearchParams): string[] {
  const repeated = searchParams.getAll('bank')
  if (repeated.length > 0) {
    return repeated.flatMap((value) =>
      value.split(',').map((part) => part.trim()).filter(Boolean),
    )
  }
  return []
}

export function AreaOfficesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
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

  const { banks: presentBanks, hasOthers } = useMemo(
    () => listPresentBanks(data),
    [data],
  )

  const chipOptions = useMemo(() => {
    const options = [...presentBanks]
    if (hasOthers) {
      options.push(BANK_FILTER_OTHERS)
    }
    return options
  }, [presentBanks, hasOthers])

  const selectedBanks = useMemo(() => {
    const allowed = new Set(chipOptions)
    return [...new Set(readBankParams(searchParams))].filter((bank) =>
      allowed.has(bank),
    )
  }, [searchParams, chipOptions])

  useEffect(() => {
    if (loading || error || data.length === 0) {
      return
    }
    const raw = readBankParams(searchParams)
    if (raw.length === 0) {
      return
    }
    const allowed = new Set(chipOptions)
    const valid = [...new Set(raw)].filter((bank) => allowed.has(bank))
    const same =
      valid.length === selectedBanks.length &&
      valid.every((bank) => selectedBanks.includes(bank))
    if (same && valid.length === raw.length) {
      return
    }
    const next = new URLSearchParams(searchParams)
    next.delete('bank')
    next.set('year', String(year))
    for (const bank of valid) {
      next.append('bank', bank)
    }
    setSearchParams(next, { replace: true })
  }, [
    loading,
    error,
    data.length,
    chipOptions,
    searchParams,
    selectedBanks,
    setSearchParams,
    year,
  ])

  const filtered = useMemo(
    () => filterAreaOfficesByBank(data, selectedBanks),
    [data, selectedBanks],
  )

  const totalCases = filtered.reduce((sum, row) => sum + row.count, 0)

  function setSelectedBanks(nextBanks: string[]) {
    const next = new URLSearchParams(searchParams)
    next.set('year', String(year))
    next.delete('bank')
    for (const bank of nextBanks) {
      next.append('bank', bank)
    }
    setSearchParams(next, { replace: true })
  }

  function toggleBank(bank: string) {
    if (selectedBanks.includes(bank)) {
      setSelectedBanks(selectedBanks.filter((value) => value !== bank))
    } else {
      setSelectedBanks([...selectedBanks, bank])
    }
  }

  const bankLabel =
    selectedBanks.length === 0
      ? 'All offices'
      : selectedBanks.length === 1
        ? selectedBanks[0] === BANK_FILTER_OTHERS
          ? 'Offices with no recognized bank'
          : `${selectedBanks[0]} offices`
        : `${selectedBanks.length} banks selected`

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
              {bankLabel} from Office-Register column {columnLetter} for {year}
              {!loading && !error
                ? ` · ${filtered.length} offices · ${totalCases} total cases`
                : ''}
              {updatedAt ? ` · snapshot ${formatRelativeTime(updatedAt)}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <>
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label="Filter by bank"
                >
                  {chipOptions.map((bank) => {
                    const active = selectedBanks.includes(bank)
                    return (
                      <button
                        key={bank}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleBank(bank)}
                        className={cn(
                          'rounded-md border px-3 py-1.5 text-sm transition-colors',
                          active
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground',
                        )}
                      >
                        {bank}
                      </button>
                    )
                  })}
                </div>

                {filtered.length === 0 ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">
                    No area offices match this bank filter.
                  </p>
                ) : (
                  <div className="max-h-[70vh] overflow-y-auto pr-2">
                    <HorizontalCountChart data={filtered} />
                  </div>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
