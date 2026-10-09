import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart'
import type { NamedCount } from '@/lib/sheets'

const chartConfig = {
  count: {
    label: 'Cases',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

type HorizontalCountChartProps = {
  data: NamedCount[]
  countLabel?: string
}

function yAxisWidthForLabels(names: string[]): number {
  const maxLen = names.reduce((max, name) => Math.max(max, name.length), 0)
  // ~7.5px per character + padding; keep a floor/ceiling for short/long labels
  return Math.min(160, Math.max(40, Math.ceil(maxLen * 7.5) + 12))
}

type CountTooltipProps = {
  active?: boolean
  label?: string | number
  countLabel: string
  data: NamedCount[]
}

function CountTooltipContent({
  active,
  label,
  countLabel,
  data,
}: CountTooltipProps) {
  if (!active || label == null || label === '') {
    return null
  }

  const row = data.find((entry) => entry.name === String(label))
  if (!row) {
    return null
  }

  const mergedFrom = row.mergedFrom

  return (
    <div className="grid min-w-[8rem] max-w-xs items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{row.name}</div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">{countLabel}</span>
        <span className="font-mono font-medium tabular-nums">
          {row.count.toLocaleString()}
        </span>
      </div>
      {mergedFrom && mergedFrom.length > 1 ? (
        <div className="border-t border-border/50 pt-1.5 text-muted-foreground">
          <div className="mb-0.5 font-medium text-foreground/80">
            Merged from
          </div>
          <div className="break-words">{mergedFrom.join(', ')}</div>
        </div>
      ) : null}
    </div>
  )
}

export function HorizontalCountChart({
  data,
  countLabel = 'Cases',
}: HorizontalCountChartProps) {
  const height = Math.max(280, data.length * 36 + 48)
  const yAxisWidth = yAxisWidthForLabels(data.map((row) => row.name))
  const config = {
    ...chartConfig,
    count: { ...chartConfig.count, label: countLabel },
  } satisfies ChartConfig

  return (
    <ChartContainer
      config={config}
      className="w-full"
      style={{ height, aspectRatio: 'auto' }}
    >
      <BarChart
        accessibilityLayer
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 24, left: 4, bottom: 8 }}
      >
        <CartesianGrid horizontal={false} />
        <XAxis
          type="number"
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          width={yAxisWidth}
          tickMargin={8}
        />
        <ChartTooltip
          content={({ active, label }) => (
            <CountTooltipContent
              active={active}
              label={label}
              countLabel={countLabel}
              data={data}
            />
          )}
        />
        <Bar dataKey="count" fill="var(--color-count)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}
