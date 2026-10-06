export interface SystemInfo {
  hostname: string;
  kernel: string;
  os: string;
  arch: string;
  go: string;
  uptime: number;
  boot_time: string;
  load_avg: number[];
}

export interface CPUCore {
  id: string;
  usage_percent: number;
  frequency_mhz: number;
}

export interface CPUInterrupts {
  context_switches: number;
  interrupts: number;
  softirqs: number;
}

export interface CPUCache {
  l1: string;
  l2: string;
  l3: string;
}

export interface CPUInfo {
  model: string;
  architecture: string;
  logical_cores: number;
  physical_cores: number;
  frequency_mhz: number;
  usage_percent: number;
  cores: CPUCore[];
  interrupts: CPUInterrupts;
  cache: CPUCache;
  governor: string;
}

export interface MemoryInfo {
  total: number;
  free: number;
  available: number;
  used: number;
  usage_percent: number;
  cached: number;
  buffers: number;
  shared: number;
  swap_total: number;
  swap_free: number;
  swap_used: number;
  swap_usage_percent: number;
  sreclaimable: number;
  sunreclaim: number;
  slab: number;
  page_tables: number;
  kernel_stack: number;
  dirty: number;
  writeback: number;
  mapped: number;
  active: number;
  inactive: number;
}

export interface StorageMount {
  device: string;
  mount: string;
  filesystem: string;
  total: number;
  used: number;
  available: number;
  usage_percent: number;
  read_only: boolean;
  type: string;
}

export interface StorageSummary {
  total_capacity: number;
  used: number;
  free: number;
  physical_volumes: number;
}

export interface StorageCapacityMix {
  name: string;
  total: number;
  used: number;
  color: string;
}

export interface StorageIOThroughput {
  read_mbps: number;
  write_mbps: number;
  iops: number;
  queue_depth: number;
  await: number;
}

export interface StorageBlockDevice {
  device: string;
  model: string;
  size: number;
  temp: string;
  read: number;
  write: number;
  health: string;
}

export interface StorageFilesystemCache {
  cached: number;
  buffers: number;
  dirty: number;
  hit_ratio: string;
  swap_used: number;
  swap_total: number;
  inodes: string;
  scheduler: string;
}

export interface StorageInfo {
  summary: StorageSummary;
  capacity_mix: StorageCapacityMix[];
  io_throughput: StorageIOThroughput;
  mounts: StorageMount[];
  block_devices: StorageBlockDevice[];
  filesystem_cache: StorageFilesystemCache;
}

export interface SubsystemPower {
  name: string;
  power_mw: number;
  percent: number;
}

export interface CellInfo {
  id: string;
  voltage_v: number;
}

export interface PowerEvent {
  event: string;
  time: string;
  details: string;
}

export interface PowerRail {
  name: string;
  voltage_v: number;
  current_a: number;
  power_w: number;
  state: string;
}

export interface BatteryInfo {
  present: boolean;
  status: string;
  capacity: number;
  health: string;
  technology: string;
  voltage_mv: number;
  current_ma: number;
  power_mw: number;
  temperature_c: number;
  
  cycle_count: number;
  design_capacity_wh: number;
  full_capacity_wh: number;
  remaining_capacity_wh: number;
  wear_level_percent: number;
  time_to_full_min: number;
  runtime_left_min: number;

  energy_consumed_kwh: number;
  energy_from_grid_kwh: number;
  energy_from_battery_kwh: number;
  estimated_cost: number;

  subsystems: SubsystemPower[];

  cells: CellInfo[];
  cell_delta_mv: number;
  balancing: string;
  bms_state: string;

  power_source: string;
  adapter_voltage_v: number;
  adapter_current_a: number;
  adapter_max_power_w: number;
  input_voltage_v: number;
  ups_load_percent: number;
  ups_runtime_min: number;
  adapter_temp_c: number;
  soc_power_w: number;
  outages_24h: number;
  power_events: PowerEvent[];

  power_rails: PowerRail[];
}

export interface ThermalTripPoint {
  type: string;
  temperature_c: number;
}

export interface ThermalZone {
  name: string;
  temperature_c: number;
  policy: string;
  trips: ThermalTripPoint[];
}

export interface CoolingDevice {
  name: string;
  type: string;
  cur_state: number;
  max_state: number;
}

export interface ThermalInfo {
  zones: ThermalZone[];
  cooling_devices: CoolingDevice[];
}

export interface NetworkInterface {
  name: string;
  up: boolean;
  mtu: number;
  mac: string;
  addresses: string[] | null;
  rx_bytes: number;
  tx_bytes: number;
  ssid: string;
}

export interface PublicIPInfo {
  ip: string;
  location: string;
  asn: string;
}

export interface LinkQuality {
  signal: number;
  latency: number;
  jitter: number;
  loss: number;
}

export interface WifiDetails {
  ssid: string;
  security: string;
  band: string;
  channel: number;
  link_speed: number;
  rssi: number;
}

export interface LogEvent {
  time: string;
  type: string;
  iface: string;
  message: string;
}

export interface SpeedTestResult {
  when: string;
  down: number;
  up: number;
  ping: number;
  server: string;
  link: string;
}

export interface NetworkInfo {
  interfaces: NetworkInterface[];
  public_ip: PublicIPInfo;
  gateway: string;
  wifi_details: WifiDetails;
  link_quality: LinkQuality;
  logs: LogEvent[];
  speed_test_history: SpeedTestResult[];
}

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
}

export interface DockerInfo {
  containers: DockerContainer[];
}

export interface TailscaleSelf {
  hostname: string;
  ip: string;
  online: boolean;
}

export interface TailscalePeer {
  hostname: string;
  ip: string;
  online: boolean;
}

export interface TailscaleInfo {
  version: string;
  backendState: string;
  self: TailscaleSelf;
  peers: TailscalePeer[];
}

export interface Process {
  pid: string;
  command: string;
  user: string;
  cpu: number;
  memory: number;
  threads: number;
  time: string;
}

export interface ProcessesInfo {
  top: Process[];
  top_memory: Process[];
}

export interface StatusResponse {
  system: SystemInfo;
  cpu: CPUInfo;
  memory: MemoryInfo;
  storage: StorageInfo;
  battery: BatteryInfo;
  thermal: ThermalInfo;
  network: NetworkInfo;
  docker: DockerInfo;
  tailscale: TailscaleInfo;
  processes: ProcessesInfo;
}
