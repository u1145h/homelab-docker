package scheduler

import (
	"context"
	"fmt"
	"os/exec"
	"time"

	"github.com/ullashroy/poco-server/backend/internal/docker"
	"github.com/ullashroy/poco-server/backend/internal/jobs"
	"github.com/ullashroy/poco-server/backend/internal/state"
	"github.com/ullashroy/poco-server/backend/internal/storage"
)

type TaskRunner struct {
	docker docker.ContainerLifecycler
	store  *jobs.Store
	st     *state.State
}

func NewTaskRunner(dockerSvc docker.ContainerLifecycler, store *jobs.Store, st *state.State) *TaskRunner {
	return &TaskRunner{docker: dockerSvc, store: store, st: st}
}

func (r *TaskRunner) Execute(task TaskDefinition) ExecutionRecord {
	jobID := r.store.AddJob(task.Name, "Automation")
	start := time.Now()

	rec := ExecutionRecord{
		TaskID:    task.ID,
		TaskName:  task.Name,
		StartedAt: start,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var err error

	switch task.Action.Type {
	case ActionRunCommand:
		err = r.execCommand(ctx, task.Action.Args["command"])
	case ActionRestartDocker:
		err = r.restartDocker(ctx, task.Action.Args["container_id"])
	case ActionHealthCheck:
		err = r.checkHealth(ctx)
	case ActionRefreshStorage:
		err = r.refreshStorage(ctx)
	default:
		err = fmt.Errorf("unknown action type: %s", task.Action.Type)
	}

	finish := time.Now()
	rec.FinishedAt = &finish

	if err != nil {
		rec.Success = false
		rec.Message = err.Error()
		r.store.FailJob(jobID, err.Error())
		r.store.AddNotification(jobs.SevError, "Automation", "Task '"+task.Name+"' failed: "+err.Error())
	} else {
		rec.Success = true
		rec.Message = "Completed"
		r.store.CompleteJob(jobID)
		r.store.AddNotification(jobs.SevSuccess, "Automation", "Task '"+task.Name+"' completed")
	}

	return rec
}

func (r *TaskRunner) execCommand(ctx context.Context, cmd string) error {
	if cmd == "" {
		return fmt.Errorf("no command specified")
	}
	c := exec.CommandContext(ctx, "sh", "-c", cmd)
	out, err := c.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s: %s", err.Error(), string(out))
	}
	return nil
}

func (r *TaskRunner) restartDocker(ctx context.Context, containerID string) error {
	if containerID == "" {
		return fmt.Errorf("no container ID specified")
	}
	return r.docker.RestartContainer(ctx, containerID)
}

func (r *TaskRunner) checkHealth(ctx context.Context) error {
	status := r.st.Status()
	if status.System.Uptime <= 0 && status.System.Hostname == "" {
		return fmt.Errorf("system not reporting")
	}
	_ = ctx
	return nil
}

func (r *TaskRunner) refreshStorage(ctx context.Context) error {
	info, err := storage.Collect()
	if err != nil {
		return fmt.Errorf("storage refresh failed: %w", err)
	}
	r.st.SetStorage(*info)
	_ = ctx
	return nil
}
