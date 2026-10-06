package system

import (
	"os"
	"path/filepath"
)

// ProcPath resolves a relative procfs path (e.g., "stat", "meminfo", "loadavg", "uptime", "net/dev")
// to either $HOST_PROC/<subpath> (when running containerized with host mounts) or /proc/<subpath>.
func ProcPath(subpath string) string {
	if hostProc := os.Getenv("HOST_PROC"); hostProc != "" {
		p := filepath.Join(hostProc, subpath)
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return filepath.Join("/proc", subpath)
}

// SysPath resolves a relative sysfs path (e.g., "class/thermal", "class/power_supply")
// to either $HOST_SYS/<subpath> or /sys/<subpath>.
func SysPath(subpath string) string {
	if hostSys := os.Getenv("HOST_SYS"); hostSys != "" {
		p := filepath.Join(hostSys, subpath)
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return filepath.Join("/sys", subpath)
}

// HostRootPath resolves a path relative to the mounted host filesystem root ($HOST_ROOT or /host_root)
// if set, otherwise falling back to standard root "/".
func HostRootPath(subpath string) string {
	if hostRoot := os.Getenv("HOST_ROOT"); hostRoot != "" {
		p := filepath.Join(hostRoot, subpath)
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return filepath.Join("/", subpath)
}
