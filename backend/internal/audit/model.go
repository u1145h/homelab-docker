package audit

import "time"

type Action string

const (
	ActionUserCreate       Action = "user.create"
	ActionUserUpdate       Action = "user.update"
	ActionUserDelete       Action = "user.delete"
	ActionUserLogin        Action = "user.login"
	ActionUserPassword     Action = "user.password_change"
	ActionContainerStart   Action = "container.start"
	ActionContainerStop    Action = "container.stop"
	ActionContainerRestart Action = "container.restart"
	ActionProjectUp        Action = "project.up"
	ActionProjectDown      Action = "project.down"
	ActionProjectRestart   Action = "project.restart"
	ActionSessionOpen      Action = "session.open"
	ActionSessionClose     Action = "session.close"
	ActionSessionTimeout   Action = "session.timeout"
	ActionFileCreate       Action = "file.create"
	ActionFileUpdate       Action = "file.update"
	ActionFileDelete       Action = "file.delete"
	ActionFileRename       Action = "file.rename"
	ActionFileMove         Action = "file.move"
	ActionFileCopy         Action = "file.copy"
	ActionSystemReboot     Action = "system.reboot"
	ActionSystemShutdown   Action = "system.shutdown"
)

type Status string

const (
	StatusSuccess Status = "success"
	StatusWarning Status = "warning"
	StatusFailure Status = "failure"
)

type AuditConfig struct {
	RetentionDays  int    `json:"retention_days"`
	StorageBackend string `json:"storage_backend"`
	StreamTargets  string `json:"stream_targets"`
}

type Entry struct {
	ID        string         `json:"id"`
	Action    Action         `json:"action"`
	Actor     string         `json:"actor"`
	Target    string         `json:"target,omitempty"`
	Status    Status         `json:"status"`
	Message   string         `json:"message,omitempty"`
	Metadata  map[string]any `json:"metadata,omitempty"`
	Timestamp time.Time      `json:"timestamp"`
}

type LogRequest struct {
	Action   Action
	Actor    string
	Target   string
	Status   Status
	Message  string
	Metadata map[string]any
}

const DefaultPageSize = 100

var validActions = map[Action]bool{
	ActionUserCreate:       true,
	ActionUserUpdate:       true,
	ActionUserDelete:       true,
	ActionUserLogin:        true,
	ActionUserPassword:     true,
	ActionContainerStart:   true,
	ActionContainerStop:    true,
	ActionContainerRestart: true,
	ActionProjectUp:        true,
	ActionProjectDown:      true,
	ActionProjectRestart:   true,
	ActionSessionOpen:      true,
	ActionSessionClose:     true,
	ActionSessionTimeout:   true,
	ActionFileCreate:       true,
	ActionFileUpdate:       true,
	ActionFileDelete:       true,
	ActionFileRename:       true,
	ActionFileMove:         true,
	ActionFileCopy:         true,
	ActionSystemReboot:     true,
	ActionSystemShutdown:   true,
}

func IsValidAction(a Action) bool {
	return validActions[a]
}

type AuditFilter struct {
	Offset int
	Limit  int
	Action Action
}
