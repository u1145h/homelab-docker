package docker

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
)

type mockTransport struct {
	statusCode   int
	body         string
	lastReq      *http.Request
	callCount    int
	roundTripErr error
}

func (m *mockTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	m.callCount++
	m.lastReq = req
	if m.roundTripErr != nil {
		return nil, m.roundTripErr
	}
	return &http.Response{
		StatusCode: m.statusCode,
		Body:       io.NopCloser(strings.NewReader(m.body)),
		Header:     make(http.Header),
	}, nil
}

func TestListContainers_ParsesResponse(t *testing.T) {
	transport := &mockTransport{
		statusCode: http.StatusOK,
		body:       `[{"Id":"abc","Names":["/web"],"Image":"nginx","State":"running","Status":"Up","Labels":{"com.docker.compose.project":"myapp","com.docker.compose.service":"web"}}]`,
	}
	client := &unixSocketClient{
		http:       &http.Client{Transport: transport},
		negotiated: true,
	}

	containers, err := client.ListContainers(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(containers) != 1 {
		t.Fatalf("expected 1 container, got %d", len(containers))
	}
	if containers[0].ID != "abc" {
		t.Errorf("expected ID abc, got %s", containers[0].ID)
	}
	if containers[0].Name != "web" {
		t.Errorf("expected Name web, got %s", containers[0].Name)
	}
	if containers[0].Image != "nginx" {
		t.Errorf("expected Image nginx, got %s", containers[0].Image)
	}
	if containers[0].State != "running" {
		t.Errorf("expected State running, got %s", containers[0].State)
	}
	if containers[0].Status != "Up" {
		t.Errorf("expected Status Up, got %s", containers[0].Status)
	}
	if containers[0].Project != "myapp" {
		t.Errorf("expected Project myapp, got %s", containers[0].Project)
	}
	if containers[0].Service != "web" {
		t.Errorf("expected Service web, got %s", containers[0].Service)
	}
}

func TestListContainers_StripsSlashFromName(t *testing.T) {
	transport := &mockTransport{
		statusCode: http.StatusOK,
		body:       `[{"Id":"abc","Names":["/web"],"Image":"nginx","State":"running","Status":"Up"}]`,
	}
	client := &unixSocketClient{
		http:       &http.Client{Transport: transport},
		negotiated: true,
	}

	containers, err := client.ListContainers(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if containers[0].Name != "web" {
		t.Errorf("expected Name web without leading slash, got %s", containers[0].Name)
	}
}

func TestListContainers_EmptyNames(t *testing.T) {
	transport := &mockTransport{
		statusCode: http.StatusOK,
		body:       `[{"Id":"abc","Names":[],"Image":"nginx","State":"running","Status":"Up"}]`,
	}
	client := &unixSocketClient{
		http:       &http.Client{Transport: transport},
		negotiated: true,
	}

	containers, err := client.ListContainers(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if containers[0].Name != "" {
		t.Errorf("expected empty Name, got %s", containers[0].Name)
	}
}

func TestInspectContainer_ParsesResponse(t *testing.T) {
	transport := &mockTransport{
		statusCode: http.StatusOK,
		body: `{
			"Id":"abc123",
			"Name":"/web",
			"Image":"nginx",
			"Path":"nginx",
			"Args":["-g","daemon off;"],
			"Created":"2025-01-01T00:00:00Z",
			"Config":{"Labels":{"com.docker.compose.project":"myapp"}},
			"State":{
				"Status":"running","Running":true,"Paused":false,"Restarting":false,"Dead":false,
				"Pid":42,"ExitCode":0,
				"StartedAt":"2025-01-01T00:00:00Z","FinishedAt":"0001-01-01T00:00:00Z"
			},
			"Mounts":[{"Type":"bind","Source":"/host","Destination":"/container","Mode":"rw","RW":true}],
			"NetworkSettings":{"Networks":{"bridge":{"IPAddress":"172.17.0.2","Gateway":"172.17.0.1"}}},
			"Ports":[{"PrivatePort":80,"PublicPort":8080,"Type":"tcp","IP":"0.0.0.0"}]
		}`,
	}
	client := &unixSocketClient{
		http:       &http.Client{Transport: transport},
		negotiated: true,
	}

	detail, err := client.InspectContainer(context.Background(), "abc123")
	if err != nil {
		t.Fatal(err)
	}
	if detail.ID != "abc123" {
		t.Errorf("expected ID abc123, got %s", detail.ID)
	}
	if detail.Name != "web" {
		t.Errorf("expected Name web, got %s", detail.Name)
	}
	if detail.Image != "nginx" {
		t.Errorf("expected Image nginx, got %s", detail.Image)
	}
	if detail.Command != "nginx -g daemon off;" {
		t.Errorf("expected Command 'nginx -g daemon off;', got %s", detail.Command)
	}
	if !detail.State.Running {
		t.Error("expected State.Running true")
	}
	if detail.State.Pid != 42 {
		t.Errorf("expected Pid 42, got %d", detail.State.Pid)
	}
	if len(detail.Mounts) != 1 || detail.Mounts[0].Source != "/host" {
		t.Errorf("expected 1 mount with Source /host")
	}
	if len(detail.Network) != 1 || detail.Network[0].IP != "172.17.0.2" {
		t.Errorf("expected 1 network with IP 172.17.0.2")
	}
	if len(detail.Ports) != 1 || detail.Ports[0].PublicPort != 8080 {
		t.Errorf("expected 1 port with PublicPort 8080")
	}
	if detail.Labels["com.docker.compose.project"] != "myapp" {
		t.Errorf("expected label myapp, got %s", detail.Labels["com.docker.compose.project"])
	}
}

func TestInspectContainer_WithHealth(t *testing.T) {
	transport := &mockTransport{
		statusCode: http.StatusOK,
		body: `{
			"Id":"abc","Name":"/web","Image":"nginx",
			"State":{"Status":"running","Running":true,"Paused":false,"Restarting":false,"Dead":false,
			"Pid":1,"ExitCode":0,"StartedAt":"2025-01-01T00:00:00Z","FinishedAt":"0001-01-01T00:00:00Z",
			"Health":{"Status":"healthy"}}
		}`,
	}
	client := &unixSocketClient{
		http:       &http.Client{Transport: transport},
		negotiated: true,
	}

	detail, err := client.InspectContainer(context.Background(), "abc")
	if err != nil {
		t.Fatal(err)
	}
	if detail.State.Health == nil {
		t.Fatal("expected Health to be non-nil")
	}
	if detail.State.Health.Status != "healthy" {
		t.Errorf("expected Health.Status healthy, got %s", detail.State.Health.Status)
	}
}

func TestStartContainer_SendsPost(t *testing.T) {
	transport := &mockTransport{statusCode: http.StatusNoContent}
	client := &unixSocketClient{
		http:       &http.Client{Transport: transport},
		negotiated: true,
	}

	err := client.StartContainer(context.Background(), "abc")
	if err != nil {
		t.Fatal(err)
	}
	if transport.lastReq.Method != http.MethodPost {
		t.Errorf("expected POST, got %s", transport.lastReq.Method)
	}
	if !strings.HasSuffix(transport.lastReq.URL.Path, "/containers/abc/start") {
		t.Errorf("expected path ending in /containers/abc/start, got %s", transport.lastReq.URL.Path)
	}
}

func TestStopContainer_SendsPost(t *testing.T) {
	transport := &mockTransport{statusCode: http.StatusNoContent}
	client := &unixSocketClient{
		http:       &http.Client{Transport: transport},
		negotiated: true,
	}

	err := client.StopContainer(context.Background(), "abc")
	if err != nil {
		t.Fatal(err)
	}
	if transport.lastReq.Method != http.MethodPost {
		t.Errorf("expected POST, got %s", transport.lastReq.Method)
	}
	if !strings.HasSuffix(transport.lastReq.URL.Path, "/containers/abc/stop") {
		t.Errorf("expected path ending in /containers/abc/stop, got %s", transport.lastReq.URL.Path)
	}
}

func TestRestartContainer_SendsPost(t *testing.T) {
	transport := &mockTransport{statusCode: http.StatusNoContent}
	client := &unixSocketClient{
		http:       &http.Client{Transport: transport},
		negotiated: true,
	}

	err := client.RestartContainer(context.Background(), "abc")
	if err != nil {
		t.Fatal(err)
	}
	if transport.lastReq.Method != http.MethodPost {
		t.Errorf("expected POST, got %s", transport.lastReq.Method)
	}
	if !strings.HasSuffix(transport.lastReq.URL.Path, "/containers/abc/restart") {
		t.Errorf("expected path ending in /containers/abc/restart, got %s", transport.lastReq.URL.Path)
	}
}

func TestDo_NotFound(t *testing.T) {
	transport := &mockTransport{statusCode: http.StatusNotFound, body: "not found"}
	client := &unixSocketClient{
		http:       &http.Client{Transport: transport},
		negotiated: true,
	}

	_, err := client.ListContainers(context.Background())
	if err == nil {
		t.Fatal("expected error")
	}
	var apiErr *DockerAPIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("expected DockerAPIError, got %T", err)
	}
	if apiErr.StatusCode != 404 {
		t.Errorf("expected StatusCode 404, got %d", apiErr.StatusCode)
	}
}

func TestDo_ServerError(t *testing.T) {
	transport := &mockTransport{statusCode: http.StatusInternalServerError, body: "internal error"}
	client := &unixSocketClient{
		http:       &http.Client{Transport: transport},
		negotiated: true,
	}

	_, err := client.ListContainers(context.Background())
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "internal error") {
		t.Errorf("expected error containing 'internal error', got %s", err.Error())
	}
}

func TestDo_ConnectionError(t *testing.T) {
	transport := &mockTransport{roundTripErr: errors.New("connection refused")}
	client := &unixSocketClient{
		http:       &http.Client{Transport: transport},
		negotiated: true,
	}

	_, err := client.ListContainers(context.Background())
	if err == nil {
		t.Fatal("expected error")
	}
	var apiErr *DockerAPIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("expected DockerAPIError, got %T", err)
	}
	if apiErr.StatusCode != 0 {
		t.Errorf("expected StatusCode 0 for connection error, got %d", apiErr.StatusCode)
	}
	if !strings.Contains(apiErr.Message, "connection refused") {
		t.Errorf("expected message containing 'connection refused', got %s", apiErr.Message)
	}
}

