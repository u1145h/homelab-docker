package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/ullashroy/poco-server/backend/internal/battery"
	"github.com/ullashroy/poco-server/backend/internal/memory"
	"github.com/ullashroy/poco-server/backend/internal/state"
	"github.com/ullashroy/poco-server/backend/internal/storage"
)

// HostTelemetryHandler ingests real physical host hardware telemetry from a host companion agent
// (Windows, macOS, or external Linux agent) and updates the primary dashboard state.
func HostTelemetryHandler(st *state.State) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if st == nil {
			JSON(w, http.StatusServiceUnavailable, map[string]string{"error": "state engine unavailable"})
			return
		}

		var payload state.Status
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			JSON(w, http.StatusBadRequest, map[string]string{"error": "invalid telemetry payload: " + err.Error()})
			return
		}

		source := r.Header.Get("X-Host-Agent")
		if source == "" {
			source = r.RemoteAddr
		}

		st.SetHostTelemetry(payload, source)
		JSON(w, http.StatusOK, map[string]any{"ok": true, "source": source})
	}
}

// IngestNodeTelemetryAsHost converts a Kuro node's telemetry payload into host telemetry.
func IngestNodeTelemetryAsHost(st *state.State, nodeID, platform, devName string, hw, bat, stor, net, meta any) {
	if st == nil {
		return
	}

	current := st.Status()
	hostStatus := current

	// 1. Host OS / System
	if strings.EqualFold(platform, "windows") {
		hostStatus.System.OS = "Windows 11 / 10"
	} else if strings.EqualFold(platform, "macos") || strings.EqualFold(platform, "darwin") {
		hostStatus.System.OS = "macOS"
	} else if platform != "" {
		hostStatus.System.OS = platform
	}
	if devName != "" {
		hostStatus.System.Hostname = devName
	}

	// 2. Hardware metrics
	if hwMap, ok := hw.(map[string]any); ok {
		if cpuP, ok := hwMap["cpu_percent"].(float64); ok {
			hostStatus.CPU.UsagePercent = cpuP
		}
		if uptime, ok := hwMap["uptime_seconds"].(float64); ok {
			hostStatus.System.Uptime = uint64(uptime)
		}
		if osVer, ok := hwMap["os_version"].(string); ok && osVer != "" {
			hostStatus.System.OS = osVer
		}

		// RAM
		ramTotalMB, _ := hwMap["ram_total_mb"].(float64)
		ramUsedMB, _ := hwMap["ram_used_mb"].(float64)
		ramAvailMB, _ := hwMap["ram_available_mb"].(float64)
		if ramTotalMB > 0 {
			totalBytes := uint64(ramTotalMB * 1024 * 1024)
			usedBytes := uint64(ramUsedMB * 1024 * 1024)
			availBytes := uint64(ramAvailMB * 1024 * 1024)
			hostStatus.Memory = memory.Info{
				Total:     totalBytes,
				Used:      usedBytes,
				Available: availBytes,
				Free:      availBytes,
				Usage:     (float64(usedBytes) / float64(totalBytes)) * 100,
			}
		}
	}

	// 3. Battery metrics
	if batMap, ok := bat.(map[string]any); ok {
		pct, _ := batMap["percent"].(float64)
		acConn, _ := batMap["ac_connected"].(bool)
		isCharging, _ := batMap["is_charging"].(bool)

		status := "Discharging"
		if isCharging {
			status = "Charging"
		} else if acConn && pct >= 95 {
			status = "Full"
		}

		pwrSource := "Battery"
		if acConn {
			pwrSource = "AC"
		}

		hostStatus.Battery = battery.Info{
			Present:     true,
			Capacity:    int(pct),
			Status:      status,
			PowerSource: pwrSource,
		}
	}

	// 4. Storage metrics
	if storList, ok := stor.([]any); ok && len(storList) > 0 {
		var mounts []storage.Mount
		var totalStorage, usedStorage, freeStorage uint64
		for _, sItem := range storList {
			if sm, ok := sItem.(map[string]any); ok {
				name, _ := sm["name"].(string)
				mount, _ := sm["mount"].(string)
				totGB, _ := sm["total_gb"].(float64)
				usedGB, _ := sm["used_gb"].(float64)
				freeGB, _ := sm["free_gb"].(float64)
				if name == "" {
					name = mount
				}
				totBytes := uint64(totGB * 1024 * 1024 * 1024)
				usedBytes := uint64(usedGB * 1024 * 1024 * 1024)
				freeBytes := uint64(freeGB * 1024 * 1024 * 1024)
				var usePct float64
				if totBytes > 0 {
					usePct = (float64(usedBytes) / float64(totBytes)) * 100
				}
				mounts = append(mounts, storage.Mount{
					Device:       name,
					Mount:        mount,
					Filesystem:   "NTFS",
					Total:        totBytes,
					Used:         usedBytes,
					Available:    freeBytes,
					UsagePercent: usePct,
					Type:         "user",
				})
				totalStorage += totBytes
				usedStorage += usedBytes
				freeStorage += freeBytes
			}
		}
		if len(mounts) > 0 {
			var totalUsePct float64
			if totalStorage > 0 {
				totalUsePct = (float64(usedStorage) / float64(totalStorage)) * 100
			}
			hostStatus.Storage = storage.Info{
				Total:        totalStorage,
				Used:         usedStorage,
				Free:         freeStorage,
				Available:    freeStorage,
				UsagePercent: totalUsePct,
				Percentage:   totalUsePct,
				Summary: storage.Summary{
					TotalCapacity:   totalStorage,
					Used:            usedStorage,
					Free:            freeStorage,
					PhysicalVolumes: len(mounts),
				},
				Mounts: mounts,
			}
		}
	}

	st.SetHostTelemetry(hostStatus, "node:"+nodeID)
}
