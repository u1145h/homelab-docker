import { useMemo } from 'react'
import { getAllWidgets, WidgetCard, WidgetState, computeWidgetState } from '@/widgets'
import { AutoGrid } from '@/components/ui/layout'
import type { StatusResponse } from '@/types/status'

interface OverviewTabProps {
  data: StatusResponse
}

const OVERVIEW_WIDGETS = ['cpu', 'memory', 'storage', 'network']

export default function OverviewTab({ data }: OverviewTabProps) {
  const widgets = useMemo(() => getAllWidgets().filter((w) => OVERVIEW_WIDGETS.includes(w.metadata.id)), [])

  const entries = useMemo(() =>
    widgets.map((w) => ({
      key: w.metadata.id,
      widget: w,
      ...computeWidgetState(w, data, false),
    })),
    [widgets, data],
  )

  return (
    <AutoGrid minItemWidth={280} gap={24}>
      {entries.map((entry) => (
        <WidgetCard key={entry.key} widget={entry.widget} state={entry.state}>
          {entry.state === WidgetState.Ready && entry.props != null
            ? entry.widget.render!(entry.props)
            : null}
        </WidgetCard>
      ))}
    </AutoGrid>
  )
}
