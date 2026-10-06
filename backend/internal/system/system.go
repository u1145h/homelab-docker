package system

import (
	"time"
)

type Info struct {
	Hostname string    `json:"hostname"`
	Kernel   string    `json:"kernel"`
	OS       string    `json:"os"`
	Arch     string    `json:"arch"`
	Go       string    `json:"go"`
	Uptime   uint64    `json:"uptime"`
	BootTime time.Time `json:"boot_time"`
	LoadAvg  []float64 `json:"load_avg"`
}
