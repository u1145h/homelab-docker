package docker

import (
	"bufio"
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"
)

type ClientConfig struct {
	SocketPath     string
	RequestTimeout time.Duration
	ActionTimeout  time.Duration
}

func DefaultClientConfig() ClientConfig {
	return ClientConfig{
		SocketPath:     "/var/run/docker.sock",
		RequestTimeout: 30 * time.Second,
		ActionTimeout:  60 * time.Second,
	}
}

type dockerContainerJSON struct {
	ID     string            `json:"Id"`
	Names  []string          `json:"Names"`
	Image  string            `json:"Image"`
	State  string            `json:"State"`
	Status string            `json:"Status"`
	Labels map[string]string `json:"Labels"`
}

type dockerInspectJSON struct {
	ID           string   `json:"Id"`
	Name         string   `json:"Name"`
	Image        string   `json:"Image"`
	Path         string   `json:"Path"`
	Args         []string `json:"Args"`
	Created      string   `json:"Created"`
	RestartCount int      `json:"RestartCount"`
	Config       struct {
		Labels map[string]string `json:"Labels"`
		Env    []string          `json:"Env"`
	} `json:"Config"`
	State struct {
		Status     string `json:"Status"`
		Running    bool   `json:"Running"`
		Paused     bool   `json:"Paused"`
		Restarting bool   `json:"Restarting"`
		Dead       bool   `json:"Dead"`
		Pid        int    `json:"Pid"`
		ExitCode   int    `json:"ExitCode"`
		StartedAt  string `json:"StartedAt"`
		FinishedAt string `json:"FinishedAt"`
		Health     *struct {
			Status string `json:"Status"`
		} `json:"Health"`
	} `json:"State"`
	NetworkSettings *dockerNetworkJSON `json:"NetworkSettings"`
	Mounts          []dockerMountJSON  `json:"Mounts"`
	Ports           []dockerPortJSON   `json:"Ports"`
}

type dockerNetworkJSON struct {
	Networks map[string]struct {
		IP      string `json:"IPAddress"`
		Gateway string `json:"Gateway"`
	} `json:"Networks"`
}

type dockerMountJSON struct {
	Type        string `json:"Type"`
	Source      string `json:"Source"`
	Destination string `json:"Destination"`
	Mode        string `json:"Mode"`
	RW          bool   `json:"RW"`
}

type dockerPortJSON struct {
	PrivatePort int    `json:"PrivatePort"`
	PublicPort  int    `json:"PublicPort"`
	Type        string `json:"Type"`
	IP          string `json:"IP"`
}

type unixSocketClient struct {
	http       *http.Client
	socketPath string
	apiVersion string
	negotiated bool
}

func NewUnixSocketClient(cfg ClientConfig) *unixSocketClient {
	return &unixSocketClient{
		socketPath: cfg.SocketPath,
		http: &http.Client{
			Timeout: cfg.ActionTimeout,
			Transport: &http.Transport{
				DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
					return net.Dial("unix", cfg.SocketPath)
				},
			},
		},
	}
}

func (c *unixSocketClient) negotiateVersion(ctx context.Context) error {
	if c.negotiated {
		return nil
	}
	var version struct {
		APIVersion string `json:"ApiVersion"`
	}
	if err := c.do(ctx, http.MethodGet, "/version", nil, &version); err != nil {
		c.apiVersion = "1.24"
		c.negotiated = true
		return nil
	}
	c.apiVersion = version.APIVersion
	c.negotiated = true
	return nil
}

func (c *unixSocketClient) apiPath(path string) string {
	if c.apiVersion != "" {
		return fmt.Sprintf("/v%s%s", c.apiVersion, path)
	}
	return path
}

