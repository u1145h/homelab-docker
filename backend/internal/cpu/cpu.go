package cpu

import (
	"bufio"
	"fmt"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"

	"github.com/ullashroy/poco-server/backend/internal/system"
)

type Core struct {
	ID           string  `json:"id"`
	UsagePercent float64 `json:"usage_percent"`
	FrequencyMHz int     `json:"frequency_mhz"`
}

type Interrupts struct {
	ContextSwitches uint64 `json:"context_switches"`
	Interrupts      uint64 `json:"interrupts"`
	SoftIRQs        uint64 `json:"softirqs"`
}

type Cache struct {
	L1 string `json:"l1"`
	L2 string `json:"l2"`
	L3 string `json:"l3"`
}

type Info struct {
	Model         string     `json:"model"`
	Architecture  string     `json:"architecture"`
	LogicalCores  int        `json:"logical_cores"`
	PhysicalCores int        `json:"physical_cores"`
	FrequencyMHz  int        `json:"frequency_mhz"`
	UsagePercent  float64    `json:"usage_percent"`
	Cores         []Core     `json:"cores"`
	Interrupts    Interrupts `json:"interrupts"`
	Cache         Cache      `json:"cache"`
	Governor      string     `json:"governor"`
}

var (
	mu        sync.Mutex
	prevTimes map[string][2]uint64 // idle, total
)

func init() {
	prevTimes = make(map[string][2]uint64)
}

func Collect() (*Info, error) {
	model, physical, fallbackFreq := cpuInfo()

	times, ints, err := parseProcStat()
	if err != nil {
		return nil, err
	}

	mu.Lock()
	defer mu.Unlock()

	var totalUsage float64
	var cores []Core

	for name, timePair := range times {
		idle := timePair[0]
		total := timePair[1]

		var usage float64
		if prev, ok := prevTimes[name]; ok {
			totalDelta := total - prev[1]
			idleDelta := idle - prev[0]

			if totalDelta > 0 {
				usage = float64(totalDelta-idleDelta) / float64(totalDelta) * 100
			}
		}

		prevTimes[name] = timePair

		if name == "cpu" {
			totalUsage = usage
		} else if strings.HasPrefix(name, "cpu") {
			// Extract core ID
			idStr := strings.TrimPrefix(name, "cpu")
			freq := 0
			// Attempt to read frequency - try standard scaling_cur_freq first, then cpuinfo_cur_freq
			freqFile := system.SysPath(fmt.Sprintf("devices/system/cpu/cpu%s/cpufreq/scaling_cur_freq", idStr))
			if data, err := os.ReadFile(freqFile); err == nil {
				if v, err := strconv.Atoi(strings.TrimSpace(string(data))); err == nil {
					freq = v / 1000
				}
			} else {
				freqFile = system.SysPath(fmt.Sprintf("devices/system/cpu/cpu%s/cpufreq/cpuinfo_cur_freq", idStr))
				if data, err := os.ReadFile(freqFile); err == nil {
					if v, err := strconv.Atoi(strings.TrimSpace(string(data))); err == nil {
						freq = v / 1000
					}
				}
			}

			// If sysfs didn't provide frequency, fall back to cpuinfo
			if freq == 0 {
				freq = fallbackFreq
			}

			cores = append(cores, Core{
				ID:           idStr,
				UsagePercent: usage,
				FrequencyMHz: freq,
			})
		}
	}

	freq := 0
	if len(cores) > 0 {
		freq = cores[0].FrequencyMHz
	}
	if freq == 0 {
		freq = fallbackFreq
	}

	return &Info{
		Model:         model,
		Architecture:  runtime.GOARCH,
		LogicalCores:  runtime.NumCPU(),
		PhysicalCores: physical,
		FrequencyMHz:  freq,
		UsagePercent:  totalUsage,
		Cores:         cores,
		Interrupts:    ints,
		Cache:         readCache(),
		Governor:      readGovernor(),
	}, nil
}

