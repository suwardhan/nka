import { AVAILABLE_YEARS } from '@/config/years'
import { cn } from '@/lib/utils'

type YearTabsProps = {
  value: number
  onChange: (year: number) => void
  className?: string
}

export function YearTabs({ value, onChange, className }: YearTabsProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <p className="text-sm font-medium leading-none">Year</p>
      <div
        role="tablist"
        aria-label="Year"
        className="inline-flex w-fit rounded-lg border bg-muted p-1"
      >
        {AVAILABLE_YEARS.map((year) => {
          const selected = year === value
          return (
            <button
              key={year}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(year)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                selected
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {year}
            </button>
          )
        })}
      </div>
    </div>
  )
}
