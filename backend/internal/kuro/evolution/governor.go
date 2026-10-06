package evolution

import (
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/ullashroy/poco-server/backend/internal/state"
)

const (
	MaxSafeTemperatureCelsius = 56.0
	WarmTemperatureThreshold  = 46.0
	MinSafeBatteryPercentage  = 15
	HighCPULoadThreshold      = 85.0

	IntervalCharging  = 5 * time.Minute
	IntervalOnBattery = 15 * time.Minute
	IntervalLowPower  = 45 * time.Minute
)

// HardwareGovernor monitors device thermals, battery health, and host CPU loads
// to prevent overheating, excessive power drain, or resource starvation on Android/ARM servers.
type HardwareGovernor struct {
	state   *state.State
	preempt *PreemptionCoordinator
}

func NewHardwareGovernor(st *state.State, p *PreemptionCoordinator) *HardwareGovernor {
	return &HardwareGovernor{
		state:   st,
		preempt: p,
	}
}

type GovernorAssessment struct {
	Allowed     bool          `json:"allowed"`
	Reason      string        `json:"reason"`
	Temperature float64       `json:"temperature_celsius"`
	BatteryPct  int           `json:"battery_percentage"`
	IsCharging  bool          `json:"is_charging"`
	CPULoad     float64       `json:"cpu_load_percent"`
	Interval    time.Duration `json:"recommended_interval"`
}

// Assess evaluates current hardware and user activity conditions.
func (g *HardwareGovernor) Assess() GovernorAssessment {
	var temp float64
	var battPct int = 100
	var isCharging bool = true
	var cpuLoad float64

	if g.state != nil {
		st := g.state.Status()

		// 1. Temperature Check
		for _, z := range st.Thermal.Zones {
			if z.TemperatureC > temp {
				temp = z.TemperatureC
			}
		}
		if temp == 0 && st.Battery.TemperatureC > 0 {
			temp = st.Battery.TemperatureC
		}

		// 2. Battery Check
		if st.Battery.Capacity > 0 {
			battPct = st.Battery.Capacity
			isCharging = strings.EqualFold(st.Battery.Status, "Charging") || strings.EqualFold(st.Battery.Status, "Full")
		}

		// 3. CPU Load Check
		cpuLoad = st.CPU.UsagePercent
	}

	interval := IntervalCharging
	if !isCharging {
		if battPct <= 35 {
			interval = IntervalLowPower
		} else {
			interval = IntervalOnBattery
		}
	}

	// Rule 1: User Priority Preemption
	if g.preempt != nil && g.preempt.IsUserActive() {
		return GovernorAssessment{
			Allowed:     false,
			Reason:      "User interactive chat is currently active or recently engaged",
			Temperature: temp,
			BatteryPct:  battPct,
			IsCharging:  isCharging,
			CPULoad:     cpuLoad,
			Interval:    interval,
		}
	}

	// Rule 2: Thermal Safety Threshold
	if temp >= MaxSafeTemperatureCelsius {
		slog.Warn("🌡️ Kuro Evolution throttled: thermal limit exceeded", "temp_c", temp)
		return GovernorAssessment{
			Allowed:     false,
			Reason:      fmt.Sprintf("Device temperature is high (%.1f°C >= %.1f°C threshold)", temp, MaxSafeTemperatureCelsius),
			Temperature: temp,
			BatteryPct:  battPct,
			IsCharging:  isCharging,
			CPULoad:     cpuLoad,
			Interval:    interval,
		}
	}

	// Rule 3: Low Battery Conservation
	if !isCharging && battPct < MinSafeBatteryPercentage {
		slog.Info("🔋 Kuro Evolution sleeping: battery preservation", "battery_pct", battPct)
		return GovernorAssessment{
			Allowed:     false,
			Reason:      fmt.Sprintf("Battery level low (%d%% < %d%%) on battery power", battPct, MinSafeBatteryPercentage),
			Temperature: temp,
			BatteryPct:  battPct,
			IsCharging:  isCharging,
			CPULoad:     cpuLoad,
			Interval:    interval,
		}
	}

	// Rule 4: High Host CPU Load
	if cpuLoad >= HighCPULoadThreshold {
		return GovernorAssessment{
			Allowed:     false,
			Reason:      fmt.Sprintf("Host CPU utilization is high (%.1f%% >= %.1f%%)", cpuLoad, HighCPULoadThreshold),
			Temperature: temp,
			BatteryPct:  battPct,
			IsCharging:  isCharging,
			CPULoad:     cpuLoad,
			Interval:    interval,
		}
	}

	return GovernorAssessment{
		Allowed:     true,
		Reason:      "Hardware conditions optimal for background evolution",
		Temperature: temp,
		BatteryPct:  battPct,
		IsCharging:  isCharging,
		CPULoad:     cpuLoad,
		Interval:    interval,
	}
}
