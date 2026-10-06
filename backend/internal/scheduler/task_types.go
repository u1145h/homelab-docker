package scheduler

import "time"

type TriggerType string

const (
	TriggerCron     TriggerType = "cron"
	TriggerInterval TriggerType = "interval"
	TriggerOneshot  TriggerType = "oneshot"
)

type ActionType string

const (
	ActionRunCommand     ActionType = "run_command"
	ActionRestartDocker  ActionType = "restart_docker"
	ActionHealthCheck    ActionType = "health_check"
	ActionRefreshStorage ActionType = "refresh_storage"
)

type Trigger struct {
	Type     TriggerType   `json:"type"`
	CronExpr string        `json:"cronExpr,omitempty"`
	Interval time.Duration `json:"interval,omitempty"`
	RunAt    time.Time     `json:"runAt,omitempty"`
}

type Action struct {
	Type ActionType        `json:"type"`
	Args map[string]string `json:"args,omitempty"`
}

type TaskDefinition struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Enabled     bool       `json:"enabled"`
	Trigger     Trigger    `json:"trigger"`
	Action      Action     `json:"action"`
	LastRun     *time.Time `json:"lastRun,omitempty"`
	NextRun     *time.Time `json:"nextRun,omitempty"`
	Status      string     `json:"status"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
}

type ExecutionRecord struct {
	TaskID     string     `json:"taskId"`
	TaskName   string     `json:"taskName"`
	StartedAt  time.Time  `json:"startedAt"`
	FinishedAt *time.Time `json:"finishedAt,omitempty"`
	Success    bool       `json:"success"`
	Message    string     `json:"message,omitempty"`
}
