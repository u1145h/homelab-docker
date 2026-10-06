package history

import "time"

type bucketStats struct {
	count          int
	hostname       string
	cpuUsageSum    float64
	cpuCoresSum    int
	cpuFreqSum     float64
	memUsageSum    float64
	memTotSum      int64
	memUsedSum     int64
	memAvailSum    int64
	storUsageSum   float64
	storTotSum     int64
	storUsedSum    int64
	storAvailSum   int64
	lastRX         int64
	lastTX         int64
	battCapSum     float64
	battPowerSum   int64
	battVoltageSum int64
	battPresentSum int
	battStatus     string
	tempMax        float64
}

func Aggregate(samples []Sample, resolutionSec int) []Sample {
	if len(samples) == 0 || resolutionSec <= 0 {
		return samples
	}

	buckets := make(map[int64]*bucketStats)
	var bucketKeys []int64

	for _, s := range samples {
		bucket := s.Timestamp.Unix() / int64(resolutionSec) * int64(resolutionSec)

		bs, ok := buckets[bucket]
		if !ok {
			bucketKeys = append(bucketKeys, bucket)
			bs = &bucketStats{
				hostname: s.Hostname,
			}
			buckets[bucket] = bs
		}

		bs.count++
		bs.cpuUsageSum += s.CPU.UsagePercent
		bs.cpuCoresSum += s.CPU.LogicalCores
		bs.cpuFreqSum += s.CPU.FrequencyMHz
		bs.memUsageSum += s.Memory.UsagePercent
		bs.memTotSum += s.Memory.Total
		bs.memUsedSum += s.Memory.Used
		bs.memAvailSum += s.Memory.Available
		bs.storUsageSum += s.Storage.UsagePercent
		bs.storTotSum += s.Storage.Total
		bs.storUsedSum += s.Storage.Used
		bs.storAvailSum += s.Storage.Available
		bs.lastRX = s.Network.RXBytes
		bs.lastTX = s.Network.TXBytes
		bs.battCapSum += s.Battery.Capacity
		bs.battPowerSum += int64(s.Battery.PowerMW)
		bs.battVoltageSum += int64(s.Battery.VoltageMV)
		if s.Battery.Present {
			bs.battPresentSum++
		}
		if s.Battery.Status != "" {
			bs.battStatus = s.Battery.Status
		}
		if s.Thermal.TemperatureMax > bs.tempMax {
			bs.tempMax = s.Thermal.TemperatureMax
		}
	}

	result := make([]Sample, 0, len(bucketKeys))
	for _, bk := range bucketKeys {
		bs := buckets[bk]
		avg := func(sum float64) float64 {
			if bs.count == 0 {
				return 0
			}
			return sum / float64(bs.count)
		}

		s := Sample{
			Timestamp: time.Unix(bk, 0).UTC(),
			Hostname:  bs.hostname,
			CPU: CPUStats{
				UsagePercent: avg(bs.cpuUsageSum),
				LogicalCores: bs.cpuCoresSum / bs.count,
				FrequencyMHz: avg(bs.cpuFreqSum),
			},
			Memory: MemoryStats{
				Total:        bs.memTotSum / int64(bs.count),
				Used:         bs.memUsedSum / int64(bs.count),
				Available:    bs.memAvailSum / int64(bs.count),
				UsagePercent: avg(bs.memUsageSum),
			},
			Storage: StorageStats{
				Total:        bs.storTotSum / int64(bs.count),
				Used:         bs.storUsedSum / int64(bs.count),
				Available:    bs.storAvailSum / int64(bs.count),
				UsagePercent: avg(bs.storUsageSum),
			},
			Network: NetworkStats{
				RXBytes: bs.lastRX,
				TXBytes: bs.lastTX,
			},
			Battery: BatteryStats{
				Present:   bs.battPresentSum > bs.count/2,
				Capacity:  avg(bs.battCapSum),
				Status:    bs.battStatus,
				PowerMW:   int(bs.battPowerSum / int64(bs.count)),
				VoltageMV: int(bs.battVoltageSum / int64(bs.count)),
			},
			Thermal: ThermalStats{
				TemperatureMax: bs.tempMax,
			},
		}

		result = append(result, s)
	}

	return result
}
