import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CircularProgress } from '@mui/material'
import ContainerIcon from '../components/ContainerIcon'
import ContainerIconPickerModal from '../components/ContainerIconPickerModal'
import { setCustomDockerIcon } from '../utils/customDockerIcons'
import {
  getContainerDetail,
  getContainerLogs,
  startContainer,
  stopContainer,
  restartContainer,
  removeContainer,
} from '../api/docker'
import { radius } from '@/design/radius'
import { useSnackbar } from '@/hooks/useSnackbar'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatDateTime } from '@/utils/format'
import type { ContainerDetail, ContainerLog } from '../types'

/* ─────────────────────────────────────────────
   Colours & helpers
──────────────────────────────────────────────── */
function stateColor(state: string) {
  if (state === 'running') return 'var(--kuro-color-success)'
  if (state === 'paused') return 'var(--kuro-color-warning)'
  if (state === 'restarting') return 'var(--kuro-color-info)'
  return 'var(--kuro-color-danger)'
}

function healthFromStatus(status: string) {
  const l = (status || '').toLowerCase()
  if (l.includes('healthy')) return { label: 'healthy', color: 'var(--kuro-color-success)' }
  if (l.includes('unhealthy')) return { label: 'unhealthy', color: 'var(--kuro-color-danger)' }
  return null
}

