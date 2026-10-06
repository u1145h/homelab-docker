package storage

import (
	"bufio"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/ullashroy/poco-server/backend/internal/system"
	"golang.org/x/sys/unix"
)

func Collect() (*Info, error) {
	file, err := os.Open(system.ProcPath("mounts"))
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var mounts []Mount
	var summary Summary
	var capacityMix []CapacityMix
	seenMounts := make(map[string]bool)

	scanner := bufio.NewScanner(file)

	pseudoFS := map[string]bool{
		"proc": true, "sysfs": true, "devtmpfs": true, "devpts": true, "cgroup": true,
		"cgroup2": true, "pstore": true, "bpf": true, "tracefs": true, "hugetlbfs": true,
		"mqueue": true, "autofs": true, "securityfs": true, "configfs": true, "debugfs": true,
		"fusectl": true, "nsfs": true, "ramfs": true, "squashfs": true,
	}

	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 3 {
			continue
		}

		device := fields[0]
		mountPoint := fields[1]
		filesystem := fields[2]

		if seenMounts[mountPoint] {
			continue
		}
		seenMounts[mountPoint] = true

		mountType := "user"
		if mountPoint == "/" {
			mountType = "root"
		} else if mountPoint == "/boot" || strings.HasPrefix(mountPoint, "/boot/") {
			mountType = "boot"
		} else if strings.HasPrefix(mountPoint, "/sys") || strings.HasPrefix(mountPoint, "/proc") || strings.HasPrefix(mountPoint, "/dev") || strings.HasPrefix(mountPoint, "/run") {
			mountType = "virtual"
		}

		var stat unix.Statfs_t

		if err := unix.Statfs(mountPoint, &stat); err != nil {
			continue
		}

		total := stat.Blocks * uint64(stat.Bsize)
		available := stat.Bavail * uint64(stat.Bsize)
		free := stat.Bfree * uint64(stat.Bsize)
		used := total - free

		var usage float64
		if total > 0 {
			usage = (float64(used) / float64(total)) * 100
		}

		isPhysicalVolume := false
		if mountPoint == "/" {
			isPhysicalVolume = true
		} else if total > 0 && mountType != "virtual" && !pseudoFS[filesystem] && !strings.HasPrefix(filesystem, "tmpfs") {
			isPhysicalVolume = true
		}

		if isPhysicalVolume && total > 0 {
			summary.TotalCapacity += total
			summary.Used += used
			summary.Free += free
			summary.PhysicalVolumes++

			color := "var(--kuro-color-accent)"
			if mountPoint == "/" {
				color = "var(--kuro-color-warning)"
			}
			capacityMix = append(capacityMix, CapacityMix{
				Name:  mountPoint + " - " + filesystem,
				Total: total,
				Used:  used,
				Color: color,
			})
		}

		mounts = append(mounts, Mount{
			Device:       device,
			Mount:        mountPoint,
			Filesystem:   filesystem,
			Total:        total,
			Used:         used,
			Available:    available,
			UsagePercent: usage,
			ReadOnly:     stat.Flags&unix.ST_RDONLY != 0,
			Type:         mountType,
		})
	}

	if summary.TotalCapacity == 0 && len(mounts) > 0 {
		for _, m := range mounts {
			if m.Total > 0 && m.Type != "virtual" {
				summary.TotalCapacity += m.Total
				summary.Used += m.Used
				summary.Free += m.Available
				summary.PhysicalVolumes++
			}
		}
	}

	capacityMix = append(capacityMix, CapacityMix{
		Name:  "Free",
		Total: summary.Free,
		Used:  0,
		Color: "var(--kuro-color-text-muted)",
	})

	// Parse meminfo for Filesystem Cache
	fc := FilesystemCache{
		HitRatio:  "",
		Inodes:    "",
		Scheduler: "",
	}
	if memFile, err := os.Open(system.ProcPath("meminfo")); err == nil {
		defer memFile.Close()
		memScanner := bufio.NewScanner(memFile)
		for memScanner.Scan() {
			line := memScanner.Text()
			fields := strings.Fields(line)
			if len(fields) < 2 {
				continue
			}
			val := parseKB(fields[1])
			switch fields[0] {
			case "Cached:":
				fc.Cached = val
			case "Buffers:":
				fc.Buffers = val
			case "Dirty:":
				fc.Dirty = val
			case "SwapTotal:":
				fc.SwapTotal = val
			case "SwapFree:":
				fc.SwapUsed = fc.SwapTotal - val
			}
		}
	}

	io := collectIOThroughput()
	bd := collectRealBlockDevices()

	var usagePct float64
	if summary.TotalCapacity > 0 {
		usagePct = (float64(summary.Used) / float64(summary.TotalCapacity)) * 100
	} else if len(mounts) > 0 && mounts[0].Total > 0 {
		usagePct = mounts[0].UsagePercent
	}

	return &Info{
		Total:           summary.TotalCapacity,
		Used:            summary.Used,
		Free:            summary.Free,
		Available:       summary.Free,
		UsagePercent:    usagePct,
		Percentage:      usagePct,
		Summary:         summary,
		CapacityMix:     capacityMix,
		IOThroughput:    io,
		Mounts:          mounts,
		BlockDevices:    bd,
		FilesystemCache: fc,
	}, nil
}

