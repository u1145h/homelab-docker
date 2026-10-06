package docker_test

import (
	"context"
	"errors"
	"testing"

	"github.com/ullashroy/poco-server/backend/internal/audit"
	"github.com/ullashroy/poco-server/backend/internal/docker"
)

type noopAuditRepo struct{}

func (n *noopAuditRepo) List(filter audit.AuditFilter) ([]audit.Entry, error) { return nil, nil }
func (n *noopAuditRepo) GetByID(id string) (*audit.Entry, error)              { return nil, audit.ErrNotFound }
func (n *noopAuditRepo) Create(entry *audit.Entry) error                      { return nil }

func newNoopAudit() *audit.Service {
	return audit.NewService(&noopAuditRepo{}, func(s string) error { return nil })
}

type mockLister struct {
	containers []docker.ContainerSummary
	err        error
}

func (m *mockLister) ListContainers(ctx context.Context) ([]docker.ContainerSummary, error) {
	return m.containers, m.err
}

type mockInspector struct {
	detail *docker.ContainerDetail
	err    error
}

func (m *mockInspector) InspectContainer(ctx context.Context, id string) (*docker.ContainerDetail, error) {
	return m.detail, m.err
}

type mockLifecycler struct {
	startErr   error
	stopErr    error
	restartErr error
	startCall  int
}

func (m *mockLifecycler) StartContainer(ctx context.Context, id string) error {
	if m.startCall == 0 && m.startErr != nil {
		m.startCall++
		return m.startErr
	}
	m.startCall++
	return nil
}
func (m *mockLifecycler) StopContainer(ctx context.Context, id string) error    { return m.stopErr }
func (m *mockLifecycler) RestartContainer(ctx context.Context, id string) error { return m.restartErr }

type allowAuthorizer struct{}

func (a *allowAuthorizer) Authorize(ctx context.Context, username string, op docker.Operation) error {
	return nil
}

type denyAuthorizer struct{}

func (d *denyAuthorizer) Authorize(ctx context.Context, username string, op docker.Operation) error {
	return docker.ErrPermissionDenied
}

type captureAuditRepo struct {
	entries []audit.Entry
}

func (c *captureAuditRepo) List(filter audit.AuditFilter) ([]audit.Entry, error) {
	return c.entries, nil
}
func (c *captureAuditRepo) GetByID(id string) (*audit.Entry, error) { return nil, audit.ErrNotFound }
func (c *captureAuditRepo) Create(entry *audit.Entry) error {
	c.entries = append(c.entries, *entry)
	return nil
}

type mockLogger struct {
	entries []docker.LogEntry
	err     error
}

func (m *mockLogger) GetContainerLogs(ctx context.Context, id string, tail int) ([]docker.LogEntry, error) {
	return m.entries, m.err
}

type mockStatter struct {
	stats *docker.ContainerStatsResult
	err   error
}

func (m *mockStatter) GetContainerStats(ctx context.Context, id string) (*docker.ContainerStatsResult, error) {
	return m.stats, m.err
}

type mockRemover struct {
	err error
}

func (m *mockRemover) RemoveContainer(ctx context.Context, id string) error {
	return m.err
}

func newService(lister docker.ContainerLister, inspector docker.ContainerInspector, lifecycler docker.ContainerLifecycler, authz docker.Authorizer) *docker.Service {
	auditSvc := audit.NewService(&noopAuditRepo{}, func(s string) error { return nil })
	return docker.NewService(lister, inspector, lifecycler, &mockLogger{}, &mockStatter{}, &mockRemover{}, auditSvc, authz)
}

func TestListContainers_Success(t *testing.T) {
	lister := &mockLister{containers: []docker.ContainerSummary{
		{ID: "abc", Name: "web", State: "running"},
	}}
	svc := newService(lister, &mockInspector{}, &mockLifecycler{}, &allowAuthorizer{})

	containers, err := svc.ListContainers(context.Background(), "admin")
	if err != nil {
		t.Fatal(err)
	}
	if len(containers) != 1 {
		t.Fatalf("expected 1 container, got %d", len(containers))
	}
	if containers[0].ID != "abc" {
		t.Fatalf("expected id abc, got %s", containers[0].ID)
	}
}

