package history

import (
	"testing"

	"github.com/ullashroy/poco-server/backend/internal/network"
	"github.com/ullashroy/poco-server/backend/internal/storage"
	"github.com/ullashroy/poco-server/backend/internal/thermal"
)

func TestRootMount(t *testing.T) {
	mounts := []storage.Mount{
		{Mount: "/boot", Total: 500000000, Used: 100000000, Available: 400000000, UsagePercent: 20},
		{Mount: "/", Total: 500000000000, Used: 250000000000, Available: 250000000000, UsagePercent: 50},
	}

	m := rootMount(mounts)
	if m.Mount != "/" {
		t.Errorf("expected root mount '/', got '%s'", m.Mount)
	}
}

func TestRootMountNoRoot(t *testing.T) {
	mounts := []storage.Mount{
		{Mount: "/data", Total: 1000, Used: 500, Available: 500, UsagePercent: 50},
	}

	m := rootMount(mounts)
	if m.Total != 1000 {
		t.Errorf("expected first mount when no root, got total %d", m.Total)
	}
}

func TestRootMountEmpty(t *testing.T) {
	m := rootMount(nil)
	if m.Total != 0 {
		t.Errorf("expected zero-value mount for empty input")
	}
}

func TestPrimaryRXBytes(t *testing.T) {
	ifaces := []network.Interface{
		{Name: "lo", RXBytes: 1000},
		{Name: "wlan0", RXBytes: 50000},
		{Name: "eth0", RXBytes: 2000},
	}

	rx := primaryRX(ifaces)
	if rx != 50000 {
		t.Errorf("expected 50000 for wlan0, got %d", rx)
	}
}

func TestPrimaryTXBytes(t *testing.T) {
	ifaces := []network.Interface{
		{Name: "eth0", TXBytes: 3000},
		{Name: "tailscale0", TXBytes: 80000},
	}

	tx := primaryTX(ifaces)
	if tx != 80000 {
		t.Errorf("expected 80000 for tailscale0, got %d", tx)
	}
}

func TestPrimaryRXBytesEmpty(t *testing.T) {
	rx := primaryRX(nil)
	if rx != 0 {
		t.Errorf("expected 0 for empty interfaces, got %d", rx)
	}
}

func TestMaxTemp(t *testing.T) {
	zones := []thermal.Zone{
		{Name: "cpu0", TemperatureC: 45.0},
		{Name: "cpu1", TemperatureC: 65.5},
		{Name: "gpu", TemperatureC: 55.0},
	}

	max := maxTemp(zones)
	if max != 65.5 {
		t.Errorf("expected 65.5, got %f", max)
	}
}

func TestMaxTempEmpty(t *testing.T) {
	max := maxTemp(nil)
	if max != 0 {
		t.Errorf("expected 0 for empty zones, got %f", max)
	}
}
