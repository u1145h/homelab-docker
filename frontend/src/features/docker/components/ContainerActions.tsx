import { Flex } from '@/components/ui/layout'
import { Button } from '@/components/ui/actions'

interface ContainerActionsProps {
  state: string
  busy: boolean
  onStart: () => void
  onStop: () => void
  onRestart: () => void
}

export default function ContainerActions({ state, busy, onStart, onStop, onRestart }: ContainerActionsProps) {
  const isRunning = state === 'running'

  return (
    <Flex gap={8}>
      {!isRunning && (
        <Button variant="secondary" size="small" disabled={busy} onClick={onStart}>
          Start
        </Button>
      )}
      {isRunning && (
        <Button variant="secondary" size="small" disabled={busy} onClick={onStop}>
          Stop
        </Button>
      )}
      <Button variant="secondary" size="small" disabled={busy} onClick={onRestart}>
        Restart
      </Button>
    </Flex>
  )
}
