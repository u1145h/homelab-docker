import { Panel } from '@/components/ui/surface'
import { Switch } from '@/components/ui/forms'

import { SettingRow } from '../components/SettingRow'
import { SegmentedControl } from '../components/SegmentedControl'
import { WidgetToggleGrid } from '../components/WidgetToggleGrid'
import { useAppearance } from '@/hooks/useAppearance'
import { useThemeMode } from '@/hooks/useThemeMode'
import type { UsePreferencesReturn } from '../hooks/usePreferences'

const THEME_OPTIONS = [
  { label: 'Dark', value: 'dark' as const },
  { label: 'Light', value: 'light' as const },
  { label: 'System Default', value: 'system' as const },
]

interface AppearanceSectionProps {
  prefHook: UsePreferencesReturn
}

export function AppearanceSection({ prefHook }: AppearanceSectionProps) {
  const { prefs, update } = prefHook
  const { theme, setTheme, amoled, setAmoled } = useAppearance()
  const { mode } = useThemeMode()
  const visibleWidgets = Array.isArray(prefs?.visible_widgets) ? prefs.visible_widgets : []
  const enabledCount = visibleWidgets.length

  return (
    <>
      <Panel
        title="THEME"
        action={
          <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', fontFamily: 'monospace' }}>
            {theme}{amoled && mode === 'dark' ? ' · amoled' : ''} · gruvbox material
          </span>
        }
        flush
      >
        <SettingRow label="Color scheme">
          <SegmentedControl
            options={THEME_OPTIONS}
            value={prefs.theme || theme}
            onChange={(v) => {
              setTheme(v)
              update({ theme: v })
            }}
            aria-label="Color scheme"
          />
        </SettingRow>
        <SettingRow
          label="Amoled"
          hint={
            mode === 'dark'
              ? 'Pure black background for OLED displays'
              : 'Only applicable in dark mode'
          }
          inlineOnMobile
        >
          <Switch
            checked={prefs.amoled ?? amoled}
            onChange={(v) => {
              setAmoled(v)
              update({ amoled: v })
            }}
            aria-label="Amoled mode"
          />
        </SettingRow>
      </Panel>

      <Panel
        title="DASHBOARD WIDGETS"
        action={<span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', fontFamily: 'monospace' }}>{enabledCount} / 9 visible</span>}
      >
        <WidgetToggleGrid
          visible={visibleWidgets}
          onChange={(v) => update({ visible_widgets: v })}
        />
      </Panel>
    </>
  )
}