func parseProcStat() (map[string][2]uint64, Interrupts, error) {
	times := make(map[string][2]uint64)
	var ints Interrupts

	f, err := os.Open(system.ProcPath("stat"))
	if err != nil {
		return times, ints, err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) == 0 {
			continue
		}

		if strings.HasPrefix(fields[0], "cpu") {
			var idle, total uint64
			for i := 1; i < len(fields); i++ {
				v, _ := strconv.ParseUint(fields[i], 10, 64)
				total += v
				if i == 4 { // index 4 is idle time
					idle = v
				}
			}
			times[fields[0]] = [2]uint64{idle, total}
		} else if fields[0] == "ctxt" {
			ints.ContextSwitches, _ = strconv.ParseUint(fields[1], 10, 64)
		} else if fields[0] == "intr" {
			ints.Interrupts, _ = strconv.ParseUint(fields[1], 10, 64)
		} else if fields[0] == "softirq" {
			ints.SoftIRQs, _ = strconv.ParseUint(fields[1], 10, 64)
		}
	}

	return times, ints, nil
}

func cpuInfo() (string, int, int) {
	f, err := os.Open(system.ProcPath("cpuinfo"))
	if err != nil {
		return "Unknown", runtime.NumCPU(), 0
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)

	model := ""
	physical := runtime.NumCPU()
	fallbackFreq := 0

	for scanner.Scan() {
		line := scanner.Text()

		if strings.HasPrefix(line, "Hardware") {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				model = strings.TrimSpace(parts[1])
			}
		}

		if strings.HasPrefix(line, "model name") || strings.HasPrefix(line, "Processor") {
			if model == "" {
				parts := strings.SplitN(line, ":", 2)
				if len(parts) == 2 {
					model = strings.TrimSpace(parts[1])
				}
			}
		}

		if fallbackFreq == 0 && (strings.HasPrefix(line, "cpu MHz") || strings.HasPrefix(line, "BogoMIPS")) {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				if fVal, err := strconv.ParseFloat(strings.TrimSpace(parts[1]), 64); err == nil && fVal > 0 {
					fallbackFreq = int(fVal)
				}
			}
		}
	}

	// Try extracting GHz from model string if fallbackFreq is still 0 (e.g. "Intel i5-10300H CPU @ 2.50GHz")
	if fallbackFreq == 0 && strings.Contains(model, "GHz") {
		idx := strings.Index(model, "GHz")
		start := idx - 1
		for start >= 0 && (model[start] == '.' || (model[start] >= '0' && model[start] <= '9')) {
			start--
		}
		if ghzVal, err := strconv.ParseFloat(strings.TrimSpace(model[start+1:idx]), 64); err == nil && ghzVal > 0 {
			fallbackFreq = int(ghzVal * 1000)
		}
	}

	if model == "" {
		model = runtime.GOARCH
	}

	return model, physical, fallbackFreq
}

func readGovernor() string {
	data, err := os.ReadFile(system.SysPath("devices/system/cpu/cpu0/cpufreq/scaling_governor"))
	if err != nil {
		return "N/A"
	}
	return strings.TrimSpace(string(data))
}

func readCache() Cache {
	var c Cache

	// Check sysfs cache dirs for cpu0
	for i := 0; i < 4; i++ {
		levelBytes, err := os.ReadFile(system.SysPath(fmt.Sprintf("devices/system/cpu/cpu0/cache/index%d/level", i)))
		if err != nil {
			continue
		}
		sizeBytes, err := os.ReadFile(system.SysPath(fmt.Sprintf("devices/system/cpu/cpu0/cache/index%d/size", i)))
		if err != nil {
			continue
		}

		level := strings.TrimSpace(string(levelBytes))
		size := strings.TrimSpace(string(sizeBytes))

		if level == "1" {
			if c.L1 == "" {
				c.L1 = size
			} else if !strings.Contains(c.L1, size) {
				c.L1 += " + " + size
			}
		} else if level == "2" {
			c.L2 = size
		} else if level == "3" {
			c.L3 = size
		}
	}

	// Fallbacks if empty
	if c.L1 == "" {
		c.L1 = "N/A"
	}
	if c.L2 == "" {
		c.L2 = "N/A"
	}
	if c.L3 == "" {
		c.L3 = "N/A"
	}

	return c
}
