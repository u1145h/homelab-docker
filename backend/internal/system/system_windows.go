package system

import (
	"os"
	"runtime"
	"time"
)

func Collect() (*Info, error) {
	host, _ := os.Hostname()
	return &Info{
		Hostname: host,
		Kernel:   "windows",
		OS:       "windows",
		Arch:     runtime.GOARCH,
		Go:       runtime.Version(),
		Uptime:   0,
		BootTime: time.Now(),
		LoadAvg:  []float64{0, 0, 0},
	}, nil
}