func (c *unixSocketClient) do(ctx context.Context, method, path string, body io.Reader, out any) error {
	req, err := http.NewRequestWithContext(ctx, method, "http://docker"+c.apiPath(path), body)
	if err != nil {
		return err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return &DockerAPIError{StatusCode: 0, Message: fmt.Sprintf("connection failed: %v", err)}
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotModified {
		return nil
	}
	if resp.StatusCode == http.StatusNotFound {
		return &DockerAPIError{StatusCode: 404, Message: "not found"}
	}
	if resp.StatusCode >= http.StatusBadRequest {
		data, _ := io.ReadAll(resp.Body)
		msg := strings.TrimSpace(string(data))
		if msg == "" {
			msg = resp.Status
		}
		return &DockerAPIError{StatusCode: resp.StatusCode, Message: msg}
	}
	if out == nil {
		_, _ = io.Copy(io.Discard, resp.Body)
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

func (c *unixSocketClient) ListContainers(ctx context.Context) ([]ContainerSummary, error) {
	if err := c.negotiateVersion(ctx); err != nil {
		return nil, err
	}
	var raw []dockerContainerJSON
	if err := c.do(ctx, http.MethodGet, "/containers/json?all=1", nil, &raw); err != nil {
		return nil, err
	}
	containers := make([]ContainerSummary, 0, len(raw))
	for _, r := range raw {
		name := ""
		if len(r.Names) > 0 {
			name = r.Names[0]
			if len(name) > 0 && name[0] == '/' {
				name = name[1:]
			}
		}
		containers = append(containers, ContainerSummary{
			ID:         r.ID,
			Name:       name,
			Image:      r.Image,
			State:      r.State,
			Status:     r.Status,
			Labels:     r.Labels,
			Project:    r.Labels["com.docker.compose.project"],
			Service:    r.Labels["com.docker.compose.service"],
			WorkingDir: r.Labels["com.docker.compose.project.working_dir"],
		})
	}
	return containers, nil
}

func (c *unixSocketClient) InspectContainer(ctx context.Context, id string) (*ContainerDetail, error) {
	if err := c.negotiateVersion(ctx); err != nil {
		return nil, err
	}
	var raw dockerInspectJSON
	if err := c.do(ctx, http.MethodGet, fmt.Sprintf("/containers/%s/json", id), nil, &raw); err != nil {
		return nil, err
	}
	name := raw.Name
	if len(name) > 0 && name[0] == '/' {
		name = name[1:]
	}
	command := raw.Path
	for _, arg := range raw.Args {
		command += " " + arg
	}
	detail := &ContainerDetail{
		ID:           raw.ID,
		Name:         name,
		Image:        raw.Image,
		Command:      command,
		Created:      raw.Created,
		RestartCount: raw.RestartCount,
		Env:          raw.Config.Env,
		Labels:       raw.Config.Labels,
	}
	detail.State.Status = raw.State.Status
	detail.State.Running = raw.State.Running
	detail.State.Paused = raw.State.Paused
	detail.State.Restarting = raw.State.Restarting
	detail.State.Dead = raw.State.Dead
	detail.State.Pid = raw.State.Pid
	detail.State.ExitCode = raw.State.ExitCode
	detail.State.StartedAt = raw.State.StartedAt
	detail.State.FinishedAt = raw.State.FinishedAt
	if raw.State.Health != nil {
		detail.State.Health = &Health{Status: raw.State.Health.Status}
	}
	if raw.NetworkSettings != nil {
		for netName, n := range raw.NetworkSettings.Networks {
			detail.Network = append(detail.Network, Network{
				Name:    netName,
				IP:      n.IP,
				Gateway: n.Gateway,
			})
		}
	}
	for _, m := range raw.Mounts {
		detail.Mounts = append(detail.Mounts, Mount{
			Type:        m.Type,
			Source:      m.Source,
			Destination: m.Destination,
			Mode:        m.Mode,
			RW:          m.RW,
		})
	}
	for _, p := range raw.Ports {
		detail.Ports = append(detail.Ports, Port{
			PrivatePort: p.PrivatePort,
			PublicPort:  p.PublicPort,
			Type:        p.Type,
			IP:          p.IP,
		})
	}
	return detail, nil
}

func (c *unixSocketClient) StartContainer(ctx context.Context, id string) error {
	if err := c.negotiateVersion(ctx); err != nil {
		return err
	}
	return c.do(ctx, http.MethodPost, fmt.Sprintf("/containers/%s/start", id), nil, nil)
}

func (c *unixSocketClient) StopContainer(ctx context.Context, id string) error {
	if err := c.negotiateVersion(ctx); err != nil {
		return err
	}
	return c.do(ctx, http.MethodPost, fmt.Sprintf("/containers/%s/stop", id), nil, nil)
}

func (c *unixSocketClient) RestartContainer(ctx context.Context, id string) error {
	if err := c.negotiateVersion(ctx); err != nil {
		return err
	}
	return c.do(ctx, http.MethodPost, fmt.Sprintf("/containers/%s/restart", id), nil, nil)
}

func (c *unixSocketClient) RemoveContainer(ctx context.Context, id string) error {
	if err := c.negotiateVersion(ctx); err != nil {
		return err
	}
	return c.do(ctx, http.MethodDelete, fmt.Sprintf("/containers/%s?force=true", id), nil, nil)
}

// doRaw performs an HTTP request and returns the raw response body.
func (c *unixSocketClient) doRaw(ctx context.Context, method, path string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, method, "http://docker"+c.apiPath(path), nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, &DockerAPIError{StatusCode: 0, Message: fmt.Sprintf("connection failed: %v", err)}
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return nil, &DockerAPIError{StatusCode: 404, Message: "not found"}
	}
	if resp.StatusCode >= http.StatusBadRequest {
		data, _ := io.ReadAll(resp.Body)
		return nil, &DockerAPIError{StatusCode: resp.StatusCode, Message: strings.TrimSpace(string(data))}
	}
	return io.ReadAll(resp.Body)
}

// GetContainerLogs fetches container logs via the Docker multiplexed stream format.
// Docker log stream header: [stream_type(1), padding(3), frame_size_big_endian(4)]
func (c *unixSocketClient) GetContainerLogs(ctx context.Context, id string, tail int) ([]LogEntry, error) {
	if err := c.negotiateVersion(ctx); err != nil {
		return nil, err
	}
	path := fmt.Sprintf("/containers/%s/logs?stdout=1&stderr=1&timestamps=1&tail=%d", id, tail)
	body, err := c.doRaw(ctx, http.MethodGet, path)
	if err != nil {
		return nil, err
	}

	var entries []LogEntry
	reader := bufio.NewReader(strings.NewReader(string(body)))
	header := make([]byte, 8)
	for {
		_, err := io.ReadFull(reader, header)
		if err != nil {
			break // EOF or short read
		}
		streamType := header[0] // 1=stdout, 2=stderr
		frameSize := binary.BigEndian.Uint32(header[4:8])
		if frameSize == 0 {
			continue
		}
		frameBuf := make([]byte, frameSize)
		if _, err := io.ReadFull(reader, frameBuf); err != nil {
			break
		}
		line := strings.TrimRight(string(frameBuf), "\n\r")
		if line == "" {
			continue
		}

		// Docker timestamps format: "2006-01-02T15:04:05.000000000Z message..."
		ts := ""
		msg := line
		if len(line) > 30 && line[4] == '-' {
			spIdx := strings.Index(line, " ")
			if spIdx > 0 {
				ts = line[:spIdx]
				msg = line[spIdx+1:]
			}
		}

		level := "info"
		if streamType == 2 {
			level = "error"
		}
		// Detect warn/error keywords in message
		lower := strings.ToLower(msg)
		if strings.Contains(lower, "warn") {
			level = "warn"
		} else if strings.Contains(lower, "error") || strings.Contains(lower, "fatal") || strings.Contains(lower, "panic") {
			level = "error"
		} else if strings.Contains(lower, "debug") {
			level = "debug"
		}

		entries = append(entries, LogEntry{
			Timestamp: ts,
			Level:     level,
			Message:   msg,
		})
	}
	return entries, nil
}

// dockerStatsJSON holds the raw Docker stats snapshot structure.
type dockerStatsJSON struct {
	CPUStats struct {
		CPUUsage struct {
			TotalUsage uint64 `json:"total_usage"`
		} `json:"cpu_usage"`
		SystemCPUUsage uint64 `json:"system_cpu_usage"`
		OnlineCPUs     int    `json:"online_cpus"`
	} `json:"cpu_stats"`
	PreCPUStats struct {
		CPUUsage struct {
			TotalUsage uint64 `json:"total_usage"`
		} `json:"cpu_usage"`
		SystemCPUUsage uint64 `json:"system_cpu_usage"`
	} `json:"precpu_stats"`
	MemoryStats struct {
		Usage uint64 `json:"usage"`
		Limit uint64 `json:"limit"`
		Stats struct {
			Cache uint64 `json:"cache"`
		} `json:"stats"`
	} `json:"memory_stats"`
	Networks map[string]struct {
		RxBytes uint64 `json:"rx_bytes"`
		TxBytes uint64 `json:"tx_bytes"`
	} `json:"networks"`
	BlkioStats struct {
		IOServiceBytesRecursive []struct {
			Op    string `json:"op"`
			Value uint64 `json:"value"`
		} `json:"io_service_bytes_recursive"`
	} `json:"blkio_stats"`
	PidsStats struct {
		Current uint64 `json:"current"`
	} `json:"pids_stats"`
}

// GetContainerStats fetches a single non-streaming stats snapshot from Docker.
func (c *unixSocketClient) GetContainerStats(ctx context.Context, id string) (*ContainerStatsResult, error) {
	if err := c.negotiateVersion(ctx); err != nil {
		return nil, err
	}
	var raw dockerStatsJSON
	if err := c.do(ctx, http.MethodGet, fmt.Sprintf("/containers/%s/stats?stream=false&one-shot=true", id), nil, &raw); err != nil {
		return nil, err
	}

	// CPU %
	cpuDelta := float64(raw.CPUStats.CPUUsage.TotalUsage) - float64(raw.PreCPUStats.CPUUsage.TotalUsage)
	sysDelta := float64(raw.CPUStats.SystemCPUUsage) - float64(raw.PreCPUStats.SystemCPUUsage)
	numCPU := raw.CPUStats.OnlineCPUs
	if numCPU == 0 {
		numCPU = 1
	}
	var cpuPercent float64
	if sysDelta > 0 && cpuDelta > 0 {
		cpuPercent = (cpuDelta / sysDelta) * float64(numCPU) * 100.0
	}

	// Memory — subtract cache for real usage (cgroup v1). For cgroup v2, cache may be 0.
	memUsed := raw.MemoryStats.Usage
	if raw.MemoryStats.Stats.Cache < memUsed {
		memUsed -= raw.MemoryStats.Stats.Cache
	}

	// Network totals across all interfaces
	var netRx, netTx uint64
	for _, n := range raw.Networks {
		netRx += n.RxBytes
		netTx += n.TxBytes
	}

	// Block I/O
	var blockRead, blockWrite uint64
	for _, b := range raw.BlkioStats.IOServiceBytesRecursive {
		switch strings.ToLower(b.Op) {
		case "read":
			blockRead += b.Value
		case "write":
			blockWrite += b.Value
		}
	}

	return &ContainerStatsResult{
		CPUPercent: cpuPercent,
		MemUsed:    memUsed,
		MemLimit:   raw.MemoryStats.Limit,
		NetRx:      netRx,
		NetTx:      netTx,
		BlockRead:  blockRead,
		BlockWrite: blockWrite,
		PIDs:       raw.PidsStats.Current,
	}, nil
}

func Collect() (*Info, error) {
	c := NewUnixSocketClient(DefaultClientConfig())
	containers, err := c.ListContainers(context.Background())
	if err != nil {
		return &Info{}, err
	}
	return &Info{Containers: containers}, nil
}