func TestListContainers_Unauthorized(t *testing.T) {
	svc := newService(&mockLister{}, &mockInspector{}, &mockLifecycler{}, &denyAuthorizer{})

	_, err := svc.ListContainers(context.Background(), "readonly")
	if !errors.Is(err, docker.ErrPermissionDenied) {
		t.Fatalf("expected ErrPermissionDenied, got %v", err)
	}
}

func TestGetContainer_Success(t *testing.T) {
	inspector := &mockInspector{detail: &docker.ContainerDetail{
		ID:    "abc",
		Name:  "web",
		Image: "nginx",
	}}
	svc := newService(&mockLister{}, inspector, &mockLifecycler{}, &allowAuthorizer{})

	detail, err := svc.GetContainer(context.Background(), "admin", "abc")
	if err != nil {
		t.Fatal(err)
	}
	if detail.ID != "abc" {
		t.Fatalf("expected id abc, got %s", detail.ID)
	}
}

func TestGetContainer_EmptyID(t *testing.T) {
	svc := newService(&mockLister{}, &mockInspector{}, &mockLifecycler{}, &allowAuthorizer{})

	_, err := svc.GetContainer(context.Background(), "admin", "")
	if !errors.Is(err, docker.ErrIDRequired) {
		t.Fatalf("expected ErrIDRequired, got %v", err)
	}
}

func TestGetContainer_NotFound(t *testing.T) {
	inspector := &mockInspector{err: &docker.DockerAPIError{StatusCode: 404, Message: "not found"}}
	svc := newService(&mockLister{}, inspector, &mockLifecycler{}, &allowAuthorizer{})

	_, err := svc.GetContainer(context.Background(), "admin", "missing")
	if !errors.Is(err, docker.ErrContainerNotFound) {
		t.Fatalf("expected ErrContainerNotFound, got %v", err)
	}
}

func TestStartContainer_Success(t *testing.T) {
	repo := &captureAuditRepo{}
	auditSvc := audit.NewService(repo, func(s string) error { return nil })
	inspector := &mockInspector{detail: &docker.ContainerDetail{ID: "abc", Name: "web", Image: "nginx"}}
	svc := docker.NewService(&mockLister{}, inspector, &mockLifecycler{}, &mockLogger{}, &mockStatter{}, &mockRemover{}, auditSvc, &allowAuthorizer{})

	err := svc.StartContainer(context.Background(), "admin", "abc")
	if err != nil {
		t.Fatal(err)
	}
	if len(repo.entries) != 1 {
		t.Fatalf("expected 1 audit entry, got %d", len(repo.entries))
	}
	if repo.entries[0].Action != audit.ActionContainerStart {
		t.Fatalf("expected action %s, got %s", audit.ActionContainerStart, repo.entries[0].Action)
	}
	if repo.entries[0].Metadata["container_name"] != "web" {
		t.Fatalf("expected container_name web, got %v", repo.entries[0].Metadata["container_name"])
	}
}

func TestStartContainer_Unauthorized(t *testing.T) {
	svc := newService(&mockLister{}, &mockInspector{}, &mockLifecycler{}, &denyAuthorizer{})

	err := svc.StartContainer(context.Background(), "readonly", "abc")
	if !errors.Is(err, docker.ErrPermissionDenied) {
		t.Fatalf("expected ErrPermissionDenied, got %v", err)
	}
}

func TestStartContainer_EmptyID(t *testing.T) {
	svc := newService(&mockLister{}, &mockInspector{}, &mockLifecycler{}, &allowAuthorizer{})

	err := svc.StartContainer(context.Background(), "admin", "")
	if !errors.Is(err, docker.ErrIDRequired) {
		t.Fatalf("expected ErrIDRequired, got %v", err)
	}
}

func TestStopContainer_Success(t *testing.T) {
	repo := &captureAuditRepo{}
	auditSvc := audit.NewService(repo, func(s string) error { return nil })
	inspector := &mockInspector{detail: &docker.ContainerDetail{ID: "abc", Name: "db", Image: "postgres"}}
	svc := docker.NewService(&mockLister{}, inspector, &mockLifecycler{}, &mockLogger{}, &mockStatter{}, &mockRemover{}, auditSvc, &allowAuthorizer{})

	err := svc.StopContainer(context.Background(), "admin", "abc")
	if err != nil {
		t.Fatal(err)
	}
	if len(repo.entries) != 1 {
		t.Fatalf("expected 1 audit entry, got %d", len(repo.entries))
	}
	if repo.entries[0].Action != audit.ActionContainerStop {
		t.Fatalf("expected action %s, got %s", audit.ActionContainerStop, repo.entries[0].Action)
	}
}

