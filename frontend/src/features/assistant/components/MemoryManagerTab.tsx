import { useState, useMemo, useEffect, useCallback } from 'react'
import { AppIcon } from '@/components/ui/icons'
import { radius } from '@/design/radius'
import type { KuroMemory, EvolutionStatus } from '../types'
import { getEvolutionStatus, triggerEvolutionCycle } from '../api/assistant'
import { useSnackbar } from '@/hooks/useSnackbar'
import { formatDateTime } from '@/utils/format'

interface MemoryManagerTabProps {
  memories: KuroMemory[]
  onAddMemory: (payload: { category: string; content: string; importance: number }) => Promise<void>
  onEditMemory?: (id: string, payload: { category: string; content: string; importance: number }) => Promise<void>
  onDeleteMemory: (id: string) => Promise<void>
}

const CATEGORY_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  runbook:         { label: 'Troubleshooting Runbooks', color: '#EA6962', desc: 'Synthesized error fixes & autonomous web research recipes' },
  server_baseline: { label: 'Server Baselines',         color: '#7DAEA3', desc: 'Statistical telemetry, memory load & disk metrics' },
  user_habit:      { label: 'Learned Habits',          color: '#D3869B', desc: 'Discovered routines, frequent queries & usage patterns' },
  server_layout:   { label: 'Server Layout & Paths',    color: '#A9B665', desc: 'Host directories, docker-compose paths, volume mounts' },
  instruction:     { label: 'Learned Instructions',     color: '#89B482', desc: 'Rules & procedures Kuro must follow' },
  preference:      { label: 'User Preferences',         color: '#E78A4E', desc: 'Coding styles, personal habits, aliases' },
  fact:            { label: 'Environment Facts',        color: '#E0AF68', desc: 'Device hardware & persistent network facts' },
  general:         { label: 'General Knowledge',        color: '#CECBC4', desc: 'Uncategorized facts & notes' },
}

