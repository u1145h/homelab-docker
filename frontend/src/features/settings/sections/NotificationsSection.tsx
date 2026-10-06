import { useState, type ReactNode } from 'react'
import { Panel } from '@/components/ui/surface'
import { Switch } from '@/components/ui/forms'
import { SettingRow } from '../components/SettingRow'
import { SettingsSlider } from '../components/SettingsSlider'
import { SegmentedControl } from '../components/SegmentedControl'
import { LegendRow } from '../components/LegendRow'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/contexts/NotificationContext'
import { playNotificationSound } from '@/services/notificationBridge'
import { radius } from '@/design/radius'
import type { UsePreferencesReturn } from '../hooks/usePreferences'

const SEVERITY_OPTIONS = [
  { label: 'All', value: 'all' as const },
  { label: 'Warning', value: 'warning' as const },
  { label: 'Critical', value: 'critical' as const },
]

const RENOTIFY_OPTIONS = [
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1h', value: '1h' },
]

interface CategoryConfig {
  key: keyof UsePreferencesReturn['prefs']
  title: string
  desc: string
  icon: ReactNode
  badge?: string
}

const NOTIFICATION_CATEGORIES: CategoryConfig[] = [
  {
    key: 'notify_cpu',
    title: 'CPU Usage & Spikes',
    desc: 'Alerts when CPU load breaches warning or critical thresholds.',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <rect x="9" y="9" width="6" height="6" />
        <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
      </svg>
    ),
  },
  {
    key: 'notify_memory',
    title: 'Memory & RAM Saturation',
    desc: 'Alerts on high RAM utilization and potential out-of-memory states.',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 19v-3M10 19v-3M14 19v-3M18 19v-3M6 5v3M10 5v3M14 5v3M18 5v3M2 8h20v8H2z" />
      </svg>
    ),
  },
  {
    key: 'notify_storage',
    title: 'Disk & Storage Mounts',
    desc: 'Alerts when filesystem partitions or volume mounts run low on space.',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5V19A9 3 0 0 0 21 19V5M3 12A9 3 0 0 0 21 12" />
      </svg>
    ),
  },
  {
    key: 'notify_thermal',
    title: 'Thermal & Temperature',
    desc: 'Alerts when hardware sensor temperatures exceed safe operating limits.',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
      </svg>
    ),
  },
  {
    key: 'notify_battery',
    title: 'Battery & Power State',
    desc: 'Alerts on charger connected/disconnected, low battery, 100% full, and health warnings.',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="7" width="16" height="10" rx="2" ry="2" />
        <line x1="22" y1="11" x2="22" y2="13" />
        <line x1="6" y1="11" x2="6" y2="13" />
        <line x1="10" y1="11" x2="10" y2="13" />
      </svg>
    ),
  },
  {
    key: 'notify_docker',
    title: 'Docker Containers',
    desc: 'Alerts when container statuses change (started, stopped, exited, or unhealthy).',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 13s-2-2-4-2-4 2-6 2-4-2-6-2-4 2-4 2M4 10h3v3H4zm5 0h3v3H9zm5 0h3v3h-3zm-5-5h3v3H9zm5 0h3v3h-3z" />
      </svg>
    ),
  },
  {
    key: 'notify_network',
    title: 'Network Interfaces',
    desc: 'Alerts when network interfaces change link status (interface UP / DOWN).',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
      </svg>
    ),
  },
  {
    key: 'notify_tailscale',
    title: 'Tailscale VPN',
    desc: 'Alerts when Tailscale daemon connects, disconnects, or changes tunnel state.',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="m4.93 4.93 4.24 4.24M14.83 9.17l4.24-4.24M14.83 14.83l4.24 4.24M9.17 14.83l-4.24 4.24" />
      </svg>
    ),
  },
]

interface NotificationsSectionProps {
  prefHook: UsePreferencesReturn
}