func TestRestartContainer_Success(t *testing.T) {
	repo := &captureAuditRepo{}
	auditSvc := audit.NewService(repo, func(s string) error { return nil })
	inspector := &mockInspector{detail: &docker.ContainerDetail{ID: "abc", Name: "web", Image: "nginx"}}
	svc := docker.NewService(&mockLister{}, inspector, &mockLifecycler{}, &mockLogger{}, &mockStatter{}, &mockRemover{}, auditSvc, &allowAuthorizer{})

	err := svc.RestartContainer(context.Background(), "admin", "abc")
	if err != nil {
		t.Fatal(err)
	}
	if len(repo.entries) != 1 {
		t.Fatalf("expected 1 audit entry, got %d", len(repo.entries))
	}
	if repo.entries[0].Action != audit.ActionContainerRestart {
		t.Fatalf("expected action %s, got %s", audit.ActionContainerRestart, repo.entries[0].Action)
	}
}

func TestContainerAction_FailureAuditLogged(t *testing.T) {
	repo := &captureAuditRepo{}
	auditSvc := audit.NewService(repo, func(s string) error { return nil })
	svc := docker.NewService(&mockLister{}, &mockInspector{}, &mockLifecycler{startErr: errors.New("engine error")}, &mockLogger{}, &mockStatter{}, &mockRemover{}, auditSvc, &allowAuthorizer{})

	err := svc.StartContainer(context.Background(), "admin", "abc")
	if err == nil {
		t.Fatal("expected error")
	}
	if len(repo.entries) != 1 {
		t.Fatalf("expected 1 audit entry, got %d", len(repo.entries))
	}
	if repo.entries[0].Status != audit.StatusFailure {
		t.Fatalf("expected status failure, got %s", repo.entries[0].Status)
	}
}

func TestListProjects_GroupsByLabel(t *testing.T) {
	lister := &mockLister{containers: []docker.ContainerSummary{
		{ID: "a", Name: "web", Project: "myapp", State: "running"},
		{ID: "b", Name: "db", Project: "myapp", State: "running"},
		{ID: "c", Name: "cache", State: "running"},
	}}
	svc := newService(lister, &mockInspector{}, &mockLifecycler{}, &allowAuthorizer{})

	projects, err := svc.ListProjects(context.Background(), "admin")
	if err != nil {
		t.Fatal(err)
	}
	if len(projects) != 2 {
		t.Fatalf("expected 2 projects, got %d", len(projects))
	}
	for _, p := range projects {
		if p.Name == "myapp" && p.ContainerCount != 2 {
			t.Fatalf("expected myapp to have 2 containers, got %d", p.ContainerCount)
		}
		if p.Name == "standalone" && p.ContainerCount != 1 {
			t.Fatalf("expected standalone to have 1 container, got %d", p.ContainerCount)
		}
	}
}

func TestGetProject_Found(t *testing.T) {
	lister := &mockLister{containers: []docker.ContainerSummary{
		{ID: "a", Name: "web", Project: "myapp", State: "running"},
	}}
	svc := newService(lister, &mockInspector{}, &mockLifecycler{}, &allowAuthorizer{})

	p, err := svc.GetProject(context.Background(), "admin", "myapp")
	if err != nil {
		t.Fatal(err)
	}
	if p.Name != "myapp" {
		t.Fatalf("expected project myapp, got %s", p.Name)
	}
}

func TestGetProject_NotFound(t *testing.T) {
	lister := &mockLister{containers: []docker.ContainerSummary{}}
	svc := newService(lister, &mockInspector{}, &mockLifecycler{}, &allowAuthorizer{})

	_, err := svc.GetProject(context.Background(), "admin", "nonexistent")
	if !errors.Is(err, docker.ErrProjectNotFound) {
		t.Fatalf("expected ErrProjectNotFound, got %v", err)
	}
}

