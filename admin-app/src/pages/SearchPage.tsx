import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { FileText } from 'lucide-react'
import { Link } from 'react-router-dom'

import { AdminHeader } from '@/components/AdminHeader'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { CASE_SEARCH_YEARS } from '@/config/years'
import {
  MIN_SEARCH_LENGTH,
  loadAllCasesSnapshots,
  searchCases,
  type CaseRecord,
  type ReportLink,
} from '@/lib/sheets'
import { formatRelativeTime } from '@/lib/time'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 25

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function HighlightText({
  text,
  query,
  className,
}: {
  text: string
  query: string
  className?: string
}) {
  const needle = query.trim()
  if (!text || !needle) {
    return <span className={className}>{text}</span>
  }

  const parts = text.split(new RegExp(`(${escapeRegExp(needle)})`, 'gi'))
  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.toLowerCase() === needle.toLowerCase() ? (
          <mark
            key={`${part}-${index}`}
            className="rounded-sm bg-amber-200 px-0.5 text-inherit dark:bg-amber-500/40"
          >
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </span>
  )
}

function ReportChips({
  links,
  caseKey,
}: {
  links: ReportLink[]
  caseKey: string
}) {
  if (links.length === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-2.5 py-1 text-xs text-muted-foreground">
        <FileText className="size-3.5" />
        Link not found
      </span>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link, index) => {
        const chipClass = cn(
          'inline-flex max-w-full items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium',
          link.url
            ? 'border-border bg-muted/60 text-foreground hover:bg-muted'
            : 'border-dashed text-muted-foreground',
        )
        const content: ReactNode = (
          <>
            <FileText className="size-3.5 shrink-0" />
            <span className="truncate">
              {link.url ? link.label : `${link.label} — link not found`}
            </span>
          </>
        )

        if (link.url) {
          return (
            <a
              key={`${caseKey}-${index}`}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className={chipClass}
            >
              {content}
            </a>
          )
        }

        return (
          <span key={`${caseKey}-${index}`} className={chipClass}>
            {content}
          </span>
        )
      })}
    </div>
  )
}

export function SearchPage() {
  const [cases, setCases] = useState<CaseRecord[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const result = await loadAllCasesSnapshots()
        if (cancelled) {
          return
        }
        setCases(result.cases)
        setUpdatedAt(result.updatedAt)
        if (result.cases.length === 0 && result.errors.length > 0) {
          setError(result.errors.join(' '))
        } else if (result.errors.length > 0) {
          setNotes(result.errors)
        }
      } catch (err) {
        if (!cancelled) {
          setCases([])
          setUpdatedAt(null)
          setError(err instanceof Error ? err.message : 'Failed to load cases')
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
  }, [])

  const trimmedQuery = query.trim()
  const results = useMemo(
    () => searchCases(cases, trimmedQuery),
    [cases, trimmedQuery],
  )

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageResults = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return results.slice(start, start + PAGE_SIZE)
  }, [results, currentPage])

  const yearLabel = CASE_SEARCH_YEARS.join(', ')
  const showHint =
    !loading && !error && trimmedQuery.length > 0 && trimmedQuery.length < MIN_SEARCH_LENGTH
  const showEmpty =
    !loading &&
    !error &&
    trimmedQuery.length >= MIN_SEARCH_LENGTH &&
    results.length === 0
  const rangeStart = results.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, results.length)

  return (
    <div className="min-h-screen bg-muted/30">
      <AdminHeader
        title="Search cases"
        actions={
          <Button asChild variant="outline">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        }
      />

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Search across {yearLabel}</CardTitle>
            <CardDescription>
              Partial match on Applicant name, Address, or Project name.
              {updatedAt ? ` · index ${formatRelativeTime(updatedAt)}` : ''}
              {!loading && !error ? ` · ${cases.length} cases loaded` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(1)
              }}
              placeholder="Applicant, address, or project…"
              aria-label="Search cases"
              autoFocus
            />

            {notes.length > 0 ? (
              <div className="space-y-1 text-sm text-muted-foreground">
                {notes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            ) : null}

            {loading ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Loading case index…
              </p>
            ) : null}

            {!loading && error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {showHint ? (
              <p className="text-sm text-muted-foreground">
                Type at least {MIN_SEARCH_LENGTH} characters to search.
              </p>
            ) : null}

            {showEmpty ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No matches for “{trimmedQuery}”.
              </p>
            ) : null}

            {!loading && !error && trimmedQuery.length === 0 && cases.length > 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Start typing to search {cases.length} cases from {yearLabel}.
              </p>
            ) : null}

            {!loading && !error && cases.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No case index yet. Use Refresh data on the dashboard (for{' '}
                {yearLabel}) to build it from the spreadsheets.
              </p>
            ) : null}

            {results.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {results.length} match{results.length === 1 ? '' : 'es'}
                  {results.length > PAGE_SIZE
                    ? ` · showing ${rangeStart}–${rangeEnd}`
                    : ''}
                </p>
                <ul className="divide-y rounded-md border bg-background">
                  {pageResults.map((item) => {
                    const caseKey = `${item.year}-${item.row}`
                    return (
                      <li key={caseKey} className="space-y-2 px-4 py-3">
                        <p className="font-medium">
                          <HighlightText
                            text={item.applicantName || '(no applicant)'}
                            query={trimmedQuery}
                          />
                          <span className="ml-2 text-sm font-normal text-muted-foreground">
                            {item.year}
                          </span>
                        </p>
                        {item.projectName ? (
                          <p className="text-sm">
                            Project:{' '}
                            <HighlightText
                              text={item.projectName}
                              query={trimmedQuery}
                            />
                          </p>
                        ) : null}
                        {item.address ? (
                          <p className="text-sm text-muted-foreground">
                            Address:{' '}
                            <HighlightText
                              text={item.address}
                              query={trimmedQuery}
                            />
                          </p>
                        ) : null}
                        {item.areaOffice ? (
                          <p className="text-sm text-muted-foreground">
                            Area office:{' '}
                            <HighlightText
                              text={item.areaOffice}
                              query={trimmedQuery}
                            />
                          </p>
                        ) : null}
                        <ReportChips
                          links={item.reportLinks}
                          caseKey={caseKey}
                        />
                      </li>
                    )
                  })}
                </ul>

                {totalPages > 1 ? (
                  <div className="flex items-center justify-between gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                    >
                      Next
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground">
          Search currently covers {yearLabel} only. Older years (2021–2023) can
          be added after their Applicant / Address / Project / Report link
          columns are confirmed.
        </p>
      </main>
    </div>
  )
}
