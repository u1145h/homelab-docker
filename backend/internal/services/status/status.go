package status

import (
	"github.com/ullashroy/poco-server/backend/internal/battery"
	"github.com/ullashroy/poco-server/backend/internal/cpu"
	"github.com/ullashroy/poco-server/backend/internal/docker"
	"github.com/ullashroy/poco-server/backend/internal/memory"
	"github.com/ullashroy/poco-server/backend/internal/network"
	"github.com/ullashroy/poco-server/backend/internal/processes"
	"github.com/ullashroy/poco-server/backend/internal/storage"
	"github.com/ullashroy/poco-server/backend/internal/system"
	"github.com/ullashroy/poco-server/backend/internal/tailscale"
	"github.com/ullashroy/poco-server/backend/internal/thermal"
)

type Status struct {
	System    *system.Info    `json:"system,omitempty"`
	CPU       *cpu.Info       `json:"cpu,omitempty"`
	Memory    *memory.Info    `json:"memory,omitempty"`
	Storage   *storage.Info   `json:"storage,omitempty"`
	Battery   *battery.Info   `json:"battery,omitempty"`
	Thermal   *thermal.Info   `json:"thermal,omitempty"`
	Network   *network.Info   `json:"network,omitempty"`
	Docker    *docker.Info    `json:"docker,omitempty"`
	Tailscale *tailscale.Info `json:"tailscale,omitempty"`
	Processes *processes.Info `json:"processes,omitempty"`
}

func Collect() *Status {
	s := &Status{}

	if v, err := system.Collect(); err == nil {
		s.System = v
	}

	if v, err := cpu.Collect(); err == nil {
		s.CPU = v
	}

	if v, err := memory.Collect(); err == nil {
		s.Memory = v
	}

	if v, err := storage.Collect(); err == nil {
		s.Storage = v
	}

	if v, err := battery.Collect(); err == nil {
		s.Battery = v
	}

	if v, err := thermal.Collect(); err == nil {
		s.Thermal = v
	}

	if v, err := network.Collect(); err == nil {
		s.Network = v
	}

	if v, err := docker.Collect(); err == nil {
		s.Docker = v
	}

	if v, err := tailscale.Collect(); err == nil {
		s.Tailscale = v
	}

	if v, err := processes.Collect(); err == nil {
		s.Processes = v
	}

	return s
}
