import { Drawer, IconButton } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { KeyValueTable, StatusBadge } from '@/components/ui/display'
import { Heading, Text } from '@/components/ui/typography'
import type { AuditEntry } from '../types'
import { formatTimestamp, getActionLabel } from '../utils/audit'
import type { KeyValuePair } from '@/components/ui/display'

interface AuditDetailsDrawerProps {
  entry: AuditEntry | null
  onClose: () => void
}

function statusToStatusType(status: string): 'healthy' | 'danger' {
  return status === 'success' ? 'healthy' : 'danger'
}

export default function AuditDetailsDrawer({ entry, onClose }: AuditDetailsDrawerProps) {
  if (!entry) return null

  const baseEntries: KeyValuePair[] = [
    { label: 'ID', value: entry.id },
    { label: 'Timestamp', value: formatTimestamp(entry.timestamp) },
    { label: 'Actor', value: entry.actor },
    { label: 'Action', value: getActionLabel(entry.action) },
    { label: 'Target', value: entry.target || '\u2014' },
    {
      label: 'Status',
      value: <StatusBadge status={statusToStatusType(entry.status)} label={entry.status} dotOnly />,
    },
  ]

  if (entry.message) {
    baseEntries.push({ label: 'Message', value: entry.message })
  }

  const metadataEntries = entry.metadata ? Object.entries(entry.metadata) : []

  return (
    <Drawer anchor="right" open={!!entry} onClose={onClose}>
      <div style={{ width: 360, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Heading level={4}>Event Details</Heading>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <StatusBadge status="info" label={getActionLabel(entry.action)} />
          <StatusBadge status={statusToStatusType(entry.status)} label={entry.status} />
        </div>

        <KeyValueTable entries={baseEntries} />

        {metadataEntries.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Text weight={600}>Metadata</Text>
            <KeyValueTable
              entries={metadataEntries.map(([key, val]) => ({
                label: key,
                value: typeof val === 'object' ? JSON.stringify(val) : String(val),
              }))}
            />
          </div>
        )}
      </div>
    </Drawer>
  )
}
