package battery

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/ullashroy/poco-server/backend/internal/system"
)

type SubsystemPower struct {
	Name    string  `json:"name"`
	PowerMW float64 `json:"power_mw"`
	Percent int     `json:"percent"`
}

type CellInfo struct {
	ID       string  `json:"id"`
	VoltageV float64 `json:"voltage_v"`
}

type PowerEvent struct {
	Event   string `json:"event"`
	Time    string `json:"time"`
	Details string `json:"details"`
}

type PowerRail struct {
	Name     string  `json:"name"`
	VoltageV float64 `json:"voltage_v"`
	CurrentA float64 `json:"current_a"`
	PowerW   float64 `json:"power_w"`
	State    string  `json:"state"`
}

type Info struct {
	Present      bool    `json:"present"`
	Status       string  `json:"status"`
	Capacity     int     `json:"capacity"`
	Health       string  `json:"health"`
	Technology   string  `json:"technology"`
	VoltageMV    int     `json:"voltage_mv"`
	CurrentMA    int     `json:"current_ma"`
	PowerMW      int     `json:"power_mw"`
	TemperatureC float64 `json:"temperature_c"`

	CycleCount          int     `json:"cycle_count"`
	DesignCapacityWH    float64 `json:"design_capacity_wh"`
	FullCapacityWH      float64 `json:"full_capacity_wh"`
	RemainingCapacityWH float64 `json:"remaining_capacity_wh"`
	WearLevelPercent    int     `json:"wear_level_percent"`
	TimeToFullMin       int     `json:"time_to_full_min"`
	RuntimeLeftMin      int     `json:"runtime_left_min"`

	EnergyConsumedKWH    float64 `json:"energy_consumed_kwh"`
	EnergyFromGridKWH    float64 `json:"energy_from_grid_kwh"`
	EnergyFromBatteryKWH float64 `json:"energy_from_battery_kwh"`
	EstimatedCost        float64 `json:"estimated_cost"`

	Subsystems []SubsystemPower `json:"subsystems"`

	Cells       []CellInfo `json:"cells"`
	CellDeltaMV int        `json:"cell_delta_mv"`
	Balancing   string     `json:"balancing"`
	BMSState    string     `json:"bms_state"`

	PowerSource      string       `json:"power_source"`
	AdapterVoltageV  float64      `json:"adapter_voltage_v"`
	AdapterCurrentA  float64      `json:"adapter_current_a"`
	AdapterMaxPowerW float64      `json:"adapter_max_power_w"`
	InputVoltageV    float64      `json:"input_voltage_v"`
	UPSLoadPercent   int          `json:"ups_load_percent"`
	UPSRuntimeMin    int          `json:"ups_runtime_min"`
	AdapterTempC     float64      `json:"adapter_temp_c"`
	SOCPowerW        float64      `json:"soc_power_w"`
	Outages24H       int          `json:"outages_24h"`
	PowerEvents      []PowerEvent `json:"power_events"`

	PowerRails []PowerRail `json:"power_rails"`
}

