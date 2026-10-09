import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { ExternalLink, FileText, X } from 'lucide-react'
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
const DESKTOP_MIN_WIDTH = '(min-width: 1024px)'
const PREVIEW_LOAD_TIMEOUT_MS = 5000

type SelectedReport = {
  chipKey: string
  label: string
  url: string
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setMatches(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** Prefer Google /preview URLs so Docs/Drive can embed in an iframe more often. */
function toGoogleEmbedUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.includes('google.com')) {
      return url
    }

    const workspaceMatch = parsed.pathname.match(
      /\/(document|spreadsheets|presentation)\/d\/([^/]+)/,
    )
    if (workspaceMatch) {
      return `https://docs.google.com/${workspaceMatch[1]}/d/${workspaceMatch[2]}/preview`
    }

    const fileMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/)
    if (fileMatch) {
      return `https://drive.google.com/file/d/${fileMatch[1]}/preview`
    }

    const id = parsed.searchParams.get('id')
    if (id) {
      return `https://drive.google.com/file/d/${id}/preview`
    }

    return url
  } catch {
    return url
  }
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
  selectedChipKey,
  openInNewTab,
  onSelect,
}: {
  links: ReportLink[]
  caseKey: string
  selectedChipKey: string | null
  openInNewTab: boolean
  onSelect: (report: SelectedReport) => void
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
        const chipKey = `${caseKey}-${index}`
        const selected = selectedChipKey === chipKey
        const chipClass = cn(
          'inline-flex max-w-full items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
          link.url
            ? selected
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border bg-muted/60 text-foreground hover:bg-muted'
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

        if (!link.url) {
          return (
            <span key={chipKey} className={chipClass}>
              {content}
            </span>
          )
        }

        if (openInNewTab) {
          return (
            <a
              key={chipKey}
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
          <button
            key={chipKey}
            type="button"
            className={chipClass}
            aria-pressed={selected}
            onClick={() =>
              onSelect({
                chipKey,
                label: link.label,
                url: link.url!,
              })
            }
          >
            {content}
          </button>
        )
      })}
    </div>
  )
}

function ReportPreviewPanel({
  report,
  onClose,
}: {
  report: SelectedReport | null
  onClose: () => void
}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const embedUrl = report ? toGoogleEmbedUrl(report.url) : null

  useEffect(() => {
    if (!report) {
      return
    }
    setStatus('loading')
    const timer = window.setTimeout(() => {
      setStatus((current) => (current === 'loading' ? 'failed' : current))
    }, PREVIEW_LOAD_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [report])

  if (!report || !embedUrl) {
    return (
      <div className="flex h-full min-h-[32rem] flex-col items-center justify-center rounded-md border border-dashed bg-background px-6 text-center">
        <FileText className="mb-3 size-8 text-muted-foreground" />
        <p className="text-sm font-medium">Report preview</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Click a report chip to preview it here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-[32rem] flex-col overflow-hidden rounded-md border bg-background">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{report.label}</p>
        <Button asChild variant="outline" size="sm">
          <a href={report.url} target="_blank" rel="noreferrer">
            <ExternalLink className="size-3.5" />
            Open in Google Docs
          </a>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Close preview"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="relative min-h-0 flex-1 bg-muted/20">
        {status === 'failed' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm text-muted-foreground">
              Preview could not be loaded here. Google often blocks embedded
              documents — open it in a new tab instead.
            </p>
            <Button asChild>
              <a href={report.url} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3.5" />
                Open in Google Docs
              </a>
            </Button>
          </div>
        ) : (
          <>
            {status === 'loading' ? (
              <p className="absolute inset-x-0 top-4 z-10 text-center text-sm text-muted-foreground">
                Loading preview…
              </p>
            ) : (
              <div className="absolute inset-x-0 bottom-0 z-10 flex justify-center bg-gradient-to-t from-background/95 to-transparent px-3 pb-3 pt-8">
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                  onClick={() => setStatus('failed')}
                >
                  Can&apos;t see the document?
                </button>
              </div>
            )}
            <iframe
              key={report.chipKey}
              title={`Preview ${report.label}`}
              src={embedUrl}
              className="absolute inset-0 size-full border-0"
              onLoad={() => setStatus('ready')}
              onError={() => setStatus('failed')}
              allow="autoplay"
            />
          </>
        )}
      </div>
    </div>
  )
}

export function SearchPage() {
  const isDesktop = useMediaQuery(DESKTOP_MIN_WIDTH)
  const [cases, setCases] = useState<CaseRecord[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<string[]>([])
  const [selectedReport, setSelectedReport] = useState<SelectedReport | null>(
    null,
  )

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

  useEffect(() => {
    if (!isDesktop) {
      setSelectedReport(null)
    }
  }, [isDesktop])

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

  useEffect(() => {
    setSelectedReport(null)
  }, [trimmedQuery, currentPage])

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
  const showResults = results.length > 0

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

      <main
        className={cn(
          'mx-auto space-y-6 px-4 py-6',
          showResults && isDesktop ? 'max-w-7xl' : 'max-w-6xl',
        )}
      >
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

            {showResults ? (
              <div
                className={cn(
                  'gap-4',
                  isDesktop
                    ? 'grid items-start lg:grid-cols-[minmax(0,1fr)_minmax(22rem,1fr)]'
                    : 'space-y-3',
                )}
              >
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
                            selectedChipKey={selectedReport?.chipKey ?? null}
                            openInNewTab={!isDesktop}
                            onSelect={setSelectedReport}
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

                {isDesktop ? (
                  <div className="sticky top-4 self-start lg:h-[calc(100vh-6rem)]">
                    <ReportPreviewPanel
                      report={selectedReport}
                      onClose={() => setSelectedReport(null)}
                    />
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
