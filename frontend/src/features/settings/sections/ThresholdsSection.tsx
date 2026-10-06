import { Panel } from '@/components/ui/surface'
import { SettingRow } from '../components/SettingRow'
import { SettingsSlider } from '../components/SettingsSlider'
import { ThresholdPreview } from '../components/ThresholdPreview'
import type { UsePreferencesReturn } from '../hooks/usePreferences'

interface ThresholdsSectionProps {
  prefHook: UsePreferencesReturn
}

export function ThresholdsSection({ prefHook }: ThresholdsSectionProps) {
  const { prefs, update } = prefHook

  return (
    <>
      <Panel title="METRIC THRESHOLDS" action={<span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>warning & critical levels</span>} flush>
        <SettingRow label="CPU warning" hint="Alert when CPU usage exceeds this %.">
          <SettingsSlider min={50} max={95} step={5} value={prefs.cpu_warn} onChange={(v) => update({ cpu_warn: v })} color="warning" unit="%" aria-label="CPU warning" />
        </SettingRow>
        <SettingRow label="CPU critical" hint="Critical alert threshold.">
          <SettingsSlider min={60} max={100} step={5} value={prefs.cpu_crit} onChange={(v) => update({ cpu_crit: v })} color="danger" unit="%" aria-label="CPU critical" />
        </SettingRow>
        <SettingRow label="Memory warning" hint="Alert when memory usage exceeds this %.">
          <SettingsSlider min={50} max={95} step={5} value={prefs.mem_warn} onChange={(v) => update({ mem_warn: v })} color="warning" unit="%" aria-label="Memory warning" />
        </SettingRow>
        <SettingRow label="Memory critical" hint="Critical RAM usage threshold.">
          <SettingsSlider min={65} max={99} step={1} value={prefs.mem_crit || 95} onChange={(v) => update({ mem_crit: v })} color="danger" unit="%" aria-label="Memory critical" />
        </SettingRow>
        <SettingRow label="Filesystem warning" hint="Alert when any mount exceeds this %.">
          <SettingsSlider min={50} max={95} step={1} value={prefs.fs_warn} onChange={(v) => update({ fs_warn: v })} color="warning" unit="%" aria-label="Filesystem warning" />
        </SettingRow>
        <SettingRow label="Filesystem critical" hint="Critical disk usage threshold.">
          <SettingsSlider min={70} max={99} step={1} value={prefs.fs_crit || 95} onChange={(v) => update({ fs_crit: v })} color="danger" unit="%" aria-label="Filesystem critical" />
        </SettingRow>
        <SettingRow label="Temperature warning" hint="Alert when sensor temperature exceeds this °C.">
          <SettingsSlider min={50} max={100} step={5} value={prefs.temp_warn} onChange={(v) => update({ temp_warn: v })} color="warning" unit=" °C" aria-label="Temperature warning" />
        </SettingRow>
        <SettingRow label="Temperature critical" hint="Critical overheating temperature.">
          <SettingsSlider min={60} max={110} step={5} value={prefs.temp_crit} onChange={(v) => update({ temp_crit: v })} color="danger" unit=" °C" aria-label="Temperature critical" />
        </SettingRow>
        <SettingRow label="Battery low warning" hint="Alert when battery falls below this % during discharge.">
          <SettingsSlider min={10} max={50} step={5} value={prefs.battery_low} onChange={(v) => update({ battery_low: v })} color="purple" unit="%" aria-label="Battery low warning" />
        </SettingRow>
        <SettingRow label="Battery critical alert" hint="Critical low battery threshold before shutdown.">
          <SettingsSlider min={5} max={25} step={1} value={prefs.battery_crit || 10} onChange={(v) => update({ battery_crit: v })} color="danger" unit="%" aria-label="Battery critical alert" />
        </SettingRow>
      </Panel>

      <Panel title="LIVE PREVIEW" action={<span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>against current values</span>}>
        <ThresholdPreview prefs={prefs} />
      </Panel>
    </>
  )
}
