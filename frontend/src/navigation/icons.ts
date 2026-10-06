import DashboardIcon from "@mui/icons-material/Dashboard"
import MemoryIcon from "@mui/icons-material/Memory"
import StorageIcon from "@mui/icons-material/Storage"
import LanIcon from "@mui/icons-material/Lan"
import BatteryChargingFullIcon from "@mui/icons-material/BatteryChargingFull"
import DeviceThermostatIcon from "@mui/icons-material/DeviceThermostat"
import AdbIcon from "@mui/icons-material/Adb"
import PublicIcon from "@mui/icons-material/Public"
import FolderIcon from "@mui/icons-material/Folder"
import TerminalIcon from "@mui/icons-material/Terminal"
import SettingsIcon from "@mui/icons-material/Settings"
import HistoryIcon from "@mui/icons-material/History"
import PeopleIcon from "@mui/icons-material/People"
import SecurityIcon from "@mui/icons-material/Security"
import type { SvgIconComponent } from "@mui/icons-material"

export const iconMap: Record<string, SvgIconComponent> = {
  dashboard: DashboardIcon,
  memory: MemoryIcon,
  storage: StorageIcon,
  network: LanIcon,
  battery: BatteryChargingFullIcon,
  thermal: DeviceThermostatIcon,
  docker: AdbIcon,
  tailscale: PublicIcon,
  files: FolderIcon,
  terminal: TerminalIcon,
  settings: SettingsIcon,
  history: HistoryIcon,
  users: PeopleIcon,
  audit: SecurityIcon,
}

export function getIcon(name: string): SvgIconComponent {
  return iconMap[name] ?? DashboardIcon
}
