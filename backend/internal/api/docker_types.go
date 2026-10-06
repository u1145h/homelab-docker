package api

import "github.com/ullashroy/poco-server/backend/internal/docker"

type DockerActionResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type ContainerResponse struct {
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

type ContainerDetailResponse struct {
	ID           string            `json:"id"`
	Name         string            `json:"name"`
	Image        string            `json:"image"`
	Command      string            `json:"command"`
	Created      string            `json:"created"`
	RestartCount int               `json:"restartCount"`
	Env          []string          `json:"env,omitempty"`
	State        StateResponse     `json:"state"`
	Mounts       []MountResponse   `json:"mounts,omitempty"`
	Network      []NetworkResponse `json:"network,omitempty"`
	Ports        []PortResponse    `json:"ports,omitempty"`
	Labels       map[string]string `json:"labels,omitempty"`
	CPUPercent   float64           `json:"cpu_percent"`
	MemUsed      uint64            `json:"mem_used"`
	MemLimit     uint64            `json:"mem_limit"`
	NetRx        uint64            `json:"net_rx"`
	NetTx        uint64            `json:"net_tx"`
	BlockRead    uint64            `json:"block_read"`
	BlockWrite   uint64            `json:"block_write"`
	PIDs         uint64            `json:"pids"`
}

type StateResponse struct {
	Status     string                   `json:"status"`
	Running    bool                     `json:"running"`
	Paused     bool                     `json:"paused"`
	Restarting bool                     `json:"restarting"`
	Dead       bool                     `json:"dead"`
	Pid        int                      `json:"pid"`
	ExitCode   int                      `json:"exitCode"`
	StartedAt  string                   `json:"startedAt"`
	FinishedAt string                   `json:"finishedAt"`
	Health     *ContainerHealthResponse `json:"health,omitempty"`
}

type ContainerHealthResponse struct {
	Status string `json:"status"`
}

type MountResponse struct {
	Type        string `json:"type"`
	Source      string `json:"source"`
	Destination string `json:"destination"`
	Mode        string `json:"mode,omitempty"`
	RW          bool   `json:"rw"`
}

type NetworkResponse struct {
	Name    string `json:"name"`
	IP      string `json:"ip,omitempty"`
	Gateway string `json:"gateway,omitempty"`
}

type PortResponse struct {
	PrivatePort int    `json:"privatePort"`
	PublicPort  int    `json:"publicPort,omitempty"`
	Type        string `json:"type"`
	IP          string `json:"ip,omitempty"`
}

type ProjectResponse struct {
	Name           string              `json:"name"`
	WorkingDir     string              `json:"workingDir,omitempty"`
	ContainerCount int                 `json:"containerCount"`
	Containers     []ContainerResponse `json:"containers,omitempty"`
	Running        bool                `json:"running"`
	Healthy        bool                `json:"healthy"`
}

type ContainerActionResultDTO struct {
	ContainerID   string `json:"containerId"`
	ContainerName string `json:"containerName"`
	Action        string `json:"action"`
	Success       bool   `json:"success"`
	Error         string `json:"error,omitempty"`
}

type ProjectOperationResponse struct {
	ProjectName string                     `json:"projectName"`
	Action      string                     `json:"action"`
	Status      string                     `json:"status"`
	Succeeded   int                        `json:"succeeded"`
	Failed      int                        `json:"failed"`
	Skipped     int                        `json:"skipped"`
	Results     []ContainerActionResultDTO `json:"results"`
}

type ContainerLogResponse struct {
	Timestamp string `json:"timestamp"`
	Level     string `json:"level"`
	Message   string `json:"message"`
}

type ContainerStatsResponse struct {
	CPUPercent float64 `json:"cpu_percent"`
	MemUsed    uint64  `json:"mem_used"`
	MemLimit   uint64  `json:"mem_limit"`
	NetRx      uint64  `json:"net_rx"`
	NetTx      uint64  `json:"net_tx"`
	BlockRead  uint64  `json:"block_read"`
	BlockWrite uint64  `json:"block_write"`
	PIDs       uint64  `json:"pids"`
}

func toContainerResponse(c docker.ContainerSummary) ContainerResponse {
	return ContainerResponse{
		ID:         c.ID,
		Name:       c.Name,
		Image:      c.Image,
		State:      c.State,
		Status:     c.Status,
		Labels:     c.Labels,
		Project:    c.Project,
		Service:    c.Service,
		WorkingDir: c.WorkingDir,
	}
}

func toContainerDetailResponse(d *docker.ContainerDetail) ContainerDetailResponse {
	r := ContainerDetailResponse{
		ID:           d.ID,
		Name:         d.Name,
		Image:        d.Image,
		Command:      d.Command,
		Created:      d.Created,
		RestartCount: d.RestartCount,
		Env:          d.Env,
		State: StateResponse{
			Status:     d.State.Status,
			Running:    d.State.Running,
			Paused:     d.State.Paused,
			Restarting: d.State.Restarting,
			Dead:       d.State.Dead,
			Pid:        d.State.Pid,
			ExitCode:   d.State.ExitCode,
			StartedAt:  d.State.StartedAt,
			FinishedAt: d.State.FinishedAt,
		},
		Labels: d.Labels,
	}
	if d.State.Health != nil {
		r.State.Health = &ContainerHealthResponse{Status: d.State.Health.Status}
	}
	for _, m := range d.Mounts {
		r.Mounts = append(r.Mounts, MountResponse{
			Type:        m.Type,
			Source:      m.Source,
			Destination: m.Destination,
			Mode:        m.Mode,
			RW:          m.RW,
		})
	}
	for _, n := range d.Network {
		r.Network = append(r.Network, NetworkResponse{
			Name:    n.Name,
			IP:      n.IP,
			Gateway: n.Gateway,
		})
	}
	for _, p := range d.Ports {
		r.Ports = append(r.Ports, PortResponse{
			PrivatePort: p.PrivatePort,
			PublicPort:  p.PublicPort,
			Type:        p.Type,
			IP:          p.IP,
		})
	}
	return r
}

func toProjectResponse(p docker.Project) ProjectResponse {
	r := ProjectResponse{
		Name:           p.Name,
		WorkingDir:     p.WorkingDir,
		ContainerCount: p.ContainerCount,
		Running:        p.Running,
		Healthy:        p.Healthy,
	}
	for _, c := range p.Containers {
		r.Containers = append(r.Containers, toContainerResponse(c))
	}
	return r
}

func toProjectOperationResponse(r *docker.ProjectOperationResult) ProjectOperationResponse {
	status := "success"
	if r.Failed > 0 && r.Succeeded > 0 {
		status = "partial"
	} else if r.Failed > 0 {
		status = "failure"
	}
	resp := ProjectOperationResponse{
		ProjectName: r.ProjectName,
		Action:      r.Action,
		Status:      status,
		Succeeded:   r.Succeeded,
		Failed:      r.Failed,
		Skipped:     r.Skipped,
	}
	for _, car := range r.Results {
		resp.Results = append(resp.Results, ContainerActionResultDTO{
			ContainerID:   car.ContainerID,
			ContainerName: car.ContainerName,
			Action:        car.Action,
			Success:       car.Success,
			Error:         car.Error,
		})
	}
	return resp
}
