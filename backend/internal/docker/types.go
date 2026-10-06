package docker

import "context"

type Operation string

const (
	OpContainerList    Operation = "docker.container.list"
	OpContainerInspect Operation = "docker.container.inspect"
	OpContainerStart   Operation = "docker.container.start"
	OpContainerStop    Operation = "docker.container.stop"
	OpContainerRestart Operation = "docker.container.restart"
	OpContainerLogs    Operation = "docker.container.logs"
	OpContainerStats   Operation = "docker.container.stats"
	OpContainerRemove  Operation = "docker.container.remove"
	OpProjectList      Operation = "docker.project.list"
	OpProjectInspect   Operation = "docker.project.inspect"
	OpProjectUp        Operation = "docker.project.up"
	OpProjectDown      Operation = "docker.project.down"
	OpProjectRestart   Operation = "docker.project.restart"
)

type Authorizer interface {
	Authorize(ctx context.Context, username string, op Operation) error
}

type ContainerLister interface {
	ListContainers(ctx context.Context) ([]ContainerSummary, error)
}

type ContainerInspector interface {
	InspectContainer(ctx context.Context, id string) (*ContainerDetail, error)
}

type ContainerLifecycler interface {
	StartContainer(ctx context.Context, id string) error
	StopContainer(ctx context.Context, id string) error
	RestartContainer(ctx context.Context, id string) error
}

type ContainerLogger interface {
	GetContainerLogs(ctx context.Context, id string, tail int) ([]LogEntry, error)
}

type ContainerStatter interface {
	GetContainerStats(ctx context.Context, id string) (*ContainerStatsResult, error)
}

type ContainerRemover interface {
	RemoveContainer(ctx context.Context, id string) error
}

// LogEntry represents a single parsed log line from a container.
type LogEntry struct {
	Timestamp string `json:"timestamp"`
	Level     string `json:"level"`
	Message   string `json:"message"`
}

// ContainerStatsResult holds the computed metrics from a Docker stats snapshot.
type ContainerStatsResult struct {
	CPUPercent float64 `json:"cpu_percent"`
	MemUsed    uint64  `json:"mem_used"`
	MemLimit   uint64  `json:"mem_limit"`
	NetRx      uint64  `json:"net_rx"`
	NetTx      uint64  `json:"net_tx"`
	BlockRead  uint64  `json:"block_read"`
	BlockWrite uint64  `json:"block_write"`
	PIDs       uint64  `json:"pids"`
}

type ContainerSummary struct {
	ID         string            `json:"id"`
	Name       string            `json:"name"`
	Image      string            `json:"image"`
	State      string            `json:"state"`
	Status     string            `json:"status"`
	Labels     map[string]string `json:"labels,omitempty"`
	Project    string            `json:"project,omitempty"`
	Service    string            `json:"service,omitempty"`
	WorkingDir string            `json:"workingDir,omitempty"`
}

type Info struct {
	Containers []ContainerSummary `json:"containers"`
}

type ContainerState struct {
	Status     string  `json:"status"`
	Running    bool    `json:"running"`
	Paused     bool    `json:"paused"`
	Restarting bool    `json:"restarting"`
	Dead       bool    `json:"dead"`
	Pid        int     `json:"pid"`
	ExitCode   int     `json:"exitCode"`
	StartedAt  string  `json:"startedAt"`
	FinishedAt string  `json:"finishedAt"`
	Health     *Health `json:"health,omitempty"`
}

type Health struct {
	Status string `json:"status"`
}

type ContainerDetail struct {
	ID           string            `json:"id"`
	Name         string            `json:"name"`
	Image        string            `json:"image"`
	Command      string            `json:"command"`
	Created      string            `json:"created"`
	RestartCount int               `json:"restartCount"`
	Env          []string          `json:"env,omitempty"`
	State        ContainerState    `json:"state"`
	Mounts       []Mount           `json:"mounts,omitempty"`
	Network      []Network         `json:"network,omitempty"`
	Ports        []Port            `json:"ports,omitempty"`
	Labels       map[string]string `json:"labels,omitempty"`
}

type Mount struct {
	Type        string `json:"type"`
	Source      string `json:"source"`
	Destination string `json:"destination"`
	Mode        string `json:"mode,omitempty"`
	RW          bool   `json:"rw"`
}

type Network struct {
	Name    string `json:"name"`
	IP      string `json:"ip,omitempty"`
	Gateway string `json:"gateway,omitempty"`
}

type Port struct {
	PrivatePort int    `json:"privatePort"`
	PublicPort  int    `json:"publicPort,omitempty"`
	Type        string `json:"type"`
	IP          string `json:"ip,omitempty"`
}

type Project struct {
	Name           string             `json:"name"`
	WorkingDir     string             `json:"workingDir,omitempty"`
	ContainerCount int                `json:"containerCount"`
	Containers     []ContainerSummary `json:"containers,omitempty"`
	Running        bool               `json:"running"`
	Healthy        bool               `json:"healthy"`
}

type ContainerActionResult struct {
	ContainerID   string
	ContainerName string
	Action        string
	Success       bool
	Error         string
}

type ProjectOperationResult struct {
	ProjectName string
	Action      string
	Results     []ContainerActionResult
	Succeeded   int
	Failed      int
	Skipped     int
}
