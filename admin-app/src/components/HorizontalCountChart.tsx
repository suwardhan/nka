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

export function HorizontalCountChart({
  data,
  countLabel = 'Cases',
}: HorizontalCountChartProps) {
  const height = Math.max(280, data.length * 36 + 48)
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
        margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
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
          width={160}
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