export function NotificationsSection({ prefHook }: NotificationsSectionProps) {
  const { prefs, update } = prefHook
  const { user } = useAuth()
  const { sendTestAlert, requestPermission, isPermissionGranted } = useNotifications()
  const [testingAlert, setTestingAlert] = useState(false)
  const [activeTab, setActiveTab] = useState<'categories' | 'thresholds'>('categories')

  const username = user?.username || 'admin'

  const handleTestChime = () => {
    playNotificationSound('warning')
  }

  const handleTriggerTest = async () => {
    setTestingAlert(true)
    try {
      await sendTestAlert(
        'warning',
        'Test Alert Notification',
        `Live test alert from HomeLab for account @${username}.`
      )
    } finally {
      setTimeout(() => setTestingAlert(false), 800)
    }
  }

  return (
    <>
      {/* Account Profile Scoping Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '12px 16px',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--kuro-color-border)',
          borderRadius: radius.card,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: radius.button,
              backgroundColor: 'rgba(var(--kuro-color-accent-rgb, 169,182,101), 0.15)',
              color: 'var(--kuro-color-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {username.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
              Account Profile: <span style={{ color: 'var(--kuro-color-accent)' }}>@{username}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)', marginTop: 2 }}>
              Notification toggles, alert channels, and threshold triggers saved here apply exclusively to this account.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleTestChime}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: radius.button,
              border: '1px solid var(--kuro-color-border)',
              backgroundColor: 'var(--kuro-color-surface)',
              color: 'var(--kuro-color-text-primary)',
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
            Test Sound
          </button>
          <button
            onClick={handleTriggerTest}
            disabled={testingAlert}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: radius.button,
              border: '1px solid var(--kuro-color-accent)',
              backgroundColor: 'rgba(var(--kuro-color-accent-rgb, 169,182,101), 0.1)',
              color: 'var(--kuro-color-accent)',
              fontSize: 11,
              fontWeight: 600,
              cursor: testingAlert ? 'not-allowed' : 'pointer',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            {testingAlert ? 'Sending…' : 'Send Test Alert'}
          </button>
        </div>
      </div>

      {/* Mode Sub-Tabs (Categories vs Thresholds) */}
      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--kuro-color-border)', paddingBottom: 10 }}>
        <button
          onClick={() => setActiveTab('categories')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: radius.button,
            border: 'none',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: activeTab === 'categories' ? 'var(--kuro-color-surface)' : 'transparent',
            color: activeTab === 'categories' ? 'var(--kuro-color-accent)' : 'var(--kuro-color-text-secondary)',
            borderBottom: activeTab === 'categories' ? '2px solid var(--kuro-color-accent)' : '2px solid transparent',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect width="7" height="7" x="3" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="14" rx="1" />
            <rect width="7" height="7" x="3" y="14" rx="1" />
          </svg>
          Notification Categories
        </button>
        <button
          onClick={() => setActiveTab('thresholds')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: radius.button,
            border: 'none',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: activeTab === 'thresholds' ? 'var(--kuro-color-surface)' : 'transparent',
            color: activeTab === 'thresholds' ? 'var(--kuro-color-accent)' : 'var(--kuro-color-text-secondary)',
            borderBottom: activeTab === 'thresholds' ? '2px solid var(--kuro-color-accent)' : '2px solid transparent',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m12 14 4-4" />
            <path d="M3.34 19a10 10 0 1 1 17.32 0" />
          </svg>
          Trigger Thresholds
        </button>
      </div>

      {activeTab === 'categories' && (
        <Panel
          title="EVENT CATEGORIES"
          action={<span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>toggle notifications to receive</span>}
          flush
        >
          <div style={{ padding: '4px 0' }}>
            {NOTIFICATION_CATEGORIES.map((cat) => {
              const isEnabled = prefs[cat.key] !== false
              return (
                <div
                  key={String(cat.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--kuro-color-border)',
                    backgroundColor: isEnabled ? 'transparent' : 'rgba(0,0,0,0.1)',
                    transition: 'background-color 150ms',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: radius.button,
                        backgroundColor: isEnabled
                          ? 'rgba(var(--kuro-color-accent-rgb, 169,182,101), 0.12)'
                          : 'var(--kuro-color-surface)',
                        color: isEnabled ? 'var(--kuro-color-accent)' : 'var(--kuro-color-text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'background-color 150ms, color 150ms',
                      }}
                    >
                      {cat.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                        {cat.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)', marginTop: 2 }}>
                        {cat.desc}
                      </div>
                    </div>
                  </div>

                  <Switch
                    checked={isEnabled}
                    onChange={(v) => update({ [cat.key]: v })}
                    aria-label={`Toggle ${cat.title}`}
                  />
                </div>
              )
            })}
          </div>
        </Panel>
      )}

      {activeTab === 'thresholds' && (
        <Panel
          title="ALERT THRESHOLDS"
          action={<span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>trigger conditions</span>}
          flush
        >
          <SettingRow label="CPU usage warning" hint="Trigger warning alert when CPU usage exceeds this %.">
            <SettingsSlider min={50} max={95} step={5} value={prefs.cpu_warn} onChange={(v) => update({ cpu_warn: v })} color="warning" unit="%" aria-label="CPU warning" />
          </SettingRow>
          <SettingRow label="CPU usage critical" hint="Trigger critical alert when CPU usage exceeds this %.">
            <SettingsSlider min={60} max={100} step={5} value={prefs.cpu_crit} onChange={(v) => update({ cpu_crit: v })} color="danger" unit="%" aria-label="CPU critical" />
          </SettingRow>
          <SettingRow label="Memory usage warning" hint="Trigger warning alert when RAM usage exceeds this %.">
            <SettingsSlider min={50} max={95} step={5} value={prefs.mem_warn} onChange={(v) => update({ mem_warn: v })} color="warning" unit="%" aria-label="Memory warning" />
          </SettingRow>
          <SettingRow label="Memory usage critical" hint="Trigger critical alert on high RAM consumption.">
            <SettingsSlider min={65} max={99} step={1} value={prefs.mem_crit || 95} onChange={(v) => update({ mem_crit: v })} color="danger" unit="%" aria-label="Memory critical" />
          </SettingRow>
          <SettingRow label="Filesystem warning" hint="Trigger warning alert when any mount exceeds this %.">
            <SettingsSlider min={50} max={95} step={1} value={prefs.fs_warn} onChange={(v) => update({ fs_warn: v })} color="warning" unit="%" aria-label="Filesystem warning" />
          </SettingRow>
          <SettingRow label="Filesystem critical" hint="Trigger critical alert when partition is nearly full.">
            <SettingsSlider min={70} max={99} step={1} value={prefs.fs_crit || 95} onChange={(v) => update({ fs_crit: v })} color="danger" unit="%" aria-label="Filesystem critical" />
          </SettingRow>
          <SettingRow label="Temperature warning" hint="Trigger warning alert when sensor exceeds this °C.">
            <SettingsSlider min={50} max={100} step={5} value={prefs.temp_warn} onChange={(v) => update({ temp_warn: v })} color="warning" unit=" °C" aria-label="Temperature warning" />
          </SettingRow>
          <SettingRow label="Temperature critical" hint="Trigger critical alert on thermal overheating.">
            <SettingsSlider min={60} max={110} step={5} value={prefs.temp_crit} onChange={(v) => update({ temp_crit: v })} color="danger" unit=" °C" aria-label="Temperature critical" />
          </SettingRow>
          <SettingRow label="Battery low warning" hint="Trigger warning alert when battery drops below this %.">
            <SettingsSlider min={10} max={50} step={5} value={prefs.battery_low} onChange={(v) => update({ battery_low: v })} color="purple" unit="%" aria-label="Battery low warning" />
          </SettingRow>
          <SettingRow label="Battery critical alert" hint="Trigger critical alert before automatic power loss.">
            <SettingsSlider min={5} max={25} step={1} value={prefs.battery_crit || 10} onChange={(v) => update({ battery_crit: v })} color="danger" unit="%" aria-label="Battery critical alert" />
          </SettingRow>
        </Panel>
      )}

      {/* Delivery Channels */}
      <Panel title="DELIVERY CHANNELS" action={<span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>output channels</span>} flush>
        <SettingRow
          label="Browser push notifications"
          hint="Push native desktop OS notifications when metric thresholds are breached."
          inlineOnMobile
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!isPermissionGranted && (
              <button
                onClick={() => requestPermission()}
                style={{
                  padding: '4px 10px',
                  borderRadius: radius.button,
                  border: '1px solid var(--kuro-color-border)',
                  backgroundColor: 'var(--kuro-color-surface)',
                  color: 'var(--kuro-color-accent)',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Grant Permission
              </button>
            )}
            <Switch
              checked={prefs.notify_browser}
              onChange={(v) => update({ notify_browser: v })}
              aria-label="Browser notifications"
            />
          </div>
        </SettingRow>

        <SettingRow
          label="Audible alert chime"
          hint="Play a tone chime whenever a new notification or threshold alert arrives."
          inlineOnMobile
        >
          <Switch
            checked={prefs.notify_sound !== false}
            onChange={(v) => update({ notify_sound: v })}
            aria-label="Audible alert chime"
          />
        </SettingRow>

        <SettingRow label="Email delivery" hint="Configured on server via SMTP_* environment variables.">
          <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', border: '1px solid var(--kuro-color-border)', borderRadius: 4, padding: '2px 8px' }}>
            Server config
          </span>
        </SettingRow>

        <SettingRow label="Webhook integration" hint="Configured on server via WEBHOOK_URL environment variable.">
          <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', border: '1px solid var(--kuro-color-border)', borderRadius: 4, padding: '2px 8px' }}>
            Server config
          </span>
        </SettingRow>
      </Panel>

      {/* Rules & Suppression */}
      <Panel title="DELIVERY RULES & SUPPRESSION" action={<span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>alert filters</span>} flush>
        <SettingRow label="Minimum severity level" hint="Only deliver notifications matching or above this severity.">
          <SegmentedControl
            options={SEVERITY_OPTIONS}
            value={prefs.min_severity}
            onChange={(v) => update({ min_severity: v })}
            aria-label="Minimum severity"
          />
        </SettingRow>

        <SettingRow label="Quiet hours (22:00 – 07:00)" hint="Suppress all non-critical notifications during night hours." inlineOnMobile>
          <Switch
            checked={prefs.quiet_hours}
            onChange={(v) => update({ quiet_hours: v })}
            aria-label="Quiet hours"
          />
        </SettingRow>

        <SettingRow label="Re-notify interval" hint="Minimum duration before repeating alerts for an ongoing persistent issue.">
          <SegmentedControl
            options={RENOTIFY_OPTIONS}
            value={prefs.renotify_interval}
            onChange={(v) => update({ renotify_interval: v })}
            aria-label="Re-notify interval"
          />
        </SettingRow>
      </Panel>

      <Panel title="24H ALERT SUMMARY" action={<span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>activity log</span>}>
        <LegendRow label="Delivered" value="Active" color="var(--kuro-color-success)" />
        <LegendRow label="Suppressed (quiet hours)" value="Auto" color="var(--kuro-color-warning)" />
        <LegendRow label="Failed / Blocked" value="0" color="var(--kuro-color-danger)" />
      </Panel>
    </>
  )
}
