package thermal

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/ullashroy/poco-server/backend/internal/system"
)

type TripPoint struct {
	Type         string  `json:"type"`
	TemperatureC float64 `json:"temperature_c"`
}

type Zone struct {
	Name         string      `json:"name"`
	TemperatureC float64     `json:"temperature_c"`
	Policy       string      `json:"policy"`
	Trips        []TripPoint `json:"trips"`
}

type CoolingDevice struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	CurState int    `json:"cur_state"`
	MaxState int    `json:"max_state"`
}

type Info struct {
	Zones          []Zone          `json:"zones"`
	CoolingDevices []CoolingDevice `json:"cooling_devices"`
}

func readString(path string) string {
	b, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(b))
}

func readInt(path string) int {
	b, err := os.ReadFile(path)
	if err != nil {
		return 0
	}
	v, _ := strconv.Atoi(strings.TrimSpace(string(b)))
	return v
}

func Collect() (*Info, error) {
	info := &Info{
		Zones:          []Zone{},
		CoolingDevices: []CoolingDevice{},
	}

	dirs, err := filepath.Glob(filepath.Join(system.SysPath("class/thermal"), "thermal_zone*"))
	if err == nil {
		for _, dir := range dirs {
			tempMilli := readInt(filepath.Join(dir, "temp"))
			z := Zone{
				Name:         readString(filepath.Join(dir, "type")),
				TemperatureC: float64(tempMilli) / 1000.0,
				Policy:       readString(filepath.Join(dir, "policy")),
				Trips:        []TripPoint{},
			}
			if z.Name == "" {
				continue
			}

			for i := 0; i < 20; i++ {
				tType := readString(filepath.Join(dir, "trip_point_"+strconv.Itoa(i)+"_type"))
				if tType == "" {
					break // usually consecutive
				}
				tTempMilli := readInt(filepath.Join(dir, "trip_point_"+strconv.Itoa(i)+"_temp"))
				z.Trips = append(z.Trips, TripPoint{
					Type:         tType,
					TemperatureC: float64(tTempMilli) / 1000.0,
				})
			}
			info.Zones = append(info.Zones, z)
		}
	}

	coolDirs, err := filepath.Glob(filepath.Join(system.SysPath("class/thermal"), "cooling_device*"))
	if err == nil {
		for _, dir := range coolDirs {
			cType := readString(filepath.Join(dir, "type"))
			if cType == "" {
				continue
			}
			c := CoolingDevice{
				Name:     filepath.Base(dir),
				Type:     cType,
				CurState: readInt(filepath.Join(dir, "cur_state")),
				MaxState: readInt(filepath.Join(dir, "max_state")),
			}
			info.CoolingDevices = append(info.CoolingDevices, c)
		}
	}

	return info, nil
}
