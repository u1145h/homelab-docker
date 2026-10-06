import DashboardIcon from "@mui/icons-material/Dashboard"
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart"
import HistoryIcon from "@mui/icons-material/History"
import BatteryChargingFullIcon from "@mui/icons-material/BatteryChargingFull"
import DeviceThermostatIcon from "@mui/icons-material/DeviceThermostat"
import AdbIcon from "@mui/icons-material/Adb"
import FolderIcon from "@mui/icons-material/Folder"
import TerminalIcon from "@mui/icons-material/Terminal"
import PeopleIcon from "@mui/icons-material/People"
import SecurityIcon from "@mui/icons-material/Security"
import SettingsIcon from "@mui/icons-material/Settings"
import SmartToyIcon from "@mui/icons-material/SmartToy"
import PsychologyIcon from "@mui/icons-material/Psychology"
import DeviceHubIcon from "@mui/icons-material/DeviceHub"
import DnsIcon from "@mui/icons-material/Dns"
import type { NavItem } from "./types"

export const navigation: NavItem[] = [
  // ── Monitoring ──
  { label: "Dashboard", path: "/", icon: DashboardIcon, group: "monitoring" },
  { label: "Memory", path: "/memory", icon: MonitorHeartIcon, group: "monitoring" },
  { label: "History", path: "/history", icon: HistoryIcon, group: "monitoring" },
  { label: "Battery", path: "/battery", icon: BatteryChargingFullIcon, group: "monitoring" },
  { label: "Thermal", path: "/thermal", icon: DeviceThermostatIcon, group: "monitoring" },

  // ── Assistant ──
  { label: "Model", path: "/assistant/model", icon: SmartToyIcon, group: "assistant" },
  { label: "Memories", path: "/assistant/memories", icon: PsychologyIcon, group: "assistant" },
  { label: "Clients", path: "/assistant/clients", icon: DeviceHubIcon, group: "assistant" },
  { label: "Integration", path: "/assistant/integration", icon: DnsIcon, group: "assistant" },

  // ── Management ──
  { label: "Docker", path: "/docker", icon: AdbIcon, group: "management" },
  { label: "Files", path: "/files", icon: FolderIcon, group: "management" },
  { label: "Terminal", path: "/terminal", icon: TerminalIcon, group: "management" },

  // ── System ──
  { label: "Users", path: "/users", icon: PeopleIcon, group: "system" },
  { label: "Audit", path: "/audit", icon: SecurityIcon, group: "system" },
  { label: "Settings", path: "/settings", icon: SettingsIcon, group: "system" },
]
