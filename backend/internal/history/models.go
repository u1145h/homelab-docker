package history

import "time"

type CPUStats struct {
	UsagePercent float64 `json:"usagePercent,omitempty"`
	LogicalCores int     `json:"logicalCores,omitempty"`
	FrequencyMHz float64 `json:"frequencyMHz,omitempty"`
}

type MemoryStats struct {
	Total        int64   `json:"total,omitempty"`
	Used         int64   `json:"used,omitempty"`
	Available    int64   `json:"available,omitempty"`
	UsagePercent float64 `json:"usagePercent,omitempty"`
}

type StorageStats struct {
	Total        int64   `json:"total,omitempty"`
	Used         int64   `json:"used,omitempty"`
	Available    int64   `json:"available,omitempty"`
	UsagePercent float64 `json:"usagePercent,omitempty"`
}

type NetworkStats struct {
	RXBytes int64 `json:"rxBytes,omitempty"`
	TXBytes int64 `json:"txBytes,omitempty"`
}

type BatteryStats struct {
	Present   bool    `json:"present,omitempty"`
	Capacity  float64 `json:"capacity,omitempty"`
	Status    string  `json:"status,omitempty"`
	PowerMW   int     `json:"power_mw,omitempty"`
	VoltageMV int     `json:"voltage_mv,omitempty"`
}

type ThermalStats struct {
	TemperatureMax float64 `json:"temperatureMax,omitempty"`
}

type Sample struct {
	Timestamp time.Time    `json:"timestamp"`
	Hostname  string       `json:"hostname"`
	CPU       CPUStats     `json:"cpu"`
	Memory    MemoryStats  `json:"memory"`
	Storage   StorageStats `json:"storage"`
	Network   NetworkStats `json:"network"`
	Battery   BatteryStats `json:"battery"`
	Thermal   ThermalStats `json:"thermal"`
}

type MetricType string

const (
	MetricCPU     MetricType = "cpu"
	MetricMemory  MetricType = "memory"
	MetricStorage MetricType = "storage"
	MetricNetwork MetricType = "network"
	MetricBattery MetricType = "battery"
	MetricThermal MetricType = "thermal"
)

var ValidMetrics = map[MetricType]bool{
	MetricCPU:     true,
	MetricMemory:  true,
	MetricStorage: true,
	MetricNetwork: true,
	MetricBattery: true,
	MetricThermal: true,
}

var ValidResolutions = map[int]bool{
	30:    true,
	60:    true,
	300:   true,
	900:   true,
	1800:  true,
	3600:  true,
	21600: true,
	43200: true,
	86400: true,
}

type LatestResponse struct {
	Sample *Sample `json:"sample"`
}

type RangeResponse struct {
	Samples    []Sample `json:"samples"`
	Resolution int      `json:"resolution"`
	Start      string   `json:"start"`
	End        string   `json:"end"`
}
