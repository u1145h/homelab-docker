package memory

import (
	"bufio"
	"os"
	"strconv"
	"strings"

	"github.com/ullashroy/poco-server/backend/internal/system"
)

type Info struct {
	Total     uint64  `json:"total"`
	Free      uint64  `json:"free"`
	Available uint64  `json:"available"`
	Used      uint64  `json:"used"`
	Usage     float64 `json:"usage_percent"`

	Cached       uint64  `json:"cached"`
	Buffers      uint64  `json:"buffers"`
	Shared       uint64  `json:"shared"`
	SwapTotal    uint64  `json:"swap_total"`
	SwapFree     uint64  `json:"swap_free"`
	SwapUsed     uint64  `json:"swap_used"`
	SwapUsage    float64 `json:"swap_usage_percent"`
	SReclaimable uint64  `json:"sreclaimable"`
	SUnreclaim   uint64  `json:"sunreclaim"`
	Slab         uint64  `json:"slab"`
	PageTables   uint64  `json:"page_tables"`
	KernelStack  uint64  `json:"kernel_stack"`
	Dirty        uint64  `json:"dirty"`
	Writeback    uint64  `json:"writeback"`
	Mapped       uint64  `json:"mapped"`
	Active       uint64  `json:"active"`
	Inactive     uint64  `json:"inactive"`
}

func Collect() (*Info, error) {
	file, err := os.Open(system.ProcPath("meminfo"))
	if err != nil {
		return nil, err
	}
	defer file.Close()

	values := map[string]uint64{}

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 2 {
			continue
		}

		key := strings.TrimSuffix(fields[0], ":")

		value, err := strconv.ParseUint(fields[1], 10, 64)
		if err != nil {
			continue
		}

		// Convert from kB to bytes
		values[key] = value * 1024
	}

	total := values["MemTotal"]
	available := values["MemAvailable"]
	free := values["MemFree"]
	used := total - available

	var usage float64
	if total > 0 {
		usage = (float64(used) / float64(total)) * 100
	}

	swapTotal := values["SwapTotal"]
	swapFree := values["SwapFree"]
	swapUsed := swapTotal - swapFree
	var swapUsage float64
	if swapTotal > 0 {
		swapUsage = (float64(swapUsed) / float64(swapTotal)) * 100
	}

	return &Info{
		Total:        total,
		Free:         free,
		Available:    available,
		Used:         used,
		Usage:        usage,
		Cached:       values["Cached"],
		Buffers:      values["Buffers"],
		Shared:       values["Shmem"],
		SwapTotal:    swapTotal,
		SwapFree:     swapFree,
		SwapUsed:     swapUsed,
		SwapUsage:    swapUsage,
		SReclaimable: values["SReclaimable"],
		SUnreclaim:   values["SUnreclaim"],
		Slab:         values["Slab"],
		PageTables:   values["PageTables"],
		KernelStack:  values["KernelStack"],
		Dirty:        values["Dirty"],
		Writeback:    values["Writeback"],
		Mapped:       values["Mapped"],
		Active:       values["Active"],
		Inactive:     values["Inactive"],
	}, nil
}
