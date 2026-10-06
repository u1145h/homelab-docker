package tui

import (
	"strings"
	"testing"

	"github.com/ullashroy/poco-server/backend/internal/battery"
	"github.com/ullashroy/poco-server/backend/internal/cpu"
	"github.com/ullashroy/poco-server/backend/internal/docker"
	"github.com/ullashroy/poco-server/backend/internal/memory"
	"github.com/ullashroy/poco-server/backend/internal/network"
	"github.com/ullashroy/poco-server/backend/internal/state"
	"github.com/ullashroy/poco-server/backend/internal/storage"
	"github.com/ullashroy/poco-server/backend/internal/system"
	"github.com/ullashroy/poco-server/backend/internal/tailscale"
	"github.com/ullashroy/poco-server/backend/internal/thermal"
)

func TestTexturedProgressBar(t *testing.T) {
	tests := []struct {
		percent  float64
		width    int
		contains string
	}{
		{percent: 0, width: 20, contains: "▒"},
		{percent: 50, width: 20, contains: "█"},
		{percent: 100, width: 20, contains: "█"},
		{percent: -10, width: 20, contains: "▒"},
		{percent: 150, width: 20, contains: "█"},
	}

	for _, tt := range tests {
		out := TexturedProgressBar(tt.percent, tt.width, ColorGreen, ColorGreenTrack)
		if len(out) == 0 {
			t.Errorf("TexturedProgressBar(%.1f, %d) returned empty string", tt.percent, tt.width)
		}
		if !strings.Contains(out, tt.contains) {
			t.Errorf("TexturedProgressBar(%.1f, %d) expected to contain %q, got %q", tt.percent, tt.width, tt.contains, out)
		}
	}
}

func TestRenderDashboard(t *testing.T) {
	m := Model{
		Width:  70,
		Height: 35,
		Page:   PageDashboard,
		Status: state.Status{
			System: system.Info{
				Hostname: "poco",
				Uptime:   1080,
				Arch:     "arm64",
			},
			Thermal: thermal.Info{
				Zones: []thermal.Zone{
					{Name: "cpu-thermal", TemperatureC: 55.4},
				},
			},
			CPU: cpu.Info{
				UsagePercent: 9.6,
				LogicalCores: 8,
				FrequencyMHz: 1766,
			},
			Memory: memory.Info{
				Used:  2400000000,
				Total: 5400000000,
				Usage: 43.9,
			},
			Storage: storage.Info{
				Mounts: []storage.Mount{
					{
						Mount:        "/",
						Used:         93100000000,
						Total:        111000000000,
						UsagePercent: 84.0,
					},
				},
			},
			Battery: battery.Info{
				Present:  true,
				Capacity: 99,
				Status:   "Full",
			},
			Network: network.Info{
				Interfaces: []network.Interface{
					{
						Name:      "usb0",
						Addresses: []string{"192.168.42.129"},
					},
				},
			},
			Docker: docker.Info{
				Containers: []docker.ContainerSummary{
					{Name: "c1", State: "running"},
					{Name: "c2", State: "running"},
				},
			},
			Tailscale: tailscale.Info{
				Self: tailscale.Self{
					Hostname: "poco",
					IP:       "100.122.11.42",
				},
			},
		},
	}

	dashboard := RenderDashboard(m)
	if !strings.Contains(dashboard, "KURO") {
		t.Errorf("Dashboard expected to contain 'KURO', got:\n%s", dashboard)
	}
	if !strings.Contains(dashboard, "Hostname") || !strings.Contains(dashboard, "poco") {
		t.Errorf("Dashboard expected to contain Hostname poco, got:\n%s", dashboard)
	}
	if !strings.Contains(dashboard, "CPU") || !strings.Contains(dashboard, "Memory") {
		t.Errorf("Dashboard expected to contain CPU and Memory cards, got:\n%s", dashboard)
	}
	if !strings.Contains(dashboard, "Docker") || !strings.Contains(dashboard, "Tailscale") {
		t.Errorf("Dashboard expected to contain Docker and Tailscale cards, got:\n%s", dashboard)
	}
}