export default function MemoryManagerTab({ memories, onAddMemory, onEditMemory, onDeleteMemory }: MemoryManagerTabProps) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [evoStatus, setEvoStatus] = useState<EvolutionStatus | null>(null)
  const [triggeringEvo, setTriggeringEvo] = useState(false)
  const { showSnackbar } = useSnackbar()

  // Form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formContent, setFormContent] = useState('')
  const [formCategory, setFormCategory] = useState('server_layout')
  const [formImportance, setFormImportance] = useState(4)
  const [submitting, setSubmitting] = useState(false)

  const cancelForm = useCallback(() => {
    setShowAddForm(false)
    setEditingId(null)
    setFormContent('')
    setFormCategory('server_layout')
    setFormImportance(4)
  }, [])

  useEffect(() => {
    if (!showAddForm) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelForm()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showAddForm, cancelForm])

  const fetchEvolutionStatus = useCallback(async () => {
    try {
      const s = await getEvolutionStatus()
      setEvoStatus(s)
    } catch {
      // Background poll fail
    }
  }, [])

  useEffect(() => {
    fetchEvolutionStatus()
    const interval = setInterval(fetchEvolutionStatus, 12000)
    return () => clearInterval(interval)
  }, [fetchEvolutionStatus])

  const handleTriggerEvolution = async () => {
    setTriggeringEvo(true)
    try {
      await triggerEvolutionCycle()
      showSnackbar('Cognitive evolution cycle initiated in background', 'info')
      setTimeout(fetchEvolutionStatus, 3000)
    } catch (err: any) {
      showSnackbar(err.message || 'Failed to trigger evolution', 'error')
    } finally {
      setTriggeringEvo(false)
    }
  }

  const categories = useMemo(() => {
    const set = new Set<string>(['runbook', 'server_baseline', 'user_habit', 'server_layout', 'instruction', 'preference', 'fact', 'general'])
    memories.forEach((m) => {
      if (m.category) set.add(m.category)
    })
    return ['all', ...Array.from(set)]
  }, [memories])

  const filtered = useMemo(() => {
    return memories.filter((m) => {
      const matchSearch = !search.trim() || m.content.toLowerCase().includes(search.toLowerCase()) || m.category.toLowerCase().includes(search.toLowerCase())
      const matchCat = categoryFilter === 'all' || m.category.toLowerCase() === categoryFilter.toLowerCase()
      return matchSearch && matchCat
    })
  }, [memories, search, categoryFilter])

  const startEdit = (item: KuroMemory) => {
    setEditingId(item.id)
    setFormContent(item.content)
    setFormCategory(item.category || 'general')
    setFormImportance(item.importance || 3)
    setShowAddForm(true)
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formContent.trim()) return
    setSubmitting(true)
    try {
      if (editingId && onEditMemory) {
        await onEditMemory(editingId, {
          category: formCategory,
          content: formContent.trim(),
          importance: formImportance,
        })
      } else {
        await onAddMemory({
          category: formCategory,
          content: formContent.trim(),
          importance: formImportance,
        })
      }
      cancelForm()
    } finally {
      setSubmitting(false)
    }
  }

  const exportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(memories, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute("href", dataStr)
    downloadAnchor.setAttribute("download", `kuro_memories_${new Date().toISOString().slice(0,10)}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  const exportMarkdown = () => {
    let md = `# Kuro AI Assistant Knowledge Base & Trained Memories\n\n`
    md += `*Exported on ${formatDateTime(new Date())}*\n\n`
    const byCat: Record<string, KuroMemory[]> = {}
    memories.forEach((m) => {
      const cat = m.category || 'general'
      if (!byCat[cat]) byCat[cat] = []
      byCat[cat].push(m)
    })
    Object.keys(byCat).forEach((cat) => {
      const label = CATEGORY_LABELS[cat]?.label || cat
      md += `## ${label}\n\n`
      byCat[cat].forEach((m) => {
        md += `- **[${m.importance || 5}/10]** ${m.content}\n`
      })
      md += `\n`
    })

    const dataStr = "data:text/markdown;charset=utf-8," + encodeURIComponent(md)
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute("href", dataStr)
    downloadAnchor.setAttribute("download", `kuro_memories_${new Date().toISOString().slice(0,10)}.md`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (event) => {
      const content = event.target?.result as string
      if (!content) return
      try {
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(content)
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (item.content) {
                await onAddMemory({
                  category: item.category || 'general',
                  content: item.content,
                  importance: item.importance || 5,
                })
              }
            }
          }
        } else {
          // Markdown / Plain text: split by lines starting with '-' or non-empty lines
          const lines = content.split('\n')
          let currentCat = 'instruction'
          for (const line of lines) {
            const trim = line.trim()
            if (trim.startsWith('#')) {
              const hLower = trim.toLowerCase()
              if (hLower.includes('path') || hLower.includes('layout')) currentCat = 'server_layout'
              else if (hLower.includes('prefer')) currentCat = 'preference'
              else if (hLower.includes('fact')) currentCat = 'fact'
              else currentCat = 'instruction'
            } else if (trim.startsWith('-') || trim.startsWith('*')) {
              const rule = trim.replace(/^[-*]\s*/, '').replace(/^\*\*\[.*?\]\*\*\s*/, '').trim()
              if (rule.length > 3) {
                await onAddMemory({
                  category: currentCat,
                  content: rule,
                  importance: 5,
                })
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to import memories:', err)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ─── 1. Header Info & Global Action Toolbar ─── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--kuro-color-text-primary)', letterSpacing: '-0.02em' }}>
            LLM Memory
          </h3>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 12,
              backgroundColor: 'rgba(142, 192, 124, 0.12)',
              color: '#8EC07C',
              border: '1px solid rgba(142, 192, 124, 0.25)',
            }}
          >
            {memories.length} Active Directives
          </span>
        </div>

        {/* Global Toolbar Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {/* Add Directive Button */}
          <button
            onClick={() => {
              setEditingId(null)
              setFormContent('')
              setFormCategory('server_layout')
              setFormImportance(4)
              setShowAddForm(true)
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              backgroundColor: 'var(--kuro-color-primary)',
              color: 'var(--kuro-color-background)',
              border: 'none',
              borderRadius: radius.button,
              padding: '6px 12px',
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 2px 6px rgba(142, 192, 124, 0.25)',
            }}
          >
            <AppIcon name="plus" size={13} />
            <span>Add Directive</span>
          </button>

          {/* Import File Button */}
          <label
            title="Import memories from .json or .md file"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              backgroundColor: 'var(--kuro-color-surface)',
              color: 'var(--kuro-color-text-secondary)',
              border: '1px solid var(--kuro-color-border)',
              borderRadius: radius.button,
              padding: '6px 10px',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <AppIcon name="upload" size={12} />
            <span>Import</span>
            <input
              type="file"
              accept=".json,.md,.txt"
              onChange={handleImportFile}
              style={{ display: 'none' }}
            />
          </label>

          {/* Export JSON */}
          <button
            onClick={exportJSON}
            title="Export memories as JSON"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              backgroundColor: 'var(--kuro-color-surface)',
              color: 'var(--kuro-color-text-secondary)',
              border: '1px solid var(--kuro-color-border)',
              borderRadius: radius.button,
              padding: '6px 10px',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <AppIcon name="download" size={12} />
            <span>JSON</span>
          </button>

          {/* Export Markdown */}
          <button
            onClick={exportMarkdown}
            title="Export memories as Markdown"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              backgroundColor: 'var(--kuro-color-surface)',
              color: 'var(--kuro-color-text-secondary)',
              border: '1px solid var(--kuro-color-border)',
              borderRadius: radius.button,
              padding: '6px 10px',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <AppIcon name="file-text" size={12} />
            <span>Markdown</span>
          </button>
        </div>
      </div>

      {/* ─── 2. Relocated Section: Autonomous Server Evolution & Health HUD ─── */}
      <div
        style={{
          backgroundColor: 'rgba(20, 22, 27, 0.94)',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--kuro-color-border)',
          borderRadius: radius.card,
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        }}
      >
        {/* Top Header of Card */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: evoStatus?.active ? 'rgba(142, 192, 124, 0.12)' : 'rgba(234, 105, 98, 0.12)',
                border: `1px solid ${evoStatus?.active ? 'rgba(142, 192, 124, 0.3)' : 'rgba(234, 105, 98, 0.3)'}`,
                color: evoStatus?.active ? '#8EC07C' : '#EA6962',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AppIcon name="cpu" size={16} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                Autonomous Evolution Engine
              </span>
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 4,
                  backgroundColor: evoStatus?.active ? 'rgba(142, 192, 124, 0.15)' : 'rgba(234, 105, 98, 0.15)',
                  color: evoStatus?.active ? '#8EC07C' : '#EA6962',
                  border: `1px solid ${evoStatus?.active ? 'rgba(142, 192, 124, 0.3)' : 'rgba(234, 105, 98, 0.3)'}`,
                  letterSpacing: '0.3px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    backgroundColor: evoStatus?.active ? '#8EC07C' : '#EA6962',
                  }}
                />
                {evoStatus?.active ? 'ACTIVE • LOW POWER' : 'IDLE'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTriggerEvolution}
            disabled={triggeringEvo}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              backgroundColor: 'rgba(255,255,255,0.04)',
              color: 'var(--kuro-color-text-primary)',
              border: '1px solid var(--kuro-color-border)',
              borderRadius: radius.button,
              padding: '5px 11px',
              fontSize: 11,
              fontWeight: 600,
              cursor: triggeringEvo ? 'wait' : 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (!triggeringEvo) e.currentTarget.style.borderColor = 'var(--kuro-color-primary)'
            }}
            onMouseLeave={(e) => {
              if (!triggeringEvo) e.currentTarget.style.borderColor = 'var(--kuro-color-border)'
            }}
          >
            <AppIcon name="refresh-cw" size={11} className={triggeringEvo ? 'animate-spin' : ''} />
            <span>{triggeringEvo ? 'Analyzing...' : 'Trigger Cycle'}</span>
          </button>
        </div>

        {/* Telemetry Chips Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))',
            gap: 6,
            fontSize: 11,
            color: 'var(--kuro-color-text-muted)',
          }}
        >
          <div style={{ padding: '4px 8px', borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.04)' }}>
            Cycles: <strong style={{ color: 'var(--kuro-color-text-primary)' }}>{evoStatus?.cycle_count ?? 0}</strong>
          </div>
          <div style={{ padding: '4px 8px', borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.04)' }}>
            Runbooks: <strong style={{ color: '#EA6962' }}>{evoStatus?.learned_runbooks ?? 0}</strong>
          </div>
          <div style={{ padding: '4px 8px', borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.04)' }}>
            Thermal:{' '}
            <strong
              style={{
                color:
                  (evoStatus?.last_assessment?.temperature_celsius || 0) > 48
                    ? '#EA6962'
                    : (evoStatus?.last_assessment?.temperature_celsius || 0) > 40
                    ? '#E78A4E'
                    : '#8EC07C',
              }}
            >
              {evoStatus?.last_assessment?.temperature_celsius
                ? `${evoStatus.last_assessment.temperature_celsius.toFixed(1)}°C`
                : 'Optimal'}
            </strong>
          </div>
          <div style={{ padding: '4px 8px', borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 4 }}>
            Battery:{' '}
            <strong style={{ color: 'var(--kuro-color-text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              {evoStatus?.last_assessment?.battery_percentage ?? 99}%
              {evoStatus?.last_assessment?.is_charging && <AppIcon name="zap" size={11} style={{ color: 'var(--kuro-color-primary)' }} />}
            </strong>
          </div>
        </div>
      </div>

      {/* ─── 3. Quick-Filter Category Pills ─── */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          paddingBottom: 2,
          scrollbarWidth: 'none',
        }}
      >
        {categories.map((c) => {
          const isSelected = categoryFilter.toLowerCase() === c.toLowerCase()
          const catInfo = CATEGORY_LABELS[c]
          const count = c === 'all' ? memories.length : memories.filter((m) => m.category?.toLowerCase() === c.toLowerCase()).length
          const label = c === 'all' ? 'All' : catInfo?.label || c
          const pillColor = catInfo?.color || '#8EC07C'

          return (
            <button
              key={c}
              type="button"
              onClick={() => setCategoryFilter(c)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 16,
                fontSize: 11,
                fontWeight: isSelected ? 700 : 500,
                backgroundColor: isSelected ? `${pillColor}22` : 'var(--kuro-color-surface)',
                color: isSelected ? pillColor : 'var(--kuro-color-text-secondary)',
                border: `1px solid ${isSelected ? pillColor : 'var(--kuro-color-border)'}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {c !== 'all' && (
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    backgroundColor: pillColor,
                    display: 'inline-block',
                  }}
                />
              )}
              <span>{label}</span>
              <span
                style={{
                  fontSize: 9.5,
                  padding: '1px 4px',
                  borderRadius: 8,
                  backgroundColor: isSelected ? `${pillColor}33` : 'rgba(255,255,255,0.05)',
                  color: isSelected ? pillColor : 'var(--kuro-color-text-muted)',
                }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ─── 4. Search Bar ─── */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div style={{ position: 'absolute', left: 10, color: 'var(--kuro-color-text-muted)', display: 'flex' }}>
          <AppIcon name="search" size={13} />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search facts, server paths, or rules..."
          style={{
            width: '100%',
            backgroundColor: 'var(--kuro-color-surface)',
            border: '1px solid var(--kuro-color-border)',
            borderRadius: radius.input,
            padding: '7px 70px 7px 30px',
            color: 'var(--kuro-color-text-primary)',
            fontSize: 12,
            outline: 'none',
          }}
        />
        <div style={{ position: 'absolute', right: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--kuro-color-text-muted)',
                cursor: 'pointer',
                padding: 2,
                display: 'flex',
              }}
            >
              <AppIcon name="x" size={12} />
            </button>
          )}
          <span style={{ fontSize: 10.5, color: 'var(--kuro-color-text-muted)' }}>
            {filtered.length}/{memories.length}
          </span>
        </div>
      </div>

      {/* ─── 5. Add / Edit Popup Modal ─── */}
      {showAddForm && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) cancelForm()
          }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--kuro-color-surface)',
              border: '1px solid var(--kuro-color-border)',
              borderRadius: radius.card,
              width: '100%',
              maxWidth: 580,
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.06)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                borderBottom: '1px solid var(--kuro-color-border)',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: editingId ? 'rgba(231, 138, 78, 0.15)' : 'rgba(142, 192, 124, 0.15)',
                    border: `1px solid ${editingId ? 'rgba(231, 138, 78, 0.3)' : 'rgba(142, 192, 124, 0.3)'}`,
                    color: editingId ? '#E78A4E' : '#8EC07C',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <AppIcon name={editingId ? 'edit-3' : 'plus'} size={16} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                    {editingId ? 'Edit Knowledge Directive' : 'Add Knowledge Directive'}
                  </h4>
                  <div style={{ fontSize: 11, color: 'var(--kuro-color-text-muted)', marginTop: 2 }}>
                    {editingId
                      ? 'Modify how Kuro recalls this specific rule, layout path, or baseline'
                      : 'Teach Kuro persistent environment facts, host paths, or execution rules'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={cancelForm}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--kuro-color-border)',
                  borderRadius: 6,
                  color: 'var(--kuro-color-text-muted)',
                  cursor: 'pointer',
                  padding: '5px 7px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
                title="Close (Esc)"
              >
                <AppIcon name="x" size={14} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form
              onSubmit={handleFormSubmit}
              style={{
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                overflowY: 'auto',
              }}
            >
              {/* Directive Content Area */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
                    Directive Content & Knowledge Body
                  </label>
                  <span style={{ fontSize: 10.5, color: 'var(--kuro-color-text-muted)' }}>
                    {formContent.length} chars
                  </span>
                </div>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="e.g. 'Docker compose files are located at /home/ullash/homelab/compose and Immich photos are stored in /mnt/storage/photos.'"
                  rows={4}
                  required
                  autoFocus
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--kuro-color-surface-input)',
                    border: '1px solid var(--kuro-color-border)',
                    borderRadius: radius.input,
                    padding: '10px 12px',
                    color: 'var(--kuro-color-text-primary)',
                    fontSize: 12.5,
                    outline: 'none',
                    resize: 'vertical',
                    lineHeight: 1.5,
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s ease',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--kuro-color-primary)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--kuro-color-border)')}
                />
              </div>

              {/* Grid: Category & Priority Selection */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                {/* Category Picker */}
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--kuro-color-text-primary)', marginBottom: 6 }}>
                    Category Domain
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--kuro-color-surface-input)',
                      border: '1px solid var(--kuro-color-border)',
                      borderRadius: radius.input,
                      padding: '8px 10px',
                      color: 'var(--kuro-color-text-primary)',
                      fontSize: 12,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="runbook">Troubleshooting Runbook</option>
                    <option value="server_baseline">Server Baseline & Telemetry</option>
                    <option value="user_habit">Learned User Habit</option>
                    <option value="server_layout">Server Layout & Host Paths</option>
                    <option value="instruction">Learned Instruction</option>
                    <option value="preference">User Preference</option>
                    <option value="fact">Environment Fact</option>
                    <option value="general">General Knowledge</option>
                  </select>
                  {CATEGORY_LABELS[formCategory] && (
                    <div style={{ fontSize: 10.5, color: CATEGORY_LABELS[formCategory].color, marginTop: 4, opacity: 0.9 }}>
                      {CATEGORY_LABELS[formCategory].desc}
                    </div>
                  )}
                </div>

                {/* Priority Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--kuro-color-text-primary)', marginBottom: 6 }}>
                    Recall Priority (Importance)
                  </label>
                  <select
                    value={formImportance}
                    onChange={(e) => setFormImportance(parseInt(e.target.value) || 3)}
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--kuro-color-surface-input)',
                      border: '1px solid var(--kuro-color-border)',
                      borderRadius: radius.input,
                      padding: '8px 10px',
                      color: 'var(--kuro-color-text-primary)',
                      fontSize: 12,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="5">Priority 5 - Critical (Top Context Injection)</option>
                    <option value="4">Priority 4 - High (Server Paths & Key Workflows)</option>
                    <option value="3">Priority 3 - Normal (General Preferences & Facts)</option>
                    <option value="2">Priority 2 - Low (Supplementary Context)</option>
                    <option value="1">Priority 1 - Background Note</option>
                  </select>
                  <div style={{ fontSize: 10.5, color: 'var(--kuro-color-text-muted)', marginTop: 4 }}>
                    Higher priority items are guaranteed priority injection in LLM prompts.
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: 10,
                  marginTop: 6,
                  paddingTop: 12,
                  borderTop: '1px solid var(--kuro-color-border)',
                }}
              >
                <button
                  type="button"
                  onClick={cancelForm}
                  style={{
                    backgroundColor: 'transparent',
                    color: 'var(--kuro-color-text-secondary)',
                    border: '1px solid var(--kuro-color-border)',
                    borderRadius: radius.button,
                    padding: '8px 16px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !formContent.trim()}
                  style={{
                    backgroundColor: 'var(--kuro-color-primary)',
                    color: 'var(--kuro-color-background)',
                    border: 'none',
                    borderRadius: radius.button,
                    padding: '8px 20px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: submitting || !formContent.trim() ? 'not-allowed' : 'pointer',
                    opacity: submitting || !formContent.trim() ? 0.6 : 1,
                    boxShadow: '0 2px 8px rgba(142, 192, 124, 0.3)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {submitting ? 'Saving...' : editingId ? 'Update Directive' : 'Save Directive'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 6. Knowledge Directives Responsive Cards / Table ─── */}
      {filtered.length === 0 ? (
        <div
          style={{
            backgroundColor: 'var(--kuro-color-surface)',
            border: '1px dashed var(--kuro-color-border)',
            borderRadius: radius.card,
            padding: 32,
            textAlign: 'center',
            color: 'var(--kuro-color-text-muted)',
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>No Knowledge Directives Found</div>
          <div style={{ fontSize: 11.5, marginTop: 4, maxWidth: 360, margin: '4px auto 0' }}>
            {search ? 'No directives matched your query.' : 'Kuro automatically learns server layout, user preferences, and baseline metrics as you chat.'}
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {filtered.map((item) => {
            const catInfo = CATEGORY_LABELS[item.category] || CATEGORY_LABELS.general

            return (
              <div
                key={item.id}
                style={{
                  backgroundColor: 'var(--kuro-color-surface)',
                  border: '1px solid var(--kuro-color-border)',
                  borderRadius: radius.card,
                  padding: '11px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  transition: 'border-color 0.15s ease',
                }}
              >
                {/* Top Meta Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: 5,
                        backgroundColor: `${catInfo.color}15`,
                        color: catInfo.color,
                        border: `1px solid ${catInfo.color}30`,
                        display: 'inline-block',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {catInfo.label}
                    </span>

                    <span style={{ fontSize: 10.5, color: 'var(--kuro-color-primary)', fontWeight: 600 }}>
                      P{item.importance || 1}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {(item.access_count || 0) > 0 && (
                      <span style={{ fontSize: 10, color: 'var(--kuro-color-text-muted)' }}>
                        Recalls: {item.access_count}
                      </span>
                    )}

                    <div style={{ display: 'inline-flex', gap: 4 }}>
                      <button
                        onClick={() => startEdit(item)}
                        title="Edit Directive"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--kuro-color-text-secondary)',
                          cursor: 'pointer',
                          padding: '3px 5px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          borderRadius: 4,
                        }}
                      >
                        <AppIcon name="edit-3" size={13} />
                      </button>
                      <button
                        onClick={() => onDeleteMemory(item.id)}
                        title="Delete Directive"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--kuro-color-danger)',
                          cursor: 'pointer',
                          padding: '3px 5px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          borderRadius: 4,
                        }}
                      >
                        <AppIcon name="trash-2" size={13} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div style={{ fontSize: 12, color: 'var(--kuro-color-text-primary)', lineHeight: 1.5, wordBreak: 'break-word' }}>
                  {item.content}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

