package scheduler

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/ullashroy/poco-server/backend/internal/battery"
	"github.com/ullashroy/poco-server/backend/internal/cpu"
	"github.com/ullashroy/poco-server/backend/internal/docker"
	"github.com/ullashroy/poco-server/backend/internal/memory"
	"github.com/ullashroy/poco-server/backend/internal/network"
	"github.com/ullashroy/poco-server/backend/internal/processes"
	"github.com/ullashroy/poco-server/backend/internal/state"
	"github.com/ullashroy/poco-server/backend/internal/storage"
	"github.com/ullashroy/poco-server/backend/internal/system"
	"github.com/ullashroy/poco-server/backend/internal/tailscale"
	"github.com/ullashroy/poco-server/backend/internal/thermal"
)

type NotificationEvaluator interface {
	Evaluate(st *state.State)
}

type Scheduler struct {
	state       *state.State
	taskStore   *TaskStore
	taskRunner  *TaskRunner
	notifEngine NotificationEvaluator
	mu          sync.Mutex
	running     map[string]bool
}

func New(st *state.State, taskStore *TaskStore, taskRunner *TaskRunner, notifEngine NotificationEvaluator) *Scheduler {
	return &Scheduler{
		state:       st,
		taskStore:   taskStore,
		taskRunner:  taskRunner,
		notifEngine: notifEngine,
		running:     make(map[string]bool),
	}
}

func (s *Scheduler) Start(ctx context.Context) {
	// 3-second tick: collects all system metrics (CPU, memory, storage, network,
	// docker, thermal, processes, etc.) at a rate that's still snappy for the UI
	// but reduces constant CPU wakeups by ~66% compared to the previous 1s loop.
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	s.collect()

	for {
		select {
		case <-ctx.Done():
			log.Println("scheduler stopped")
			return

		case <-ticker.C:
			s.collect()
			s.checkTasks()
		}
	}
}

func (s *Scheduler) checkTasks() {
	if s.taskStore == nil || s.taskRunner == nil {
		return
	}
	tasks := s.taskStore.List()
	now := time.Now()
	for _, t := range tasks {
		if !t.Enabled {
			continue
		}
		if t.NextRun == nil {
			continue
		}
		if now.Before(*t.NextRun) {
			continue
		}

		s.mu.Lock()
		if s.running[t.ID] {
			s.mu.Unlock()
			continue
		}
		s.running[t.ID] = true
		s.mu.Unlock()

		go func(task TaskDefinition) {
			defer func() {
				s.mu.Lock()
				delete(s.running, task.ID)
				s.mu.Unlock()
			}()
			rec := s.taskRunner.Execute(task)
			s.taskStore.AddExecutionRecord(rec)
			finish := time.Now()
			task.LastRun = &finish
			task.Status = "idle"
			task.NextRun = calculateNextRun(task, finish)
			s.taskStore.Update(task)
		}(t)
	}
}

func (s *Scheduler) collect() {
	sys, err := system.Collect()
	if err == nil {
		s.state.SetSystem(*sys)
	}

	mem, err := memory.Collect()
	if err == nil {
		s.state.SetMemory(*mem)
	}

	stor, err := storage.Collect()
	if err == nil {
		s.state.SetStorage(*stor)
	}

	cpuInfo, err := cpu.Collect()
	if err == nil {
		s.state.SetCPU(*cpuInfo)
	}

	batteryInfo, err := battery.Collect()
	if err == nil {
		s.state.SetBattery(*batteryInfo)
	}

	thermalInfo, err := thermal.Collect()
	if err == nil {
		s.state.SetThermal(*thermalInfo)
	}

	networkInfo, err := network.Collect()
	if err == nil {
		s.state.SetNetwork(*networkInfo)
	}

	dockerInfo, err := docker.Collect()
	if err == nil {
		s.state.SetDocker(*dockerInfo)
	}

	tailscaleInfo, err := tailscale.Collect()
	if err == nil {
		s.state.SetTailscale(*tailscaleInfo)
	}

	processesInfo, err := processes.Collect()
	if err == nil {
		s.state.SetProcesses(*processesInfo)
	}

	if s.notifEngine != nil {
		s.notifEngine.Evaluate(s.state)
	}
}