func Collect() (*Info, error) {
	dir, err := batteryPath()
	if err != nil {
		return &Info{Present: false, Status: "Discharging"}, nil
	}

	info := &Info{}

	info.Present = readBool(filepath.Join(dir, "present"))
	info.Status = readString(filepath.Join(dir, "status"))
	info.Health = readString(filepath.Join(dir, "health"))
	info.Technology = readString(filepath.Join(dir, "technology"))
	info.Capacity = readInt(filepath.Join(dir, "capacity"))

	// µV → mV
	voltageNow := readInt(filepath.Join(dir, "voltage_now"))
	info.VoltageMV = voltageNow / 1000

	// µA → mA (can be negative on discharge in sysfs)
	currentNow := readInt(filepath.Join(dir, "current_now"))
	if currentNow < 0 {
		currentNow = -currentNow
	}
	info.CurrentMA = currentNow / 1000

	// µW → mW (can be negative or 0 in sysfs)
	powerNow := readInt(filepath.Join(dir, "power_now"))
	if powerNow < 0 {
		powerNow = -powerNow
	}
	if powerNow == 0 && voltageNow > 0 && currentNow > 0 {
		powerNow = int((int64(voltageNow) * int64(currentNow)) / 1000000)
	}
	info.PowerMW = powerNow / 1000

	temp := readInt(filepath.Join(dir, "temp"))
	if temp != 0 {
		info.TemperatureC = float64(temp) / 10.0
	}

	info.CycleCount = readInt(filepath.Join(dir, "cycle_count"))

	voltageV := float64(voltageNow) / 1000000.0

	energyFullDesign := readInt(filepath.Join(dir, "energy_full_design"))
	chargeFullDesign := readInt(filepath.Join(dir, "charge_full_design"))
	energyFull := readInt(filepath.Join(dir, "energy_full"))
	chargeFull := readInt(filepath.Join(dir, "charge_full"))
	energyNow := readInt(filepath.Join(dir, "energy_now"))
	chargeNow := readInt(filepath.Join(dir, "charge_now"))

	if energyFullDesign > 0 {
		info.DesignCapacityWH = float64(energyFullDesign) / 1000000.0
	} else if chargeFullDesign > 0 && voltageV > 0 {
		info.DesignCapacityWH = (float64(chargeFullDesign) / 1000000.0) * voltageV
	}

	if energyFull > 0 {
		info.FullCapacityWH = float64(energyFull) / 1000000.0
	} else if chargeFull > 0 && voltageV > 0 {
		info.FullCapacityWH = (float64(chargeFull) / 1000000.0) * voltageV
	}

	if energyNow > 0 {
		info.RemainingCapacityWH = float64(energyNow) / 1000000.0
	} else if chargeNow > 0 && voltageV > 0 {
		info.RemainingCapacityWH = (float64(chargeNow) / 1000000.0) * voltageV
	}

	if info.DesignCapacityWH > 0 && info.FullCapacityWH > 0 {
		info.WearLevelPercent = int(100.0 - ((info.FullCapacityWH / info.DesignCapacityWH) * 100.0))
		if info.WearLevelPercent < 0 {
			info.WearLevelPercent = 0
		}
	}

	powerW := float64(info.PowerMW) / 1000.0
	if powerW > 0 {
		if strings.EqualFold(info.Status, "Charging") && info.FullCapacityWH > info.RemainingCapacityWH {
			hoursToFull := (info.FullCapacityWH - info.RemainingCapacityWH) / powerW
			info.TimeToFullMin = int(hoursToFull * 60)
		} else if strings.EqualFold(info.Status, "Discharging") && info.RemainingCapacityWH > 0 {
			hoursLeft := info.RemainingCapacityWH / powerW
			info.RuntimeLeftMin = int(hoursLeft * 60)
		}
	}

	// Initialize empty arrays so they are never nil in JSON
	info.Subsystems = []SubsystemPower{}
	info.Cells = []CellInfo{}
	info.PowerEvents = []PowerEvent{}
	info.PowerRails = []PowerRail{}

	// Check for AC Adapter / USB Charger
	info.PowerSource = "Battery"
	entries, _ := os.ReadDir(system.SysPath("class/power_supply"))
	for _, e := range entries {
		path := filepath.Join(system.SysPath("class/power_supply"), e.Name())
		supplyType := readString(filepath.Join(path, "type"))
		if supplyType != "Battery" {
			if readInt(filepath.Join(path, "online")) == 1 {
				if supplyType == "USB" || supplyType == "USB_PD" || supplyType == "USB_DCP" || supplyType == "USB_CDP" || supplyType == "USB_C" {
					info.PowerSource = "USB-C / Charger connected"
				} else if supplyType == "Wireless" {
					info.PowerSource = "Wireless charger connected"
				} else {
					info.PowerSource = "AC adapter connected"
				}
				info.InputVoltageV = float64(readInt(filepath.Join(path, "voltage_now"))) / 1000000.0
				info.AdapterCurrentA = float64(readInt(filepath.Join(path, "current_max"))) / 1000000.0
				if info.AdapterCurrentA == 0 {
					info.AdapterCurrentA = float64(readInt(filepath.Join(path, "current_now"))) / 1000000.0
				}
				info.AdapterVoltageV = info.InputVoltageV

				chargerPowerNow := readInt(filepath.Join(path, "power_now"))
				if chargerPowerNow > 0 {
					info.AdapterMaxPowerW = float64(chargerPowerNow) / 1000000.0
				} else {
					info.AdapterMaxPowerW = info.AdapterVoltageV * info.AdapterCurrentA
				}
				break
			}
		}
	}
	return info, nil
}

func batteryPath() (string, error) {
	entries, err := os.ReadDir(system.SysPath("class/power_supply"))
	if err != nil {
		return "", err
	}

	for _, e := range entries {
		path := filepath.Join(system.SysPath("class/power_supply"), e.Name())

		if readString(filepath.Join(path, "type")) == "Battery" {
			return path, nil
		}
	}

	return "", os.ErrNotExist
}

func readString(path string) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}

	return strings.TrimSpace(string(data))
}

func readInt(path string) int {
	s := readString(path)

	v, err := strconv.Atoi(s)
	if err != nil {
		return 0
	}

	return v
}

func readBool(path string) bool {
	return readInt(path) == 1
}
