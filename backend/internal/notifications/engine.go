package notifications

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/ullashroy/poco-server/backend/internal/preferences"
	"github.com/ullashroy/poco-server/backend/internal/state"
)

type Engine struct {
	store      *Store
	prefsStore *preferences.Store
	mu         sync.Mutex
	lastAlert  map[string]time.Time
	prevStates map[string]string
}

func NewEngine(store *Store, prefsStore *preferences.Store) *Engine {
	return &Engine{
		store:      store,
		prefsStore: prefsStore,
		lastAlert:  make(map[string]time.Time),
		prevStates: make(map[string]string),
	}
}

func (e *Engine) Evaluate(st *state.State) {
	if st == nil || e.store == nil {
		return
	}

	// Fetch admin preferences as default rule set
	prefs, _ := e.prefsStore.Load("admin")

	now := time.Now()

	// Check Quiet Hours (22:00 - 07:00)
	isQuiet := false
	if prefs.QuietHours {
		hr := now.Hour()
		if hr >= 22 || hr < 7 {
			isQuiet = true
		}
	}

	renotifyDuration := parseDuration(prefs.RenotifyInterval, 30*time.Minute)

	canAlert := func(key string, minSev Severity) bool {
		if isQuiet && minSev != SevCritical {
			return false
		}
		if prefs.MinSeverity == "critical" && minSev != SevCritical {
			return false
		}
		if prefs.MinSeverity == "warning" && (minSev == SevInfo || minSev == SevSuccess) {
			return false
		}

		e.mu.Lock()
		defer e.mu.Unlock()

		last, exists := e.lastAlert[key]
		if !exists || now.Sub(last) >= renotifyDuration {
			e.lastAlert[key] = now
			return true
		}
		return false
	}

	clearAlert := func(key string) {
		e.mu.Lock()
		defer e.mu.Unlock()
		delete(e.lastAlert, key)
	}

	// 1. CPU Evaluation
	if prefs.NotifyCPU {
		cpuInfo := st.CPU()
		if cpuInfo.UsagePercent >= float64(prefs.CPUCrit) && prefs.CPUCrit > 0 {
			if canAlert("cpu_crit", SevCritical) {
				e.store.Add(SevCritical, CatCPU, "CPU Critical Usage",
					fmt.Sprintf("CPU usage is at %.1f%% (exceeded critical threshold %d%%)", cpuInfo.UsagePercent, prefs.CPUCrit),
					"/cpu")
			}
		} else if cpuInfo.UsagePercent >= float64(prefs.CPUWarn) && prefs.CPUWarn > 0 {
			if canAlert("cpu_warn", SevWarning) {
				e.store.Add(SevWarning, CatCPU, "CPU High Usage",
					fmt.Sprintf("CPU usage is at %.1f%% (exceeded warning threshold %d%%)", cpuInfo.UsagePercent, prefs.CPUWarn),
					"/cpu")
			}
		} else {
			clearAlert("cpu_crit")
			clearAlert("cpu_warn")
		}
	}

	// 2. Memory Evaluation
	if prefs.NotifyMemory {
		memInfo := st.Memory()
		if memInfo.Total > 0 {
			memUsage := (float64(memInfo.Used) / float64(memInfo.Total)) * 100
			memCrit := prefs.MemCrit
			if memCrit <= 0 {
				memCrit = 95
			}
			if memUsage >= float64(memCrit) {
				if canAlert("mem_high", SevCritical) {
					e.store.Add(SevCritical, CatMemory, "Memory Critical Alert",
						fmt.Sprintf("RAM usage is critically high at %.1f%% (%s / %s)", memUsage, formatBytes(memInfo.Used), formatBytes(memInfo.Total)),
						"/memory")
				}
			} else if memUsage >= float64(prefs.MemWarn) && prefs.MemWarn > 0 {
				if canAlert("mem_high", SevWarning) {
					e.store.Add(SevWarning, CatMemory, "High Memory Usage",
						fmt.Sprintf("RAM usage is at %.1f%% (%s / %s)", memUsage, formatBytes(memInfo.Used), formatBytes(memInfo.Total)),
						"/memory")
				}
			} else {
				clearAlert("mem_high")
			}
		}
	}

	// 3. Storage Evaluation
	if prefs.NotifyStorage {
		storageInfo := st.Storage()
		fsCrit := prefs.FSCrit
		if fsCrit <= 0 {
			fsCrit = 95
		}
		for _, m := range storageInfo.Mounts {
			key := "storage_" + m.Mount
			if m.UsagePercent >= float64(fsCrit) {
				if canAlert(key, SevCritical) {
					e.store.Add(SevCritical, CatStorage, "Storage Volume Critical",
						fmt.Sprintf("Mount %s usage is critically high at %.1f%% (%s used)", m.Mount, m.UsagePercent, formatBytes(m.Used)),
						"/storage")
				}
			} else if m.UsagePercent >= float64(prefs.FSWarn) && prefs.FSWarn > 0 {
				if canAlert(key, SevWarning) {
					e.store.Add(SevWarning, CatStorage, "Storage Volume Low",
						fmt.Sprintf("Mount %s usage is at %.1f%% (%s used)", m.Mount, m.UsagePercent, formatBytes(m.Used)),
						"/storage")
				}
			} else {
				clearAlert(key)
			}
		}
	}

	// 4. Thermal Evaluation
	if prefs.NotifyThermal {
		thermalInfo := st.Thermal()
		for _, z := range thermalInfo.Zones {
			key := "thermal_" + z.Name
			if z.TemperatureC >= float64(prefs.TempCrit) && prefs.TempCrit > 0 {
				if canAlert(key+"_crit", SevCritical) {
					e.store.Add(SevCritical, CatThermal, "Thermal Zone Overheating",
						fmt.Sprintf("Zone %s temperature is at %.1f°C (critical limit %d°C)", z.Name, z.TemperatureC, prefs.TempCrit),
						"/thermal")
				}
			} else if z.TemperatureC >= float64(prefs.TempWarn) && prefs.TempWarn > 0 {
				if canAlert(key+"_warn", SevWarning) {
					e.store.Add(SevWarning, CatThermal, "High Temperature Alert",
						fmt.Sprintf("Zone %s temperature is at %.1f°C (warning limit %d°C)", z.Name, z.TemperatureC, prefs.TempWarn),
						"/thermal")
				}
			} else {
				clearAlert(key + "_crit")
				clearAlert(key + "_warn")
			}
		}
	}

	// 5. Battery Evaluation & State Transitions
	if prefs.NotifyBattery {
		batteryInfo := st.Battery()
		if batteryInfo.Present {
			isCharging := strings.EqualFold(batteryInfo.Status, "Charging")
			isFull := strings.EqualFold(batteryInfo.Status, "Full") || (batteryInfo.Capacity >= 100 && !strings.EqualFold(batteryInfo.Status, "Discharging"))
			isDischarging := strings.EqualFold(batteryInfo.Status, "Discharging")
			isPowerConnected := isCharging || isFull || (batteryInfo.PowerSource != "Battery" && batteryInfo.PowerSource != "")

			e.mu.Lock()
			prevStatus, hasPrevStatus := e.prevStates["battery_status"]
			prevConn, hasPrevConn := e.prevStates["battery_power_connected"]

			// 5A. Charger Connected (Plugged In)
			if hasPrevConn && prevConn == "false" && isPowerConnected {
				timeMsg := ""
				if batteryInfo.TimeToFullMin > 0 {
					timeMsg = fmt.Sprintf(" (est. %s to full charge)", formatMinutes(batteryInfo.TimeToFullMin))
				}
				e.store.Add(SevSuccess, CatBattery, "Charger Connected",
					fmt.Sprintf("Power cable connected. Battery is at %d%%%s.", batteryInfo.Capacity, timeMsg),
					"/monitoring")
				delete(e.lastAlert, "battery_low")
				delete(e.lastAlert, "battery_critical")
			}

			// 5B. Charger Disconnected (Unplugged)
			if hasPrevConn && prevConn == "true" && isDischarging {
				timeMsg := ""
				if batteryInfo.RuntimeLeftMin > 0 {
					timeMsg = fmt.Sprintf(" (estimated runtime: %s)", formatMinutes(batteryInfo.RuntimeLeftMin))
				}
				e.store.Add(SevWarning, CatBattery, "Charger Disconnected",
					fmt.Sprintf("Power cable disconnected. Server is running on battery at %d%%%s.", batteryInfo.Capacity, timeMsg),
					"/monitoring")
			}

			// 5C. Battery Fully Charged
			if isPowerConnected && (isFull || batteryInfo.Capacity >= 100) {
				if hasPrevStatus && prevStatus != "Full" && prevStatus != "100" {
					e.store.Add(SevSuccess, CatBattery, "Battery Fully Charged",
						"Battery has reached 100% capacity. Power supply is active and healthy.",
						"/monitoring")
				}
			}

			// Update stored state
			currConnStr := "false"
			if isPowerConnected {
				currConnStr = "true"
			}
			e.prevStates["battery_power_connected"] = currConnStr
			if isFull {
				e.prevStates["battery_status"] = "Full"
			} else {
				e.prevStates["battery_status"] = batteryInfo.Status
			}
			e.mu.Unlock()

			// 5D. Critical Battery Threshold (<= BatteryCrit when discharging)
			battCrit := prefs.BatteryCrit
			if battCrit <= 0 {
				battCrit = 10
			}
			if isDischarging && batteryInfo.Capacity <= battCrit && batteryInfo.Capacity > 0 {
				if canAlert("battery_critical", SevCritical) {
					timeMsg := ""
					if batteryInfo.RuntimeLeftMin > 0 {
						timeMsg = fmt.Sprintf(" (est. %s left)", formatMinutes(batteryInfo.RuntimeLeftMin))
					}
					e.store.Add(SevCritical, CatBattery, "Critical Battery Alert",
						fmt.Sprintf("CRITICAL: Battery level is at %d%%%s! Connect charger immediately to prevent shutdown.", batteryInfo.Capacity, timeMsg),
						"/monitoring")
				}
			} else {
				clearAlert("battery_critical")
			}

			// 5E. Low Battery Threshold (<= BatteryLow when discharging)
			if isDischarging && batteryInfo.Capacity <= prefs.BatteryLow && batteryInfo.Capacity > battCrit && prefs.BatteryLow > 0 {
				if canAlert("battery_low", SevWarning) {
					timeMsg := ""
					if batteryInfo.RuntimeLeftMin > 0 {
						timeMsg = fmt.Sprintf(" (est. %s left)", formatMinutes(batteryInfo.RuntimeLeftMin))
					}
					e.store.Add(SevWarning, CatBattery, "Low Battery Warning",
						fmt.Sprintf("Battery level is low at %d%%%s. Please connect a charger.", batteryInfo.Capacity, timeMsg),
						"/monitoring")
				}
			} else if !isDischarging || batteryInfo.Capacity > prefs.BatteryLow {
				clearAlert("battery_low")
			}

			// 5F. Battery Overheating Alert (>= 45°C)
			if batteryInfo.TemperatureC >= 45.0 || strings.EqualFold(batteryInfo.Health, "Overheat") {
				if canAlert("battery_temp", SevCritical) {
					e.store.Add(SevCritical, CatBattery, "Battery Overheating",
						fmt.Sprintf("Battery temperature is critically high at %.1f°C! Please reduce load or check cooling.", batteryInfo.TemperatureC),
						"/monitoring")
				}
			} else if batteryInfo.TemperatureC > 0 && batteryInfo.TemperatureC < 42.0 {
				clearAlert("battery_temp")
			}

			// 5G. Battery Health Warning
			if batteryInfo.Health != "" && !strings.EqualFold(batteryInfo.Health, "Good") && !strings.EqualFold(batteryInfo.Health, "Unknown") && !strings.EqualFold(batteryInfo.Health, "Overheat") {
				if canAlert("battery_health", SevWarning) {
					e.store.Add(SevWarning, CatBattery, "Battery Health Alert",
						fmt.Sprintf("Battery health reported as '%s' (wear level: %d%%). Battery replacement recommended.", batteryInfo.Health, batteryInfo.WearLevelPercent),
						"/monitoring")
				}
			}
		}
	}

	// 6. Docker Container State Changes
	if prefs.NotifyDocker {
		dockerInfo := st.Docker()
		e.mu.Lock()
		for _, c := range dockerInfo.Containers {
			prev, exists := e.prevStates["docker_"+c.Name]
			if exists && prev != c.State {
				if c.State == "running" {
					e.store.Add(SevSuccess, CatDocker, "Docker Container Started",
						fmt.Sprintf("Container '%s' (%s) is now running", c.Name, c.Image),
						"/docker")
				} else if c.State == "exited" || c.State == "dead" {
					e.store.Add(SevCritical, CatDocker, "Docker Container Stopped",
						fmt.Sprintf("Container '%s' has stopped (state: %s)", c.Name, c.State),
						"/docker")
				}
			}
			e.prevStates["docker_"+c.Name] = c.State
		}
		e.mu.Unlock()
	}

	// 7. Network Interface Changes
	if prefs.NotifyNetwork {
		netInfo := st.Network()
		e.mu.Lock()
		for _, iface := range netInfo.Interfaces {
			prev, exists := e.prevStates["net_"+iface.Name]
			curr := "down"
			if iface.Up {
				curr = "up"
			}
			if exists && prev != curr {
				if iface.Up {
					e.store.Add(SevSuccess, CatNetwork, "Network Interface Connected",
						fmt.Sprintf("Network interface '%s' is now UP", iface.Name),
						"/network")
				} else {
					e.store.Add(SevCritical, CatNetwork, "Network Interface Down",
						fmt.Sprintf("Network interface '%s' went DOWN", iface.Name),
						"/network")
				}
			}
			e.prevStates["net_"+iface.Name] = curr
		}
		e.mu.Unlock()
	}

	// 8. Tailscale State Changes
	if prefs.NotifyTailscale {
		tailscaleInfo := st.Tailscale()
		e.mu.Lock()
		if tailscaleInfo.BackendState != "" {
			prev, exists := e.prevStates["tailscale_state"]
			if exists && prev != tailscaleInfo.BackendState {
				if tailscaleInfo.BackendState == "Running" {
					e.store.Add(SevSuccess, CatTailscale, "Tailscale Connected",
						"Tailscale VPN daemon is now running and connected",
						"/dashboard")
				} else {
					e.store.Add(SevWarning, CatTailscale, "Tailscale Disconnected",
						fmt.Sprintf("Tailscale status changed to '%s'", tailscaleInfo.BackendState),
						"/dashboard")
				}
			}
			e.prevStates["tailscale_state"] = tailscaleInfo.BackendState
		}
		e.mu.Unlock()
	}
}

func parseDuration(s string, fallback time.Duration) time.Duration {
	if s == "" {
		return fallback
	}
	d, err := time.ParseDuration(s)
	if err != nil {
		return fallback
	}
	return d
}

func formatMinutes(m int) string {
	if m <= 0 {
		return ""
	}
	if m < 60 {
		return fmt.Sprintf("%d min", m)
	}
	h := m / 60
	rem := m % 60
	if rem == 0 {
		return fmt.Sprintf("%dh", h)
	}
	return fmt.Sprintf("%dh %dm", h, rem)
}

func formatBytes(b uint64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := uint64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %ciB", float64(b)/float64(div), "KMGTPE"[exp])
}
