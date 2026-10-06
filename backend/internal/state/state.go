package state

import (
	"fmt"
	"sync"
	"time"

	"github.com/ullashroy/poco-server/backend/internal/activities"
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

type State struct {
	mu sync.RWMutex

	system    system.Info
	memory    memory.Info
	storage   storage.Info
	cpu       cpu.Info
	battery   battery.Info
	thermal   thermal.Info
	network   network.Info
	docker    docker.Info
	tailscale tailscale.Info
	processes processes.Info

	hostStatus       *Status
	hostSource       string
	lastHostReportAt time.Time

	activities *activities.Store
}

type Status struct {
	System    system.Info    `json:"system"`
	CPU       cpu.Info       `json:"cpu"`
	Memory    memory.Info    `json:"memory"`
	Storage   storage.Info   `json:"storage"`
	Battery   battery.Info   `json:"battery"`
	Thermal   thermal.Info   `json:"thermal"`
	Network   network.Info   `json:"network"`
	Docker    docker.Info    `json:"docker"`
	Tailscale tailscale.Info `json:"tailscale"`
	Processes processes.Info `json:"processes"`
}

func New(as *activities.Store) *State {
	return &State{activities: as}
}

func (s *State) Activities() *activities.Store {
	return s.activities
}

func (s *State) SetSystem(info system.Info) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.system = info
}

func (s *State) System() system.Info {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.system
}

func (s *State) SetMemory(info memory.Info) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.memory = info
}

func (s *State) Memory() memory.Info {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.memory
}

func (s *State) SetStorage(info storage.Info) {
	s.mu.Lock()
	defer s.mu.Unlock()

	oldByMount := make(map[string]storage.Mount)
	for _, m := range s.storage.Mounts {
		oldByMount[m.Mount] = m
	}

	s.storage = info

	for _, m := range info.Mounts {
		old, ok := oldByMount[m.Mount]
		if !ok {
			continue
		}
		if old.UsagePercent < 80 && m.UsagePercent >= 80 {
			s.activities.Publish("storage",
				"Storage critical on "+m.Mount+" ("+fmt.Sprintf("%.0f", m.UsagePercent)+"%)",
				"hard-drive", "#FF7043")
		} else if old.UsagePercent >= 80 && m.UsagePercent < 70 {
			s.activities.Publish("storage",
				"Storage recovered on "+m.Mount,
				"hard-drive", "#4CAF50")
		}
	}
}

func (s *State) Storage() storage.Info {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.storage
}

func (s *State) SetCPU(info cpu.Info) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.cpu = info
}

func (s *State) CPU() cpu.Info {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.cpu
}

func (s *State) SetBattery(info battery.Info) {
	s.mu.Lock()
	defer s.mu.Unlock()

	oldStatus := s.battery.Status

	s.battery = info

	if oldStatus != "" && oldStatus != info.Status {
		s.activities.Publish("battery",
			"Battery "+info.Status,
			"battery-full", "#FFB300")
	}
}

func (s *State) Battery() battery.Info {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.battery
}

func (s *State) SetThermal(info thermal.Info) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.thermal = info
}

func (s *State) Thermal() thermal.Info {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.thermal
}

func (s *State) SetNetwork(info network.Info) {
	s.mu.Lock()
	defer s.mu.Unlock()

	oldUp := make(map[string]bool)
	for _, iface := range s.network.Interfaces {
		oldUp[iface.Name] = iface.Up
	}

	s.network = info

	for _, iface := range info.Interfaces {
		old, ok := oldUp[iface.Name]
		if !ok {
			continue
		}
		if old != iface.Up {
			if iface.Up {
				s.activities.Publish("network",
					"Interface "+iface.Name+" came up",
					"activity", "#26A69A")
			} else {
				s.activities.Publish("network",
					"Interface "+iface.Name+" went down",
					"activity", "#EF5350")
			}
		}
	}
}

func (s *State) Network() network.Info {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.network
}