func TestNegotiateVersion_Caches(t *testing.T) {
	transport := &mockTransport{
		statusCode: http.StatusOK,
		body:       `{"ApiVersion":"1.45"}`,
	}
	client := &unixSocketClient{
		http: &http.Client{Transport: transport},
	}

	if err := client.negotiateVersion(context.Background()); err != nil {
		t.Fatal(err)
	}
	if client.apiVersion != "1.45" {
		t.Errorf("expected apiVersion 1.45, got %s", client.apiVersion)
	}
	if transport.callCount != 1 {
		t.Errorf("expected 1 call to /version, got %d", transport.callCount)
	}

	if err := client.negotiateVersion(context.Background()); err != nil {
		t.Fatal(err)
	}
	if transport.callCount != 1 {
		t.Errorf("expected still 1 call after caching, got %d", transport.callCount)
	}
}

func TestNegotiateVersion_Fallback(t *testing.T) {
	transport := &mockTransport{roundTripErr: errors.New("connection failed")}
	client := &unixSocketClient{
		http: &http.Client{Transport: transport},
	}

	if err := client.negotiateVersion(context.Background()); err != nil {
		t.Fatal(err)
	}
	if client.apiVersion != "1.24" {
		t.Errorf("expected fallback apiVersion 1.24, got %s", client.apiVersion)
	}
	if !client.negotiated {
		t.Error("expected client to be marked negotiated")
	}
}