type ioState struct {
	mu           sync.Mutex
	lastTime     time.Time
	lastReadSec  uint64
	lastWriteSec uint64
	lastReadIO   uint64
	lastWriteIO  uint64
	lastTicks    uint64
}

var globalIOState ioState

func collectIOThroughput() IOThroughput {
	entries, err := os.ReadDir("/sys/block")
	if err != nil {
		return IOThroughput{}
	}

	var totReadSec, totWriteSec, totReadIO, totWriteIO, totInFlight, totTicks uint64

	for _, entry := range entries {
		name := entry.Name()
		if strings.HasPrefix(name, "loop") || strings.HasPrefix(name, "ram") || strings.HasPrefix(name, "sr") {
			continue
		}
		if statBytes, err := os.ReadFile("/sys/block/" + name + "/stat"); err == nil {
			fields := strings.Fields(string(statBytes))
			if len(fields) >= 11 {
				rIO, _ := strconv.ParseUint(fields[0], 10, 64)
				rSec, _ := strconv.ParseUint(fields[2], 10, 64)
				wIO, _ := strconv.ParseUint(fields[4], 10, 64)
				wSec, _ := strconv.ParseUint(fields[6], 10, 64)
				inFlight, _ := strconv.ParseUint(fields[8], 10, 64)
				ticks, _ := strconv.ParseUint(fields[10], 10, 64)

				totReadIO += rIO
				totReadSec += rSec
				totWriteIO += wIO
				totWriteSec += wSec
				totInFlight += inFlight
				totTicks += ticks
			}
		}
	}

	globalIOState.mu.Lock()
	defer globalIOState.mu.Unlock()

	now := time.Now()
	var io IOThroughput

	if !globalIOState.lastTime.IsZero() {
		dt := now.Sub(globalIOState.lastTime).Seconds()
		if dt > 0.1 {
			var rSecDiff, wSecDiff, rIODiff, wIODiff, ticksDiff uint64
			if totReadSec >= globalIOState.lastReadSec {
				rSecDiff = totReadSec - globalIOState.lastReadSec
			}
			if totWriteSec >= globalIOState.lastWriteSec {
				wSecDiff = totWriteSec - globalIOState.lastWriteSec
			}
			if totReadIO >= globalIOState.lastReadIO {
				rIODiff = totReadIO - globalIOState.lastReadIO
			}
			if totWriteIO >= globalIOState.lastWriteIO {
				wIODiff = totWriteIO - globalIOState.lastWriteIO
			}
			if totTicks >= globalIOState.lastTicks {
				ticksDiff = totTicks - globalIOState.lastTicks
			}

			readBytesPerSec := float64(rSecDiff*512) / dt
			writeBytesPerSec := float64(wSecDiff*512) / dt

			io.ReadMBps = readBytesPerSec / (1024 * 1024)
			io.WriteMBps = writeBytesPerSec / (1024 * 1024)
			io.IOPS = uint64(float64(rIODiff+wIODiff) / dt)
			io.QueueDepth = float64(totInFlight)

			totIOs := rIODiff + wIODiff
			if totIOs > 0 {
				io.Await = float64(ticksDiff) / float64(totIOs)
			}
		}
	}

	globalIOState.lastTime = now
	globalIOState.lastReadSec = totReadSec
	globalIOState.lastWriteSec = totWriteSec
	globalIOState.lastReadIO = totReadIO
	globalIOState.lastWriteIO = totWriteIO
	globalIOState.lastTicks = totTicks

	return io
}

