import Grid from "@mui/material/Grid"
import MemoryIcon from "@mui/icons-material/Memory"
import StorageIcon from "@mui/icons-material/Storage"
import BatteryChargingFullIcon from "@mui/icons-material/BatteryChargingFull"
import DeviceThermostatIcon from "@mui/icons-material/DeviceThermostat"
import AdbIcon from "@mui/icons-material/Adb"
import LanIcon from "@mui/icons-material/Lan"
import PublicIcon from "@mui/icons-material/Public"
import StatusCard from "./StatusCard"
import {
  cpuStatusColor,
  memoryStatusColor,
  storageStatusColor,
  temperatureStatusColor,
  dockerStatusColor,
  networkStatusColor,
  tailscaleStatusColor,
  batteryStatusColor,
} from "../utils/statusColor"
import type { DashboardData } from "../types"

interface StatusCardGridProps {
  data: DashboardData
}

export default function StatusCardGrid({ data }: StatusCardGridProps) {
  const { stats, status } = data
  const runningContainers = parseInt(stats.dockerValue, 10)

  return (
    <Grid container spacing={2.5}>
      <Grid size={{ xs: 12, md: 6, lg: 3 }}>
        <StatusCard
          icon={<MemoryIcon fontSize="inherit" />}
          label="CPU"
          value={stats.cpuValue}
          secondary={stats.cpuSubtitle}
          color={cpuStatusColor(status.cpu.usage_percent)}
          progress={status.cpu.usage_percent}
        />
      </Grid>

      <Grid size={{ xs: 12, md: 6, lg: 3 }}>
        <StatusCard
          icon={<MemoryIcon fontSize="inherit" />}
          label="Memory"
          value={stats.memoryValue}
          secondary={stats.memorySubtitle}
          color={memoryStatusColor(status.memory.usage_percent)}
          progress={status.memory.usage_percent}
        />
      </Grid>

      <Grid size={{ xs: 12, md: 6, lg: 3 }}>
        <StatusCard
          icon={<StorageIcon fontSize="inherit" />}
          label="Storage"
          value={stats.storageValue}
          secondary={stats.storageSubtitle}
          color={storageStatusColor(status.storage.mounts[0]?.usage_percent ?? 0)}
          progress={status.storage.mounts[0]?.usage_percent ?? 0}
        />
      </Grid>

      <Grid size={{ xs: 12, md: 6, lg: 3 }}>
        <StatusCard
          icon={<BatteryChargingFullIcon fontSize="inherit" />}
          label="Battery"
          value={stats.batteryValue}
          secondary={stats.batterySubtitle}
          color={batteryStatusColor(status.battery.capacity, status.battery.present)}
          progress={status.battery.present ? status.battery.capacity : undefined}
        />
      </Grid>

      <Grid size={{ xs: 12, md: 6, lg: 3 }}>
        <StatusCard
          icon={<DeviceThermostatIcon fontSize="inherit" />}
          label="Temperature"
          value={stats.temperatureValue}
          secondary={stats.temperatureSubtitle}
          color={temperatureStatusColor(
            status.thermal.zones.length > 0
              ? Math.max(...status.thermal.zones.map((z) => z.temperature_c))
              : 0,
          )}
        />
      </Grid>

      <Grid size={{ xs: 12, md: 6, lg: 3 }}>
        <StatusCard
          icon={<AdbIcon fontSize="inherit" />}
          label="Docker"
          value={stats.dockerValue}
          secondary={stats.dockerSubtitle}
          color={dockerStatusColor(runningContainers, status.docker.containers.length)}
        />
      </Grid>

      <Grid size={{ xs: 12, md: 6, lg: 3 }}>
        <StatusCard
          icon={<LanIcon fontSize="inherit" />}
          label="Network"
          value={stats.networkValue}
          secondary={stats.networkSubtitle}
          color={networkStatusColor(
            status.network.interfaces.some((iface) => iface.up),
          )}
        />
      </Grid>

      <Grid size={{ xs: 12, md: 6, lg: 3 }}>
        <StatusCard
          icon={<PublicIcon fontSize="inherit" />}
          label="Tailscale"
          value={stats.tailscaleValue}
          secondary={stats.tailscaleSubtitle}
          color={tailscaleStatusColor(status.tailscale.backendState)}
        />
      </Grid>
    </Grid>
  )
}
