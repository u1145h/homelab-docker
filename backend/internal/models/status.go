package models

type CPUStatus struct {
	Usage float64 `json:"usage"`
	Cores int     `json:"cores"`
}

type MemoryStatus struct {
	Used       uint64  `json:"used"`
	Total      uint64  `json:"total"`
	Percentage float64 `json:"percentage"`
}

type StorageStatus struct {
	Used       uint64  `json:"used"`
	Total      uint64  `json:"total"`
	Percentage float64 `json:"percentage"`
}

type BatteryStatus struct {
	Present    bool    `json:"present"`
	Percentage float64 `json:"percentage"`
	Charging   bool    `json:"charging"`
}

type ThermalStatus struct {
	Temperature float64 `json:"temperature"`
}

type NetworkStatus struct {
	RXBytes uint64 `json:"rx_bytes"`
	TXBytes uint64 `json:"tx_bytes"`
}

type DockerStatus struct {
	Installed bool `json:"installed"`
	Running   int  `json:"running"`
}

type TailscaleStatus struct {
	Connected bool   `json:"connected"`
	IPAddress string `json:"ip_address"`
}

type UptimeStatus struct {
	Seconds uint64 `json:"seconds"`
}

type StatusResponse struct {
	CPU       CPUStatus       `json:"cpu"`
	Memory    MemoryStatus    `json:"memory"`
	Storage   StorageStatus   `json:"storage"`
	Battery   BatteryStatus   `json:"battery"`
	Thermal   ThermalStatus   `json:"thermal"`
	Network   NetworkStatus   `json:"network"`
	Docker    DockerStatus    `json:"docker"`
	Tailscale TailscaleStatus `json:"tailscale"`
	Uptime    UptimeStatus    `json:"uptime"`
	Timestamp int64           `json:"timestamp"`
}
