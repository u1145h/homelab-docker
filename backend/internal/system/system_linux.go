package system

import (
	"bufio"
	"os"
	"runtime"
	"strconv"
	"strings"
	"time"

	"golang.org/x/sys/unix"
)

func Collect() (*Info, error) {
	host, _ := os.Hostname()

	var uts unix.Utsname
	if err := unix.Uname(&uts); err != nil {
		return nil, err
	}

	uptime, _ := readUptime()
	loadavg, _ := readLoadAvg()

	osName := "linux"
	kernelRelease := charsToString(uts.Release[:])

	// 1. Detect Windows host via Docker Desktop / WSL2
	isWindowsHost := false
	if _, err := os.Stat(HostRootPath("mnt/host/c/Windows")); err == nil {
		isWindowsHost = true
	} else if _, err := os.Stat("/host_root/mnt/host/c/Windows"); err == nil {
		isWindowsHost = true
	} else if strings.Contains(strings.ToLower(kernelRelease), "microsoft-standard-wsl2") {
		isWindowsHost = true
	}

	// 2. Detect macOS host via Docker Desktop
	isMacHost := false
	if _, err := os.Stat(HostRootPath("System/Library/CoreServices/SystemVersion.plist")); err == nil {
		isMacHost = true
	}

	if isWindowsHost {
		osName = "Windows 11 / 10 (Docker Host)"
	} else if isMacHost {
		osName = "macOS (Docker Host)"
	} else {
		// 3. Native Linux: read distribution name from host os-release
		for _, osRelPath := range []string{"/host/etc/os-release", "/etc/os-release"} {
			if data, err := os.ReadFile(osRelPath); err == nil {
				for _, line := range strings.Split(string(data), "\n") {
					if strings.HasPrefix(line, "PRETTY_NAME=") {
						val := strings.Trim(strings.TrimPrefix(line, "PRETTY_NAME="), "\"")
						if val != "" && val != "Docker Desktop" {
							osName = val
							break
						}
					}
				}
			}
			if osName != "linux" {
				break
			}
		}
	}

	return &Info{
		Hostname: host,
		Kernel:   kernelRelease,
		OS:       osName,
		Arch:     runtime.GOARCH,
		Go:       runtime.Version(),
		Uptime:   uptime,
		BootTime: time.Now().Add(-time.Duration(uptime) * time.Second),
		LoadAvg:  loadavg,
	}, nil
}

func readLoadAvg() ([]float64, error) {
	f, err := os.Open(ProcPath("loadavg"))
	if err != nil {
		return []float64{0, 0, 0}, err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	if !scanner.Scan() {
		return []float64{0, 0, 0}, nil
	}

	fields := strings.Fields(scanner.Text())
	if len(fields) < 3 {
		return []float64{0, 0, 0}, nil
	}

	l1, _ := strconv.ParseFloat(fields[0], 64)
	l5, _ := strconv.ParseFloat(fields[1], 64)
	l15, _ := strconv.ParseFloat(fields[2], 64)

	return []float64{l1, l5, l15}, nil
}

func readUptime() (uint64, error) {
	f, err := os.Open(ProcPath("uptime"))
	if err != nil {
		return 0, err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	scanner.Scan()

	fields := strings.Fields(scanner.Text())

	u, err := strconv.ParseFloat(fields[0], 64)
	if err != nil {
		return 0, err
	}

	return uint64(u), nil
}

func charsToString(c []byte) string {
	n := 0
	for ; n < len(c); n++ {
		if c[n] == 0 {
			break
		}
	}
	return string(c[:n])
}
