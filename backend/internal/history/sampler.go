package history

import (
	"context"
	"log/slog"
	"math"
	"time"

	"github.com/ullashroy/poco-server/backend/internal/network"
	"github.com/ullashroy/poco-server/backend/internal/state"
	"github.com/ullashroy/poco-server/backend/internal/storage"
	"github.com/ullashroy/poco-server/backend/internal/thermal"
)

func (s *Service) Sample(ctx context.Context, st *state.State) {
	status := st.Status()

	sample := Sample{
		Timestamp: time.Now().UTC(),
		Hostname:  status.System.Hostname,
		CPU: CPUStats{
			UsagePercent: status.CPU.UsagePercent,
			LogicalCores: status.CPU.LogicalCores,
			FrequencyMHz: float64(status.CPU.FrequencyMHz),
		},
		Memory: MemoryStats{
			Total:        int64(status.Memory.Total),
			Used:         int64(status.Memory.Used),
			Available:    int64(status.Memory.Available),
			UsagePercent: status.Memory.Usage,
		},
		Network: NetworkStats{
			RXBytes: int64(primaryRX(status.Network.Interfaces)),
			TXBytes: int64(primaryTX(status.Network.Interfaces)),
		},
		Thermal: ThermalStats{
			TemperatureMax: maxTemp(status.Thermal.Zones),
		},
	}

	if len(status.Storage.Mounts) > 0 {
		m := rootMount(status.Storage.Mounts)
		sample.Storage = StorageStats{
			Total:        int64(m.Total),
			Used:         int64(m.Used),
			Available:    int64(m.Available),
			UsagePercent: m.UsagePercent,
		}
	}

	if status.Battery.Present {
		sample.Battery = BatteryStats{
			Present:   true,
			Capacity:  float64(status.Battery.Capacity),
			Status:    status.Battery.Status,
			PowerMW:   status.Battery.PowerMW,
			VoltageMV: status.Battery.VoltageMV,
		}
	}

	if err := s.repo.Store(&sample); err != nil {
		slog.Error("history: failed to store sample", "error", err)
	}
}

func (s *Service) RunSampler(ctx context.Context, st *state.State) {
	slog.Info("history: sampler started",
		"interval", s.config.SamplingInterval,
	)

	ticker := time.NewTicker(s.config.SamplingInterval)
	defer ticker.Stop()

	s.Sample(ctx, st)

	for {
		select {
		case <-ctx.Done():
			slog.Info("history: sampler stopped")
			return
		case <-ticker.C:
			s.Sample(ctx, st)
		}
	}
}

func rootMount(mounts []storage.Mount) storage.Mount {
	for _, m := range mounts {
		if m.Mount == "/" {
			return m
		}
	}
	if len(mounts) > 0 {
		return mounts[0]
	}
	return storage.Mount{}
}

func primaryRX(ifaces []network.Interface) uint64 {
	for _, iface := range ifaces {
		if iface.Name == "wlan0" || iface.Name == "tailscale0" {
			return iface.RXBytes
		}
	}
	if len(ifaces) > 0 {
		return ifaces[0].RXBytes
	}
	return 0
}

func primaryTX(ifaces []network.Interface) uint64 {
	for _, iface := range ifaces {
		if iface.Name == "wlan0" || iface.Name == "tailscale0" {
			return iface.TXBytes
		}
	}
	if len(ifaces) > 0 {
		return ifaces[0].TXBytes
	}
	return 0
}

func maxTemp(zones []thermal.Zone) float64 {
	max := 0.0
	for _, z := range zones {
		if z.TemperatureC > max {
			max = z.TemperatureC
		}
	}
	if max == 0 {
		return 0
	}
	return math.Round(max*100) / 100
}
