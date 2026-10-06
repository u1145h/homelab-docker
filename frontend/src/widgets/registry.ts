import type { WidgetDefinition, WidgetStateResult } from './shared/types'
import { WidgetState } from './shared/types'
import { createElement, type ComponentType } from 'react'

const _registry: WidgetDefinition[] = []

export function defineWidget<T>(def: WidgetDefinition<T>): WidgetDefinition<T> {
  const full: WidgetDefinition<T> = {
    ...def,
    render: def.render ?? ((props: T) => {
      const C = def.component as ComponentType<Record<string, unknown>>
      return createElement(C, props as Record<string, unknown>)
    }),
  }
  _registry.push(full as unknown as WidgetDefinition)
  return full
}

export function getAllWidgets(): WidgetDefinition[] {
  return [..._registry].sort((a, b) => a.metadata.priority - b.metadata.priority)
}

export function getWidget(id: string): WidgetDefinition | undefined {
  return _registry.find((w) => w.metadata.id === id)
}

export function getWidgetsByCategory(category: string): WidgetDefinition[] {
  return _registry.filter((w) => w.metadata.category === category)
}

export function getWidgetCount(): number {
  return _registry.length
}

export function computeWidgetState(
  widget: WidgetDefinition,
  status: unknown | null,
  isOffline?: boolean,
): WidgetStateResult {
  if (isOffline) {
    return { state: WidgetState.Offline, props: null }
  }
  if (status == null) {
    return { state: WidgetState.Loading, props: null }
  }
  try {
    const props = widget.selectData(status)
    return {
      state: props ? WidgetState.Ready : WidgetState.Empty,
      props,
    }
  } catch (e) {
    return {
      state: WidgetState.Error,
      props: null,
      error: e instanceof Error ? e.message : 'Failed to process widget data',
    }
  }
}