function fmtBytes(n: number | undefined, decimals = 1): string {
  if (n === undefined || n === null || isNaN(n)) return '--'
  if (n === 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(n) / Math.log(k))
  return parseFloat((n / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

function fmtTime(iso: string | undefined): string {
  if (!iso || iso === '0001-01-01T00:00:00Z') return '--'
  return formatDateTime(iso)
}

function fmtUptime(startedAt: string | undefined): string {
  if (!startedAt || startedAt === '0001-01-01T00:00:00Z') return '--'
  const diff = Date.now() - new Date(startedAt).getTime()
  if (diff < 0) return '--'
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

function logLevelColor(level: string) {
  switch (level.toLowerCase()) {
    case 'error': return { bg: 'rgba(239,68,68,0.15)', text: '#f87171', label: 'ERROR' }
    case 'warn':
    case 'warning': return { bg: 'rgba(251,191,36,0.12)', text: '#fbbf24', label: 'WARN' }
    case 'debug': return { bg: 'rgba(99,102,241,0.12)', text: 'var(--kuro-color-accent)', label: 'DEBUG' }
    default: return { bg: 'rgba(34,197,94,0.10)', text: '#4ade80', label: 'INFO' }
  }
}

/* ─────────────────────────────────────────────
   Sub-components
──────────────────────────────────────────────── */
function ActionBtn({
  label,
  icon,
  onClick,
  danger,
  disabled,
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 14px',
        fontSize: 11,
        fontWeight: 500,
        fontFamily: 'inherit',
        borderRadius: radius.button,
        border: `1px solid ${danger ? 'rgba(239,68,68,0.35)' : 'var(--kuro-color-border)'}`,
        backgroundColor: danger ? 'rgba(239,68,68,0.08)' : 'var(--kuro-color-surface)',
        color: danger ? '#f87171' : 'var(--kuro-color-text-primary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        if (disabled) return
        e.currentTarget.style.backgroundColor = danger ? 'rgba(239,68,68,0.15)' : 'var(--kuro-color-hover)'
      }}
      onMouseLeave={(e) => {
        if (disabled) return
        e.currentTarget.style.backgroundColor = danger ? 'rgba(239,68,68,0.08)' : 'var(--kuro-color-surface)'
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

function HeroCard({
  label,
  value,
  unit,
  percent,
  color,
}: {
  label: string
  value: string
  unit?: string
  percent: number
  color: string
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: 'var(--kuro-color-surface)',
        border: '1px solid var(--kuro-color-border)',
        borderRadius: radius.card,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: '-0.5px', lineHeight: 1 }}>
          {value}
        </span>
        {unit && (
          <span style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)', fontWeight: 500 }}>
            {unit}
          </span>
        )}
      </div>
      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--kuro-color-text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <div style={{ width: '100%', height: 4, backgroundColor: 'var(--kuro-color-border)', borderRadius: 2, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${Math.min(100, Math.max(0, percent))}%`,
            backgroundColor: color,
            borderRadius: 2,
            transition: 'width 0.5s ease',
          }}
        />
      </div>
    </div>
  )
}

function MetricChart({
  title,
  subtitle,
  data,
  dataKey,
  color,
  gauge,
  gaugeLabel,
  legend,
}: {
  title: string
  subtitle?: string
  data: { t: string; v: number }[]
  dataKey: string
  color: string
  gauge: number
  gaugeLabel: string
  legend: Array<{ label: string; value: string; color: string }>
}) {
  // SVG donut gauge
  const r = 42
  const circ = 2 * Math.PI * r
  const filled = circ * (1 - Math.min(1, Math.max(0, gauge / 100)))

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: 'var(--kuro-color-surface)',
        border: '1px solid var(--kuro-color-border)',
        borderRadius: radius.card,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 0, gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {title}
        </span>
        {subtitle && (
          <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</span>
        )}
      </div>

      {/* Body: donut + chart */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0, flexWrap: 'wrap' }}>
        {/* Donut gauge */}
        <div style={{ position: 'relative', flexShrink: 0, width: 88, height: 88, margin: '0 auto' }}>
          <svg viewBox="0 0 100 100" width={88} height={88}>
            <circle cx={50} cy={50} r={r} fill="none" stroke="var(--kuro-color-border)" strokeWidth={10} />
            <circle
              cx={50} cy={50} r={r}
              fill="none"
              stroke={color}
              strokeWidth={10}
              strokeDasharray={circ}
              strokeDashoffset={filled}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color, letterSpacing: '-0.3px', lineHeight: 1 }}>
              {gaugeLabel}
            </span>
          </div>
        </div>

        {/* Sparkline Area */}
        <div style={{ flex: '1 1 120px', height: 80, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--kuro-color-surface)', border: '1px solid var(--kuro-color-border)', borderRadius: radius.card, fontSize: 11, padding: '4px 8px' }}
                itemStyle={{ color: 'var(--kuro-color-text-primary)' }}
                labelStyle={{ color: 'var(--kuro-color-text-muted)' }}
              />
              <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#grad-${dataKey})`} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid var(--kuro-color-border)', paddingTop: 8 }}>
        {legend.map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: item.color, display: 'inline-block' }} />
              {item.label}
            </span>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--kuro-color-text-primary)', fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SidePanel({
  title,
  badge,
  children,
}: {
  title: string
  badge?: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        backgroundColor: 'var(--kuro-color-surface)',
        border: '1px solid var(--kuro-color-border)',
        borderRadius: radius.card,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
          {title}
        </span>
        {badge && (
          <span style={{ fontSize: 10, color: 'var(--kuro-color-text-muted)', fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function KVRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
        padding: '5px 0',
        borderBottom: '1px solid var(--kuro-color-border)',
      }}
    >
      <span style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)', flexShrink: 0, minWidth: 80 }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 11,
          color: 'var(--kuro-color-text-primary)',
          fontFamily: mono ? 'var(--kuro-font-family-mono, monospace)' : 'inherit',
          textAlign: 'right',
          wordBreak: 'break-all',
        }}
      >
        {value || '--'}
      </span>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Main page
──────────────────────────────────────────────── */
export default function ContainerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { showSnackbar } = useSnackbar()
  const queryClient = useQueryClient()

  // History buffers for sparkline charts
  const [cpuHistory, setCpuHistory] = useState<{ t: string; v: number }[]>([])
  const [memHistory, setMemHistory] = useState<{ t: string; v: number }[]>([])
  const [netRxHistory, setNetRxHistory] = useState<{ t: string; v: number }[]>([])
  const [netTxHistory, setNetTxHistory] = useState<{ t: string; v: number }[]>([])
  const [busy, setBusy] = useState(false)
  const [showLogs, setShowLogs] = useState(true)
  const [isIconModalOpen, setIsIconModalOpen] = useState(false)
  const prevDetail = useRef<ContainerDetail | null>(null)

  const { data: detail, isLoading } = useQuery({
    queryKey: ['docker', 'detail', id],
    queryFn: () => getContainerDetail(id!),
    refetchInterval: 3000,
    staleTime: 1500,
    enabled: !!id,
  })

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['docker', 'logs', id],
    queryFn: () => getContainerLogs(id!, 50).catch(() => [] as ContainerLog[]),
    refetchInterval: showLogs ? 5000 : false,
    staleTime: 3000,
    enabled: !!id && showLogs,
  })

  useDocumentTitle(detail ? `${detail.name} — Docker` : 'Container — Docker')

  // Append to sparkline histories
  useEffect(() => {
    if (!detail) return
    const t = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const append = <T,>(arr: T[], val: T, max = 30): T[] => [...arr.slice(-(max - 1)), val]

    setCpuHistory((h) => append(h, { t, v: detail.cpu_percent ?? 0 }))
    setMemHistory((h) => append(h, { t, v: detail.mem_limit ? Math.round((detail.mem_used ?? 0) / detail.mem_limit * 100) : 0 }))
    setNetRxHistory((h) => append(h, { t, v: Math.round((detail.net_rx ?? 0) / 1024) }))
    setNetTxHistory((h) => append(h, { t, v: Math.round((detail.net_tx ?? 0) / 1024) }))
    prevDetail.current = detail
  }, [detail])

  const runAction = useCallback(async (action: () => Promise<void>, successMsg: string) => {
    if (!id) return
    setBusy(true)
    try {
      await action()
      showSnackbar(successMsg, 'success')
      queryClient.invalidateQueries({ queryKey: ['docker', 'detail', id] })
      queryClient.invalidateQueries({ queryKey: ['docker', 'containers'] })
    } catch {
      showSnackbar('Action failed', 'error')
    } finally {
      setBusy(false)
    }
  }, [id, showSnackbar, queryClient])

  const handleRemove = async () => {
    if (!id || !detail) return
    if (!window.confirm(`Remove container "${detail.name}"? This cannot be undone.`)) return
    await runAction(() => removeContainer(id), 'Container removed')
    navigate('/docker')
  }

  if (isLoading && !detail) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <CircularProgress size={28} sx={{ color: 'var(--kuro-color-accent)' }} />
      </div>
    )
  }

  if (!detail) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          height: 300,
          color: 'var(--kuro-color-text-secondary)',
          fontSize: 11,
        }}
      >
        Container not found.
        <button
          onClick={() => navigate('/docker')}
          style={{
            padding: '6px 16px',
            fontSize: 11,
            fontFamily: 'inherit',
            borderRadius: radius.button,
            border: '1px solid var(--kuro-color-border)',
            backgroundColor: 'var(--kuro-color-surface)',
            color: 'var(--kuro-color-text-primary)',
            cursor: 'pointer',
          }}
        >
          ← Back to Docker
        </button>
      </div>
    )
  }

  const isRunning = detail.state.running
  const cpuPct = detail.cpu_percent ?? 0
  const memUsed = detail.mem_used ?? 0
  const memLimit = detail.mem_limit ?? 0
  const memPct = memLimit > 0 ? Math.round(memUsed / memLimit * 100) : 0
  const netRx = detail.net_rx ?? 0
  const netTx = detail.net_tx ?? 0
  const netPct = Math.min(100, Math.round(netRx / (1024 * 1024 * 10) * 100))
  const blockRead = detail.block_read ?? 0
  const blockWrite = detail.block_write ?? 0
  const volSize = detail.mounts?.length ? (detail.mounts.length * 1024 * 1024 * 512) : 0
  const storagePct = volSize > 0 ? Math.min(100, Math.round(blockRead / volSize * 100)) : 0

  const ip = detail.network?.[0]?.ip ?? '--'
  const netName = detail.network?.[0]?.name ?? 'bridge'
  const health = healthFromStatus(detail.state.status)

  // Copy ID
  const copyId = () => {
    navigator.clipboard.writeText(detail.id).then(() => showSnackbar('ID copied', 'success'))
  }

  return (
    <div className="docker-container-detail-page-root">
      {/* ── Breadcrumb ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
        <Link
          to="/"
          style={{ color: 'var(--kuro-color-text-muted)', textDecoration: 'none' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--kuro-color-accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--kuro-color-text-muted)')}
        >
          Home
        </Link>
        <span>/</span>
        <Link
          to="/docker"
          style={{ color: 'var(--kuro-color-text-muted)', textDecoration: 'none' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--kuro-color-accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--kuro-color-text-muted)')}
        >
          Docker
        </Link>
        <span>/</span>
        <span style={{ color: 'var(--kuro-color-text-primary)', fontWeight: 500 }}>
          {detail.name.replace(/^\//, '')}
        </span>
      </div>

      {/* ── Header Row ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          backgroundColor: 'var(--kuro-color-surface)',
          border: '1px solid var(--kuro-color-border)',
          borderRadius: radius.card,
          padding: '14px 18px',
          minWidth: 0,
        }}
      >
        {/* Left: icon + name + meta */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, minWidth: 0, flex: '1 1 280px' }}>
          <div
            style={{
              position: 'relative',
              display: 'inline-flex',
              marginTop: 2,
              flexShrink: 0,
            }}
          >
            <ContainerIcon container={detail} size={44} />
            <button
              onClick={() => setIsIconModalOpen(true)}
              title="Edit container logo"
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                width: 20,
                height: 20,
                borderRadius: '50%',
                backgroundColor: 'var(--kuro-color-background)',
                border: 'none',
                color: 'var(--kuro-color-text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.15)'
                e.currentTarget.style.backgroundColor = 'var(--kuro-color-accent)'
                e.currentTarget.style.color = '#111314'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.backgroundColor = 'var(--kuro-color-background)'
                e.currentTarget.style.color = 'var(--kuro-color-text-primary)'
              }}
            >
              <MinimalPencilIcon />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--kuro-color-text-primary)', wordBreak: 'break-word' }}>
                {detail.name.replace(/^\//, '')}
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 500,
                  color: stateColor(detail.state.status),
                  padding: '2px 8px',
                  borderRadius: radius.button,
                  border: `1px solid ${stateColor(detail.state.status)}30`,
                  backgroundColor: `${stateColor(detail.state.status)}12`,
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: stateColor(detail.state.status),
                    boxShadow: `0 0 6px ${stateColor(detail.state.status)}`,
                  }}
                />
                {detail.state.status}
              </span>
              {health && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: health.color,
                    padding: '2px 8px',
                    borderRadius: radius.button,
                    border: `1px solid ${health.color}30`,
                    backgroundColor: `${health.color}12`,
                    flexShrink: 0,
                  }}
                >
                  {health.label}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
              <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', fontFamily: 'var(--kuro-font-family-mono, monospace)', flexShrink: 0 }}>
                {detail.id.substring(0, 12)}
              </span>
              <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>·</span>
              <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {detail.image}
              </span>
              {detail.state.startedAt && detail.state.startedAt !== '0001-01-01T00:00:00Z' && (
                <>
                  <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>·</span>
                  <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
                    Up {fmtUptime(detail.state.startedAt)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: action buttons */}
        <div className="container-detail-actions">
          <ActionBtn
            label="Copy ID"
            icon={<CopyIcon />}
            onClick={copyId}
            disabled={busy}
          />
          {isRunning ? (
            <ActionBtn
              label="Restart"
              icon={<RestartIcon />}
              onClick={() => runAction(() => restartContainer(detail.id), `${detail.name}: Restarted`)}
              disabled={busy}
            />
          ) : null}
          {isRunning ? (
            <ActionBtn
              label="Stop"
              icon={<StopIcon />}
              onClick={() => runAction(() => stopContainer(detail.id), `${detail.name}: Stopped`)}
              disabled={busy}
              danger
            />
          ) : (
            <ActionBtn
              label="Start"
              icon={<StartIcon />}
              onClick={() => runAction(() => startContainer(detail.id), `${detail.name}: Started`)}
              disabled={busy}
            />
          )}
          <ActionBtn
            label="Remove"
            icon={<TrashIcon />}
            onClick={handleRemove}
            disabled={busy}
            danger
          />
        </div>
      </div>

      {/* ── 4 Hero Metric Cards ── */}
      <div className="container-detail-hero-grid">
        <HeroCard
          label="CPU"
          value={cpuPct > 0 ? `${cpuPct.toFixed(1)}%` : '--'}
          percent={cpuPct}
          color="var(--kuro-color-success)"
        />
        <HeroCard
          label="Memory"
          value={memUsed > 0 ? fmtBytes(memUsed, 0) : '--'}
          percent={memPct}
          color="#22d3ee"
        />
        <HeroCard
          label="Storage"
          value={blockRead > 0 ? fmtBytes(blockRead) : '--'}
          percent={storagePct}
          color="#f97316"
        />
        <HeroCard
          label="Received"
          value={netRx > 0 ? fmtBytes(netRx) : '--'}
          percent={netPct}
          color="var(--kuro-color-success)"
        />
      </div>

      {/* ── 3 Metric Charts + Right sidebar (2-column grid) ── */}
      <div className="responsive-content-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 15, alignItems: 'start' }}>
        {/* LEFT column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 15, minWidth: 0 }}>
          {/* CPU + Memory + Storage charts in a row */}
          <div className="container-detail-charts-grid">
            <MetricChart
              title="CPU"
              subtitle={`limit ${detail.labels?.['com.docker.compose.cpu.limit'] ?? '—'} core`}
              data={cpuHistory}
              dataKey="cpu"
              color="var(--kuro-color-success)"
              gauge={cpuPct}
              gaugeLabel={cpuPct > 0 ? `${cpuPct.toFixed(1)}%` : '--'}
              legend={[
                { label: 'Current', value: cpuPct > 0 ? `${cpuPct.toFixed(1)}%` : '--', color: 'var(--kuro-color-success)' },
                { label: 'Limit', value: detail.labels?.['com.docker.compose.cpu.limit'] ? `${detail.labels['com.docker.compose.cpu.limit']} core` : '--', color: '#6b7280' },
                { label: 'PIDs', value: detail.pids != null ? String(detail.pids) : (detail.state.pid > 0 ? String(detail.state.pid) : '--'), color: '#ef4444' },
              ]}
            />
            <MetricChart
              title="Memory"
              subtitle={memUsed > 0 && memLimit > 0 ? `${fmtBytes(memUsed, 0)} / ${fmtBytes(memLimit, 0)}` : ''}
              data={memHistory}
              dataKey="mem"
              color="#22d3ee"
              gauge={memPct}
              gaugeLabel={memPct > 0 ? `${memPct}%` : '--'}
              legend={[
                { label: 'Used', value: memUsed > 0 ? fmtBytes(memUsed, 0) : '--', color: '#22d3ee' },
                { label: 'Limit', value: memLimit > 0 ? fmtBytes(memLimit, 0) : '--', color: '#6b7280' },
                { label: 'Utilisation', value: memPct > 0 ? `${memPct}%` : '--', color: '#a78bfa' },
              ]}
            />
            <MetricChart
              title="Storage"
              subtitle=""
              data={netRxHistory.map((d) => ({ t: d.t, v: d.v }))}
              dataKey="storage"
              color="#f97316"
              gauge={storagePct}
              gaugeLabel={storagePct > 0 ? `${storagePct}%` : '--'}
              legend={[
                { label: 'Block read', value: blockRead > 0 ? fmtBytes(blockRead) : '--', color: '#f97316' },
                { label: 'Block write', value: blockWrite > 0 ? fmtBytes(blockWrite) : '--', color: '#f43f5e' },
                { label: 'Volume size', value: detail.mounts?.length ? `${detail.mounts.length} vol` : '--', color: '#6b7280' },
              ]}
            />
          </div>

          {/* Network panel */}
          <div
            style={{
              backgroundColor: 'var(--kuro-color-surface)',
              border: '1px solid var(--kuro-color-border)',
              borderRadius: radius.card,
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              minWidth: 0,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 0, flexWrap: 'wrap', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Network
              </span>
              <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
                {netName}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', minWidth: 0 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--kuro-color-text-primary)', fontFamily: 'var(--kuro-font-family-mono, monospace)', wordBreak: 'break-all' }}>
                {ip}
              </span>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 10,
                      height: 6,
                      borderRadius: 1.5,
                      backgroundColor: i < Math.round(netPct / 8) ? 'var(--kuro-color-success)' : 'var(--kuro-color-border)',
                    }}
                  />
                ))}
              </div>
            </div>
            <div style={{ height: 100, width: '100%', minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={netRxHistory.map((r, i) => ({
                    t: r.t,
                    rx: r.v,
                    tx: netTxHistory[i]?.v ?? 0,
                  }))}
                  margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="net-rx" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--kuro-color-success)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--kuro-color-success)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="net-tx" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" hide />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--kuro-color-surface)', border: '1px solid var(--kuro-color-border)', borderRadius: radius.card, fontSize: 11, padding: '4px 8px' }}
                    itemStyle={{ color: 'var(--kuro-color-text-primary)' }}
                    labelStyle={{ color: 'var(--kuro-color-text-muted)' }}
                    formatter={(v) => [`${v ?? 0} KB`]}
                  />
                  <Area type="monotone" dataKey="rx" stroke="var(--kuro-color-success)" strokeWidth={1.5} fill="url(#net-rx)" dot={false} isAnimationActive={false} />
                  <Area type="monotone" dataKey="tx" stroke="#f97316" strokeWidth={1.5} fill="url(#net-tx)" dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>
                  <span style={{ width: 12, height: 1.5, backgroundColor: 'var(--kuro-color-success)', display: 'inline-block', borderRadius: 1 }} />
                  RX total
                </span>
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--kuro-color-text-primary)', fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
                  {netRx > 0 ? fmtBytes(netRx) : '--'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>
                  <span style={{ width: 12, height: 1.5, backgroundColor: '#f97316', display: 'inline-block', borderRadius: 1 }} />
                  TX total
                </span>
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--kuro-color-text-primary)', fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
                  {netTx > 0 ? fmtBytes(netTx) : '--'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>
                  <span style={{ width: 12, height: 1.5, backgroundColor: '#6b7280', display: 'inline-block', borderRadius: 1 }} />
                  Network
                </span>
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--kuro-color-text-primary)', fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
                  {netName}
                </span>
              </div>
            </div>
          </div>

          {/* Docker Logs */}
          <div
            style={{
              backgroundColor: 'var(--kuro-color-surface)',
              border: '1px solid var(--kuro-color-border)',
              borderRadius: radius.card,
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              minWidth: 0,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 0, flexWrap: 'wrap', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--kuro-color-text-primary)' }}>
                Docker logs
              </span>
              <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)' }}>
                {logs.length > 0 ? `${logs.length} recent lines` : logsLoading ? 'loading…' : 'no logs'}
              </span>
            </div>

            <div
              style={{
                fontFamily: 'var(--kuro-font-family-mono, monospace)',
                fontSize: 11,
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                maxHeight: 280,
                overflow: 'auto',
                backgroundColor: 'rgba(0,0,0,0.2)',
                borderRadius: radius.card,
                padding: '10px 12px',
                minWidth: 0,
              }}
            >
              {logsLoading && logs.length === 0 ? (
                <span style={{ color: 'var(--kuro-color-text-muted)', whiteSpace: 'nowrap' }}>Loading logs…</span>
              ) : logs.length === 0 ? (
                <span style={{ color: 'var(--kuro-color-text-muted)', whiteSpace: 'nowrap' }}>
                  {isRunning ? 'No recent log entries.' : 'Container is not running.'}
                </span>
              ) : (
                logs.map((log, i) => {
                  const lvl = logLevelColor(log.level)
                  return (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', whiteSpace: 'nowrap', width: 'max-content', minWidth: '100%' }}>
                      <span style={{ color: '#6b7280', flexShrink: 0, minWidth: 56 }}>
                        {log.timestamp ? new Date(log.timestamp).toLocaleTimeString('en-GB') : ''}
                      </span>
                      <span
                        style={{
                          flexShrink: 0,
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: 3,
                          backgroundColor: lvl.bg,
                          color: lvl.text,
                          letterSpacing: '0.05em',
                          alignSelf: 'center',
                        }}
                      >
                        {lvl.label}
                      </span>
                      <span style={{ color: 'var(--kuro-color-text-primary)', whiteSpace: 'nowrap' }}>
                        {log.message}
                      </span>
                    </div>
                  )
                })
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowLogs((v) => !v)}
                style={{
                  padding: '4px 12px', fontSize: 11, fontFamily: 'inherit', fontWeight: 500,
                  borderRadius: radius.button, border: '1px solid var(--kuro-color-border)',
                  backgroundColor: showLogs ? 'var(--kuro-color-accent)' : 'var(--kuro-color-surface)',
                  color: showLogs ? '#fff' : 'var(--kuro-color-text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {showLogs ? 'Following logs' : 'Follow logs'}
              </button>
              <button
                onClick={() => {
                  const text = logs.map((l) => `[${l.timestamp}] [${l.level}] ${l.message}`).join('\n')
                  const blob = new Blob([text], { type: 'text/plain' })
                  const a = document.createElement('a')
                  a.href = URL.createObjectURL(blob)
                  a.download = `${detail.name}-logs.txt`
                  a.click()
                }}
                disabled={logs.length === 0}
                style={{
                  padding: '4px 12px', fontSize: 11, fontFamily: 'inherit', fontWeight: 500,
                  borderRadius: radius.button, border: '1px solid var(--kuro-color-border)',
                  backgroundColor: 'var(--kuro-color-surface)', color: 'var(--kuro-color-text-secondary)',
                  cursor: 'pointer', opacity: logs.length === 0 ? 0.5 : 1,
                }}
              >
                Download
              </button>
              <button
                onClick={() => queryClient.setQueryData(['docker', 'logs', id], [])}
                style={{
                  padding: '4px 12px', fontSize: 11, fontFamily: 'inherit', fontWeight: 500,
                  borderRadius: radius.button, border: '1px solid var(--kuro-color-border)',
                  backgroundColor: 'var(--kuro-color-surface)', color: 'var(--kuro-color-text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Clear view
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 15, minWidth: 0 }}>
          {/* Container Info */}
          <SidePanel title="Container info" badge={`restarts ${detail.restart_count ?? 0}`}>
            <div>
              <KVRow label="Container ID" value={detail.id.substring(0, 12)} mono />
              <KVRow label="Image" value={detail.image} />
              <KVRow label="Command" value={detail.command} mono />
              <KVRow label="Created" value={fmtTime(detail.created)} />
              <KVRow label="Uptime" value={fmtUptime(detail.state.startedAt)} />
              <KVRow label="Restart count" value={String(detail.restart_count ?? 0)} />
              <KVRow label="IP address" value={ip} mono />
            </div>
          </SidePanel>

          {/* Ports */}
          {detail.ports && detail.ports.length > 0 && (
            <SidePanel title="Ports" badge={`${detail.ports.length} mapped`}>
              <div>
                {detail.ports.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '5px 0',
                      borderBottom: i < detail.ports!.length - 1 ? '1px solid var(--kuro-color-border)' : 'none',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--kuro-color-success)', display: 'inline-block', flexShrink: 0 }} />
                      {p.publicPort ? `${p.publicPort} → ${p.privatePort}` : `${p.privatePort}`}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
                      {p.type}
                    </span>
                  </div>
                ))}
              </div>
            </SidePanel>
          )}

          {/* Mounts */}
          {detail.mounts && detail.mounts.length > 0 && (
            <SidePanel title="Mounts" badge={`${detail.mounts.length} volumes`}>
              <div>
                {detail.mounts.map((m, i) => (
                  <div key={i} style={{ padding: '5px 0', borderBottom: i < detail.mounts!.length - 1 ? '1px solid var(--kuro-color-border)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, gap: 8 }}>
                      <span style={{ color: 'var(--kuro-color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '45%' }}>
                        {m.source}
                      </span>
                      <span style={{ color: 'var(--kuro-color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '45%', textAlign: 'right' }}>
                        {m.destination} ({m.rw ? 'rw' : 'ro'})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </SidePanel>
          )}

          {/* Environment */}
          {detail.env && detail.env.length > 0 && (
            <SidePanel title="Environment" badge={`${detail.env.length} vars`}>
              <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {detail.env.map((e, i) => {
                  const [key, ...rest] = e.split('=')
                  const val = rest.join('=')
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, padding: '3px 0' }}>
                      <span style={{ fontSize: 11, color: 'var(--kuro-color-text-secondary)', fontFamily: 'var(--kuro-font-family-mono, monospace)', flexShrink: 0 }}>
                        {key}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--kuro-color-text-primary)', fontFamily: 'var(--kuro-font-family-mono, monospace)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {val || ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            </SidePanel>
          )}

          {/* Resource Limits */}
          <SidePanel title="Resource limits">
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--kuro-color-border)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>
                  <span style={{ width: 12, height: 1.5, backgroundColor: 'var(--kuro-color-success)', display: 'inline-block', borderRadius: 1 }} />
                  CPU limit
                </span>
                <span style={{ fontSize: 11, color: 'var(--kuro-color-text-primary)', fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
                  {detail.labels?.['com.docker.compose.cpu.limit'] ? `${detail.labels['com.docker.compose.cpu.limit']} core` : '--'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--kuro-color-border)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>
                  <span style={{ width: 12, height: 1.5, backgroundColor: '#22d3ee', display: 'inline-block', borderRadius: 1 }} />
                  Memory limit
                </span>
                <span style={{ fontSize: 11, color: 'var(--kuro-color-text-primary)', fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
                  {memLimit > 0 ? fmtBytes(memLimit, 0) : '--'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--kuro-color-text-secondary)' }}>
                  <span style={{ width: 12, height: 1.5, backgroundColor: '#f97316', display: 'inline-block', borderRadius: 1 }} />
                  Volume size
                </span>
                <span style={{ fontSize: 11, color: 'var(--kuro-color-text-primary)', fontFamily: 'var(--kuro-font-family-mono, monospace)' }}>
                  {detail.mounts?.length ? `${detail.mounts.length} vol` : '--'}
                </span>
              </div>
            </div>
            {(memPct > 0 || cpuPct > 0) && (
              <div style={{ height: 4, backgroundColor: 'var(--kuro-color-border)', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
                <div style={{ height: '100%', width: `${Math.max(cpuPct, memPct)}%`, background: 'linear-gradient(90deg, var(--kuro-color-success), #22d3ee)', borderRadius: 2, transition: 'width 0.5s ease' }} />
              </div>
            )}
          </SidePanel>
        </div>
      </div>

      {/* Container Logo Edit Modal */}
      <ContainerIconPickerModal
        open={isIconModalOpen}
        onClose={() => setIsIconModalOpen(false)}
        containerName={detail.name}
        containerImage={detail.image}
        onSave={(newIcon) => {
          setCustomDockerIcon({ name: detail.name, id: detail.id }, newIcon || '')
          showSnackbar('Container logo updated successfully', 'success')
        }}
      />
    </div>
  )
}

/* ─────────────────────────────────────────────
   Inline icon helpers (no external dep)
──────────────────────────────────────────────── */
function CopyIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  )
}
function RestartIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  )
}
function StopIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
    </svg>
  )
}
function StartIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  )
}
function TrashIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  )
}
function MinimalPencilIcon() {
  return (
    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  )
}