func (s *State) SetDocker(info docker.Info) {
	s.mu.Lock()
	defer s.mu.Unlock()

	oldStates := make(map[string]string)
	for _, c := range s.docker.Containers {
		oldStates[c.Name] = c.State
	}

	s.docker = info

	for _, c := range info.Containers {
		oldState, ok := oldStates[c.Name]
		if !ok || oldState == c.State {
			continue
		}
		if c.State == "running" {
			s.activities.Publish("docker",
				"Container "+c.Name+" started",
				"container", "#4CAF50")
		} else {
			s.activities.Publish("docker",
				"Container "+c.Name+" stopped",
				"container", "#EF5350")
		}
	}
}

func (s *State) Docker() docker.Info {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.docker
}

func (s *State) SetTailscale(info tailscale.Info) {
	s.mu.Lock()
	defer s.mu.Unlock()

	oldState := s.tailscale.BackendState

	s.tailscale = info

	if oldState != "" && oldState != info.BackendState {
		if info.BackendState == "Running" {
			s.activities.Publish("tailscale",
				"Tailscale came up",
				"globe", "#26A69A")
		} else {
			s.activities.Publish("tailscale",
				"Tailscale went down ("+info.BackendState+")",
				"globe", "#EF5350")
		}
	}
}

func (s *State) Tailscale() tailscale.Info {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.tailscale
}

func (s *State) SetProcesses(info processes.Info) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.processes = info
}

func (s *State) Processes() processes.Info {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.processes
}

func (s *State) SetHostTelemetry(st Status, source string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Fill any missing subsystem info from current container telemetry
	if st.CPU.Model == "" {
		st.CPU.Model = s.cpu.Model
		st.CPU.Cores = s.cpu.Cores
		st.CPU.FrequencyMHz = s.cpu.FrequencyMHz
	} else if st.CPU.FrequencyMHz == 0 {
		st.CPU.FrequencyMHz = s.cpu.FrequencyMHz
	}
	if len(st.Storage.Mounts) == 0 && len(s.storage.Mounts) > 0 {
		st.Storage = s.storage
	}
	if len(st.Thermal.Zones) == 0 && len(s.thermal.Zones) > 0 {
		st.Thermal = s.thermal
	}
	if len(st.Processes.Top) == 0 && len(s.processes.Top) > 0 {
		st.Processes = s.processes
	}
	if len(st.Docker.Containers) == 0 && len(s.docker.Containers) > 0 {
		st.Docker = s.docker
	}
	if st.Tailscale.BackendState == "" && s.tailscale.BackendState != "" {
		st.Tailscale = s.tailscale
	}
	if st.System.Hostname == "" && s.system.Hostname != "" {
		st.System.Hostname = s.system.Hostname
	}
	if len(st.Network.Interfaces) == 0 && len(s.network.Interfaces) > 0 {
		st.Network = s.network
	}

	s.hostStatus = &st
	s.hostSource = source
	s.lastHostReportAt = time.Now()
}

func (s *State) HasActiveHostTelemetry() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.hostStatus != nil && time.Since(s.lastHostReportAt) < 15*time.Second
}

func (s *State) Status() Status {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Prioritize live physical host telemetry if active
	if s.hostStatus != nil && time.Since(s.lastHostReportAt) < 15*time.Second {
		res := *s.hostStatus
		// Preserve container Docker daemon & Tailscale status if host payload didn't include them
		if len(res.Docker.Containers) == 0 && len(s.docker.Containers) > 0 {
			res.Docker = s.docker
		}
		if res.Tailscale.BackendState == "" && s.tailscale.BackendState != "" {
			res.Tailscale = s.tailscale
		}
		return res
	}

	return Status{
		System:    s.system,
		CPU:       s.cpu,
		Memory:    s.memory,
		Storage:   s.storage,
		Battery:   s.battery,
		Thermal:   s.thermal,
		Network:   s.network,
		Docker:    s.docker,
		Tailscale: s.tailscale,
		Processes: s.processes,
	}
}