func TestGetProject_EmptyName(t *testing.T) {
	svc := newService(&mockLister{}, &mockInspector{}, &mockLifecycler{}, &allowAuthorizer{})

	_, err := svc.GetProject(context.Background(), "admin", "")
	if !errors.Is(err, docker.ErrNameRequired) {
		t.Fatalf("expected ErrNameRequired, got %v", err)
	}
}

func TestStartProject_AllSucceed(t *testing.T) {
	lister := &mockLister{containers: []docker.ContainerSummary{
		{ID: "a", Name: "web", Project: "myapp", State: "exited"},
		{ID: "b", Name: "db", Project: "myapp", State: "exited"},
	}}
	repo := &captureAuditRepo{}
	auditSvc := audit.NewService(repo, func(s string) error { return nil })
	svc := docker.NewService(lister, &mockInspector{}, &mockLifecycler{}, &mockLogger{}, &mockStatter{}, &mockRemover{}, auditSvc, &allowAuthorizer{})

	result, err := svc.StartProject(context.Background(), "admin", "myapp")
	if err != nil {
		t.Fatal(err)
	}
	if result.Succeeded != 2 {
		t.Fatalf("expected 2 succeeded, got %d", result.Succeeded)
	}
	if result.Failed != 0 {
		t.Fatalf("expected 0 failed, got %d", result.Failed)
	}
	if len(repo.entries) != 2 {
		t.Fatalf("expected 2 audit entries, got %d", len(repo.entries))
	}
}

func TestStartProject_PartialFailure(t *testing.T) {
	lister := &mockLister{containers: []docker.ContainerSummary{
		{ID: "a", Name: "web", Project: "myapp", State: "exited"},
		{ID: "b", Name: "db", Project: "myapp", State: "exited"},
	}}
	svc := docker.NewService(lister, &mockInspector{}, &mockLifecycler{startErr: errors.New("engine error")}, &mockLogger{}, &mockStatter{}, &mockRemover{}, newNoopAudit(), &allowAuthorizer{})

	result, err := svc.StartProject(context.Background(), "admin", "myapp")
	if err != nil {
		t.Fatal(err)
	}
	if result.Succeeded != 1 {
		t.Fatalf("expected 1 succeeded, got %d", result.Succeeded)
	}
	if result.Failed != 1 {
		t.Fatalf("expected 1 failed, got %d", result.Failed)
	}
}

func TestStartProject_NotFound(t *testing.T) {
	lister := &mockLister{containers: []docker.ContainerSummary{}}
	svc := newService(lister, &mockInspector{}, &mockLifecycler{}, &allowAuthorizer{})

	_, err := svc.StartProject(context.Background(), "admin", "nonexistent")
	if !errors.Is(err, docker.ErrProjectNotFound) {
		t.Fatalf("expected ErrProjectNotFound, got %v", err)
	}
}

func TestStartProject_Unauthorized(t *testing.T) {
	svc := newService(&mockLister{}, &mockInspector{}, &mockLifecycler{}, &denyAuthorizer{})

	_, err := svc.StartProject(context.Background(), "readonly", "myapp")
	if !errors.Is(err, docker.ErrPermissionDenied) {
		t.Fatalf("expected ErrPermissionDenied, got %v", err)
	}
}

func TestListContainers_ClientError(t *testing.T) {
	lister := &mockLister{err: errors.New("connection refused")}
	svc := newService(lister, &mockInspector{}, &mockLifecycler{}, &allowAuthorizer{})

	_, err := svc.ListContainers(context.Background(), "admin")
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestListProjects_FallbackStandalone(t *testing.T) {
	lister := &mockLister{containers: []docker.ContainerSummary{
		{ID: "a", Name: "web", State: "running"},
		{ID: "b", Name: "db", State: "running"},
	}}
	svc := newService(lister, &mockInspector{}, &mockLifecycler{}, &allowAuthorizer{})

	projects, err := svc.ListProjects(context.Background(), "admin")
	if err != nil {
		t.Fatal(err)
	}
	if len(projects) != 1 {
		t.Fatalf("expected 1 project (standalone), got %d", len(projects))
	}
	if projects[0].Name != "standalone" {
		t.Fatalf("expected standalone, got %s", projects[0].Name)
	}
	if projects[0].ContainerCount != 2 {
		t.Fatalf("expected 2 containers, got %d", projects[0].ContainerCount)
	}
}