// collectRealBlockDevices scans /sys/block for real physical and removable storage devices (USB drives, SD cards, NVMe, SATA)
func collectRealBlockDevices() []BlockDevice {
	var devices []BlockDevice
	entries, err := os.ReadDir("/sys/block")
	if err != nil {
		return devices
	}

	for _, entry := range entries {
		name := entry.Name()
		// Skip loop devices, RAM disks, CD-ROMs
		if strings.HasPrefix(name, "loop") || strings.HasPrefix(name, "ram") || strings.HasPrefix(name, "sr") {
			continue
		}

		// Read size in 512-byte sectors
		sizeBytes, err := os.ReadFile("/sys/block/" + name + "/size")
		if err != nil {
			continue
		}
		sectors, err := strconv.ParseUint(strings.TrimSpace(string(sizeBytes)), 10, 64)
		if err != nil || sectors == 0 {
			continue
		}
		totalSizeBytes := sectors * 512

		// Determine if device is removable (e.g. USB flash drive, MicroSD card)
		isRemovable := false
		if remBytes, err := os.ReadFile("/sys/block/" + name + "/removable"); err == nil {
			if strings.TrimSpace(string(remBytes)) == "1" {
				isRemovable = true
			}
		}

		// Read Model / Vendor / Name
		model := ""
		if modelBytes, err := os.ReadFile("/sys/block/" + name + "/device/model"); err == nil {
			model = strings.TrimSpace(string(modelBytes))
		}
		if vendorBytes, err := os.ReadFile("/sys/block/" + name + "/device/vendor"); err == nil {
			vendor := strings.TrimSpace(string(vendorBytes))
			if vendor != "" {
				model = vendor + " " + model
			}
		}
		if model == "" {
			if nameBytes, err := os.ReadFile("/sys/block/" + name + "/device/name"); err == nil {
				model = strings.TrimSpace(string(nameBytes))
			}
		}
		if model == "" {
			if isRemovable {
				model = "Removable Storage (" + name + ")"
			} else {
				model = "Block Device (" + name + ")"
			}
		}

		// Read I/O stats from /sys/block/<name>/stat
		var readBytes, writeBytes uint64
		if statBytes, err := os.ReadFile("/sys/block/" + name + "/stat"); err == nil {
			fields := strings.Fields(string(statBytes))
			if len(fields) >= 7 {
				if readSectors, err := strconv.ParseUint(fields[2], 10, 64); err == nil {
					readBytes = readSectors * 512
				}
				if writeSectors, err := strconv.ParseUint(fields[6], 10, 64); err == nil {
					writeBytes = writeSectors * 512
				}
			}
		}

		devices = append(devices, BlockDevice{
			Device: "/dev/" + name,
			Model:  model,
			Size:   totalSizeBytes,
			Temp:   "N/A",
			Read:   readBytes,
			Write:  writeBytes,
			Health: "healthy",
		})
	}

	return devices
}

func parseKB(s string) uint64 {
	var val uint64
	for _, r := range s {
		if r >= '0' && r <= '9' {
			val = val*10 + uint64(r-'0')
		}
	}
	return val * 1024
}
