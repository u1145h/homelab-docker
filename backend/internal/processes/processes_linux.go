package processes

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/ullashroy/poco-server/backend/internal/system"
)

var (
	pageSize = float64(os.Getpagesize())
	hz       = float64(100) // standard Linux userland HZ
)

func Collect() (*Info, error) {
	dirs, err := os.ReadDir(system.ProcPath(""))
	if err != nil {
		return &Info{}, err
	}

	uptimeBytes, err := os.ReadFile(system.ProcPath("uptime"))
	var uptime float64
	if err == nil {
		fields := strings.Fields(string(uptimeBytes))
		if len(fields) > 0 {
			uptime, _ = strconv.ParseFloat(fields[0], 64)
		}
	}

	totalMem := getTotalMem()

	var procs []Process

	for _, d := range dirs {
		if !d.IsDir() {
			continue
		}
		pid := d.Name()
		if _, err := strconv.Atoi(pid); err != nil {
			continue
		}

		statBytes, err := os.ReadFile(filepath.Join(system.ProcPath(""), pid, "stat"))
		if err != nil {
			continue
		}
		statStr := string(statBytes)

		start := strings.IndexByte(statStr, '(')
		end := strings.LastIndexByte(statStr, ')')
		if start == -1 || end == -1 || end < start {
			continue
		}

		comm := statStr[start+1 : end]
		fields := strings.Fields(statStr[end+1:])
		if len(fields) < 22 {
			continue
		}

		utime, _ := strconv.ParseFloat(fields[11], 64)
		stime, _ := strconv.ParseFloat(fields[12], 64)
		threads, _ := strconv.Atoi(fields[17])
		starttime, _ := strconv.ParseFloat(fields[19], 64)
		rssPages, _ := strconv.ParseFloat(fields[21], 64)

		totalTime := (utime + stime) / hz
		startTimeSec := starttime / hz

		var cpu float64
		if uptime > 0 && uptime > startTimeSec {
			cpu = 100 * (totalTime / (uptime - startTimeSec))
		}

		var mem float64
		if totalMem > 0 {
			rssBytes := rssPages * pageSize
			mem = (rssBytes / totalMem) * 100
		}

		user := getProcUser(pid)

		// Format time string like MM:SS
		mins := int(totalTime) / 60
		secs := int(totalTime) % 60
		timeStr := fmt.Sprintf("%02d:%02d", mins, secs)

		procs = append(procs, Process{
			PID:     pid,
			Command: comm,
			User:    user,
			CPU:     cpu,
			Memory:  mem,
			Threads: threads,
			Time:    timeStr,
		})
	}

	sort.Slice(procs, func(i, j int) bool {
		return procs[i].CPU > procs[j].CPU
	})

	topCPU := make([]Process, len(procs))
	copy(topCPU, procs)
	if len(topCPU) > 10 {
		topCPU = topCPU[:10]
	}

	sort.Slice(procs, func(i, j int) bool {
		return procs[i].Memory > procs[j].Memory
	})

	topMem := make([]Process, len(procs))
	copy(topMem, procs)
	if len(topMem) > 10 {
		topMem = topMem[:10]
	}

	return &Info{Top: topCPU, TopMemory: topMem}, nil
}

func getTotalMem() float64 {
	data, err := os.ReadFile(system.ProcPath("meminfo"))
	if err != nil {
		return 0
	}
	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		if strings.HasPrefix(line, "MemTotal:") {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				kb, _ := strconv.ParseFloat(fields[1], 64)
				return kb * 1024
			}
		}
	}
	return 0
}

func getProcUser(pid string) string {
	statusBytes, err := os.ReadFile(filepath.Join(system.ProcPath(""), pid, "status"))
	if err != nil {
		return "unknown"
	}
	for _, line := range strings.Split(string(statusBytes), "\n") {
		if strings.HasPrefix(line, "Uid:") {
			fields := strings.Fields(line)
			if len(fields) > 1 {
				uid := fields[1]
				// Simple mapping for common, ideally use os/user but it requires cgo
				if uid == "0" {
					return "root"
				}
				return uid
			}
		}
	}
	return "unknown"
}
