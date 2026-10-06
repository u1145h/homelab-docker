import Chip from "@mui/material/Chip"
import { getContainerStateColor, getContainerStateLabel } from "../utils/docker"

interface StatusBadgeProps {
  state: string
}

export default function StatusBadge({ state }: StatusBadgeProps) {
  return (
    <Chip
      size="small"
      color={getContainerStateColor(state)}
      label={getContainerStateLabel(state)}
    />
  )
}
