import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
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
          content={<ChartTooltipContent nameKey="count" labelKey="name" />}
        />
        <Bar dataKey="count" fill="var(--color-count)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}
