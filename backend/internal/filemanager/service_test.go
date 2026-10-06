package filemanager

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
	"sync"
	"testing"

	"github.com/ullashroy/poco-server/backend/internal/audit"
)

type mockFilesystem struct {
	mu       sync.Mutex
	listFn   func(ctx context.Context, path string) ([]Item, error)
	readFn   func(ctx context.Context, path string) (io.ReadCloser, *StatInfo, error)
	writeFn  func(ctx context.Context, path string, reader io.Reader, size int64) error
	deleteFn func(ctx context.Context, path string) error
	renameFn func(ctx context.Context, source, target string) error
	moveFn   func(ctx context.Context, source, target string, progress ProgressFunc) error
	copyFn   func(ctx context.Context, source, target string, progress ProgressFunc) error
	mkdirFn  func(ctx context.Context, path string) error
	statFn   func(ctx context.Context, path string) (*StatInfo, error)
}

func (m *mockFilesystem) List(ctx context.Context, path string) ([]Item, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.listFn(ctx, path)
}
func (m *mockFilesystem) Read(ctx context.Context, path string) (io.ReadCloser, *StatInfo, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.readFn(ctx, path)
}
func (m *mockFilesystem) Write(ctx context.Context, path string, reader io.Reader, size int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.writeFn(ctx, path, reader, size)
}
func (m *mockFilesystem) Delete(ctx context.Context, path string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.deleteFn(ctx, path)
}
func (m *mockFilesystem) Rename(ctx context.Context, source, target string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.renameFn(ctx, source, target)
}
func (m *mockFilesystem) Move(ctx context.Context, source, target string, progress ProgressFunc) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.moveFn(ctx, source, target, progress)
}
func (m *mockFilesystem) Copy(ctx context.Context, source, target string, progress ProgressFunc) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.copyFn(ctx, source, target, progress)
}
func (m *mockFilesystem) Mkdir(ctx context.Context, path string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.mkdirFn(ctx, path)
}
func (m *mockFilesystem) Stat(ctx context.Context, path string) (*StatInfo, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.statFn(ctx, path)
}

type mockAuthorizer struct {
	authorizeFn func(ctx context.Context, username string, op Operation) error
}

func (m *mockAuthorizer) Authorize(ctx context.Context, username string, op Operation) error {
	return m.authorizeFn(ctx, username, op)
}

type capturedEntry struct {
	audit.Entry
	req audit.LogRequest
}

type mockAuditRepo struct {
	mu      sync.Mutex
	entries []audit.LogRequest
}

func (r *mockAuditRepo) Create(entry *audit.Entry) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.entries = append(r.entries, audit.LogRequest{
		Action:   entry.Action,
		Actor:    entry.Actor,
		Target:   entry.Target,
		Status:   entry.Status,
		Message:  entry.Message,
		Metadata: entry.Metadata,
	})
	return nil
}
func (r *mockAuditRepo) GetByID(id string) (*audit.Entry, error) {
	return nil, nil
}
func (r *mockAuditRepo) List(filter audit.AuditFilter) ([]audit.Entry, error) {
	return nil, nil
}

func newMockService(mock *mockFilesystem, repo *mockAuditRepo, auth *mockAuthorizer) (*Service, *mockAuditRepo) {
	if repo == nil {
		repo = &mockAuditRepo{}
	}
	auditSvc := audit.NewService(repo, nil)
	return &Service{
		fs:         mock,
		audit:      auditSvc,
		authorizer: auth,
	}, repo
}

func defaultMockFS() *mockFilesystem {
	return &mockFilesystem{
		listFn: func(_ context.Context, path string) ([]Item, error) {
			return []Item{{Name: "test.txt", Path: path + "/test.txt", Type: "file"}}, nil
		},
		readFn: func(_ context.Context, path string) (io.ReadCloser, *StatInfo, error) {
			return io.NopCloser(strings.NewReader("content")), &StatInfo{Name: "test.txt", Size: 7}, nil
		},
		writeFn: func(_ context.Context, path string, _ io.Reader, _ int64) error {
			return nil
		},
		deleteFn: func(_ context.Context, path string) error {
			return nil
		},
		renameFn: func(_ context.Context, source, target string) error {
			return nil
		},
		moveFn: func(_ context.Context, source, target string, _ ProgressFunc) error {
			return nil
		},
		copyFn: func(_ context.Context, source, target string, _ ProgressFunc) error {
			return nil
		},
		mkdirFn: func(_ context.Context, path string) error {
			return nil
		},
		statFn: func(_ context.Context, path string) (*StatInfo, error) {
			return &StatInfo{Name: "test.txt", Size: 7, MIME: "text/plain"}, nil
		},
	}
}

func allowAllAuth() *mockAuthorizer {
	return &mockAuthorizer{
		authorizeFn: func(_ context.Context, _ string, _ Operation) error {
			return nil
		},
	}
}

func denyAllAuth() *mockAuthorizer {
	return &mockAuthorizer{
		authorizeFn: func(_ context.Context, _ string, _ Operation) error {
			return ErrPermissionDenied
		},
	}
}

func TestServiceList(t *testing.T) {
	mock := defaultMockFS()
	svc, _ := newMockService(mock, nil, allowAllAuth())

	dir, err := svc.List(context.Background(), "user", "/")
	if err != nil {
		t.Fatalf("List failed: %v", err)
	}
	if dir.Path != "/" {
		t.Errorf("expected path /, got %s", dir.Path)
	}
	if len(dir.Items) != 1 {
		t.Errorf("expected 1 item, got %d", len(dir.Items))
	}
}

func TestServiceListAuthorization(t *testing.T) {
	mock := defaultMockFS()
	svc, _ := newMockService(mock, nil, denyAllAuth())

	_, err := svc.List(context.Background(), "user", "/")
	if !errors.Is(err, ErrPermissionDenied) {
		t.Errorf("expected ErrPermissionDenied, got %v", err)
	}
}

func TestServiceListValidation(t *testing.T) {
	mock := defaultMockFS()
	svc, _ := newMockService(mock, nil, allowAllAuth())

	_, err := svc.List(context.Background(), "user", "")
	if !errors.Is(err, ErrEmptyPath) {
		t.Errorf("expected ErrEmptyPath, got %v", err)
	}
}

func TestServiceRead(t *testing.T) {
	mock := defaultMockFS()
	svc, _ := newMockService(mock, nil, allowAllAuth())

	reader, info, err := svc.Read(context.Background(), "user", "/test.txt")
	if err != nil {
		t.Fatalf("Read failed: %v", err)
	}
	defer reader.Close()

	if info.Name != "test.txt" {
		t.Errorf("expected name test.txt, got %s", info.Name)
	}
	data, _ := io.ReadAll(reader)
	if string(data) != "content" {
		t.Errorf("expected content 'content', got %s", data)
	}
}

func TestServiceReadAuthorization(t *testing.T) {
	mock := defaultMockFS()
	svc, _ := newMockService(mock, nil, denyAllAuth())

	_, _, err := svc.Read(context.Background(), "user", "/test.txt")
	if !errors.Is(err, ErrPermissionDenied) {
		t.Errorf("expected ErrPermissionDenied, got %v", err)
	}
}

func TestServiceWrite(t *testing.T) {
	mock := defaultMockFS()
	mock.statFn = func(_ context.Context, path string) (*StatInfo, error) {
		return nil, ErrNotFound
	}

	svc, repo := newMockService(mock, nil, allowAllAuth())

	content := "new content"
	err := svc.Write(context.Background(), "user", "/new.txt", strings.NewReader(content), int64(len(content)))
	if err != nil {
		t.Fatalf("Write failed: %v", err)
	}

	repo.mu.Lock()
	last := repo.entries[len(repo.entries)-1]
	repo.mu.Unlock()

	if last.Action != audit.ActionFileCreate {
		t.Errorf("expected file.create action, got %s", last.Action)
	}
	if last.Status != audit.StatusSuccess {
		t.Errorf("expected success status, got %s", last.Status)
	}
	if last.Actor != "user" {
		t.Errorf("expected actor 'user', got %s", last.Actor)
	}
}

func TestServiceWriteUpdate(t *testing.T) {
	mock := defaultMockFS()
	mock.statFn = func(_ context.Context, path string) (*StatInfo, error) {
		return &StatInfo{Name: "existing.txt"}, nil
	}

	svc, repo := newMockService(mock, nil, allowAllAuth())

	content := "updated content"
	err := svc.Write(context.Background(), "user", "/existing.txt", strings.NewReader(content), int64(len(content)))
	if err != nil {
		t.Fatalf("Write failed: %v", err)
	}

	repo.mu.Lock()
	last := repo.entries[len(repo.entries)-1]
	repo.mu.Unlock()

	if last.Action != audit.ActionFileUpdate {
		t.Errorf("expected file.update action, got %s", last.Action)
	}
}

func TestServiceWriteFailAudit(t *testing.T) {
	mock := defaultMockFS()
	mock.statFn = func(_ context.Context, path string) (*StatInfo, error) {
		return nil, ErrNotFound
	}
	mock.writeFn = func(_ context.Context, path string, _ io.Reader, _ int64) error {
		return fmt.Errorf("write failed: %w", os.ErrPermission)
	}

	svc, repo := newMockService(mock, nil, allowAllAuth())

	err := svc.Write(context.Background(), "user", "/fail.txt", strings.NewReader("data"), 4)
	if err == nil {
		t.Fatal("expected error")
	}

	repo.mu.Lock()
	last := repo.entries[len(repo.entries)-1]
	repo.mu.Unlock()

	if last.Status != audit.StatusFailure {
		t.Errorf("expected failure status, got %s", last.Status)
	}
}

func TestServiceDelete(t *testing.T) {
	mock := defaultMockFS()
	svc, repo := newMockService(mock, nil, allowAllAuth())

	err := svc.Delete(context.Background(), "user", "/file.txt")
	if err != nil {
		t.Fatalf("Delete failed: %v", err)
	}

	repo.mu.Lock()
	last := repo.entries[len(repo.entries)-1]
	repo.mu.Unlock()

	if last.Action != audit.ActionFileDelete {
		t.Errorf("expected file.delete action, got %s", last.Action)
	}
}

func TestServiceMkdir(t *testing.T) {
	mock := defaultMockFS()
	svc, repo := newMockService(mock, nil, allowAllAuth())

	err := svc.Mkdir(context.Background(), "user", "/newdir")
	if err != nil {
		t.Fatalf("Mkdir failed: %v", err)
	}

	repo.mu.Lock()
	last := repo.entries[len(repo.entries)-1]
	repo.mu.Unlock()

	if last.Action != audit.ActionFileCreate {
		t.Errorf("expected file.create action, got %s", last.Action)
	}
}

func TestServiceRename(t *testing.T) {
	mock := defaultMockFS()
	svc, repo := newMockService(mock, nil, allowAllAuth())

	err := svc.Rename(context.Background(), "user", "/old", "/new")
	if err != nil {
		t.Fatalf("Rename failed: %v", err)
	}

	repo.mu.Lock()
	last := repo.entries[len(repo.entries)-1]
	repo.mu.Unlock()

	if last.Action != audit.ActionFileRename {
		t.Errorf("expected file.rename action, got %s", last.Action)
	}
}

func TestServiceMove(t *testing.T) {
	mock := defaultMockFS()
	svc, repo := newMockService(mock, nil, allowAllAuth())

	err := svc.Move(context.Background(), "user", "/src", "/dst", nil)
	if err != nil {
		t.Fatalf("Move failed: %v", err)
	}

	repo.mu.Lock()
	last := repo.entries[len(repo.entries)-1]
	repo.mu.Unlock()

	if last.Action != audit.ActionFileMove {
		t.Errorf("expected file.move action, got %s", last.Action)
	}
}

func TestServiceCopy(t *testing.T) {
	mock := defaultMockFS()
	svc, repo := newMockService(mock, nil, allowAllAuth())

	err := svc.Copy(context.Background(), "user", "/src", "/dst", nil)
	if err != nil {
		t.Fatalf("Copy failed: %v", err)
	}

	repo.mu.Lock()
	last := repo.entries[len(repo.entries)-1]
	repo.mu.Unlock()

	if last.Action != audit.ActionFileCopy {
		t.Errorf("expected file.copy action, got %s", last.Action)
	}
}

func TestServiceStat(t *testing.T) {
	mock := defaultMockFS()
	svc, _ := newMockService(mock, nil, allowAllAuth())

	info, err := svc.Stat(context.Background(), "user", "/test.txt")
	if err != nil {
		t.Fatalf("Stat failed: %v", err)
	}
	if info.Name != "test.txt" {
		t.Errorf("expected name test.txt, got %s", info.Name)
	}
}

func TestServiceNoAuditOnRead(t *testing.T) {
	mock := defaultMockFS()
	svc, repo := newMockService(mock, nil, allowAllAuth())

	svc.List(context.Background(), "user", "/")
	svc.Read(context.Background(), "user", "/test.txt")
	svc.Stat(context.Background(), "user", "/test.txt")

	repo.mu.Lock()
	count := len(repo.entries)
	repo.mu.Unlock()

	if count != 0 {
		t.Errorf("expected 0 audit entries for read operations, got %d", count)
	}
}

func TestServiceValidation(t *testing.T) {
	mock := defaultMockFS()
	svc, _ := newMockService(mock, nil, allowAllAuth())

	tests := []struct {
		name string
		path string
	}{
		{"empty path", ""},
		{"null byte", "/test\x00.txt"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := svc.List(context.Background(), "user", tt.path)
			if !errors.Is(err, ErrInvalidPath) && !errors.Is(err, ErrEmptyPath) {
				t.Errorf("expected validation error, got %v", err)
			}

			_, _, err = svc.Read(context.Background(), "user", tt.path)
			if !errors.Is(err, ErrInvalidPath) && !errors.Is(err, ErrEmptyPath) {
				t.Errorf("expected validation error, got %v", err)
			}

			err = svc.Write(context.Background(), "user", tt.path, bytes.NewReader(nil), 0)
			if !errors.Is(err, ErrInvalidPath) && !errors.Is(err, ErrEmptyPath) {
				t.Errorf("expected validation error, got %v", err)
			}
		})
	}
}

func TestServiceErrorMapping(t *testing.T) {
	mock := defaultMockFS()
	svc, _ := newMockService(mock, nil, allowAllAuth())

	tests := []struct {
		name     string
		err      error
		expected error
	}{
		{"not found", os.ErrNotExist, ErrNotFound},
		{"permission", os.ErrPermission, ErrPermissionDenied},
		{"exist", os.ErrExist, ErrAlreadyExists},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mock.listFn = func(_ context.Context, path string) ([]Item, error) {
				return nil, tt.err
			}
			_, err := svc.List(context.Background(), "user", "/")
			if !errors.Is(err, tt.expected) {
				t.Errorf("expected %v, got %v", tt.expected, err)
			}
		})
	}
}

func TestServiceProgressCallbackThroughCopy(t *testing.T) {
	progressCalled := false
	mock := defaultMockFS()
	mock.copyFn = func(_ context.Context, source, target string, progress ProgressFunc) error {
		if progress != nil {
			progress(Progress{Operation: OpCopy, Path: target, Completed: 100, Total: 100})
			progressCalled = true
		}
		return nil
	}

	svc, _ := newMockService(mock, nil, allowAllAuth())

	err := svc.Copy(context.Background(), "user", "/src", "/dst", func(p Progress) {
		progressCalled = true
		if p.Completed != 100 || p.Total != 100 {
			t.Errorf("unexpected progress values: %+v", p)
		}
	})
	if err != nil {
		t.Fatalf("Copy failed: %v", err)
	}
	if !progressCalled {
		t.Error("expected progress callback to be called")
	}
}

func TestServiceAuthorizationForOperations(t *testing.T) {
	mock := defaultMockFS()

	authorizedOps := map[Operation]bool{
		OpList: true, OpRead: true, OpStat: true,
	}

	auth := &mockAuthorizer{
		authorizeFn: func(_ context.Context, _ string, op Operation) error {
			if authorizedOps[op] {
				return nil
			}
			return ErrPermissionDenied
		},
	}
	svc, _ := newMockService(mock, nil, auth)

	_, err := svc.List(context.Background(), "readonly", "/")
	if err != nil {
		t.Errorf("list should be allowed: %v", err)
	}

	_, _, err = svc.Read(context.Background(), "readonly", "/test.txt")
	if err != nil {
		t.Errorf("read should be allowed: %v", err)
	}

	_, err = svc.Stat(context.Background(), "readonly", "/test.txt")
	if err != nil {
		t.Errorf("stat should be allowed: %v", err)
	}

	err = svc.Write(context.Background(), "readonly", "/test.txt", strings.NewReader("data"), 4)
	if !errors.Is(err, ErrPermissionDenied) {
		t.Errorf("write should be denied for readonly: %v", err)
	}

	err = svc.Delete(context.Background(), "readonly", "/test.txt")
	if !errors.Is(err, ErrPermissionDenied) {
		t.Errorf("delete should be denied for readonly: %v", err)
	}
}

func TestServiceMoveContextPropagation(t *testing.T) {
	gotCtx := context.Background()
	mock := defaultMockFS()
	mock.moveFn = func(ctx context.Context, source, target string, _ ProgressFunc) error {
		gotCtx = ctx
		return nil
	}

	svc, _ := newMockService(mock, nil, allowAllAuth())
	ctx := context.WithValue(context.Background(), contextKey("test"), "value")
	err := svc.Move(ctx, "user", "/src", "/dst", nil)
	if err != nil {
		t.Fatalf("Move failed: %v", err)
	}
	if gotCtx.Value(contextKey("test")) != "value" {
		t.Error("context was not propagated through Move")
	}
}

func TestServiceCopyContextPropagation(t *testing.T) {
	gotCtx := context.Background()
	mock := defaultMockFS()
	mock.copyFn = func(ctx context.Context, source, target string, _ ProgressFunc) error {
		gotCtx = ctx
		return nil
	}

	svc, _ := newMockService(mock, nil, allowAllAuth())
	ctx := context.WithValue(context.Background(), contextKey("test"), "value")
	err := svc.Copy(ctx, "user", "/src", "/dst", nil)
	if err != nil {
		t.Fatalf("Copy failed: %v", err)
	}
	if gotCtx.Value(contextKey("test")) != "value" {
		t.Error("context was not propagated through Copy")
	}
}

func TestServiceMoveFailsWithCancelledContext(t *testing.T) {
	mock := defaultMockFS()
	mock.moveFn = func(ctx context.Context, source, target string, _ ProgressFunc) error {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			return nil
		}
	}

	svc, _ := newMockService(mock, nil, allowAllAuth())
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	err := svc.Move(ctx, "user", "/src", "/dst", nil)
	if !errors.Is(err, context.Canceled) {
		t.Errorf("expected context.Canceled, got %v", err)
	}
}

type contextKey string

func TestServiceCopyFailsWithCancelledContext(t *testing.T) {
	mock := defaultMockFS()
	mock.copyFn = func(ctx context.Context, source, target string, _ ProgressFunc) error {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			return nil
		}
	}

	svc, _ := newMockService(mock, nil, allowAllAuth())
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	err := svc.Copy(ctx, "user", "/src", "/dst", nil)
	if !errors.Is(err, context.Canceled) {
		t.Errorf("expected context.Canceled, got %v", err)
	}
}

func TestServiceMoveFailedDoesNotDeleteSource(t *testing.T) {
	sourceDeleted := false
	mock := defaultMockFS()
	mock.moveFn = func(ctx context.Context, source, target string, _ ProgressFunc) error {
		return errors.New("copy failed")
	}

	deleteFn := mock.deleteFn
	mock.deleteFn = func(ctx context.Context, path string) error {
		if path == "/src" {
			sourceDeleted = true
		}
		return deleteFn(ctx, path)
	}

	svc, _ := newMockService(mock, nil, allowAllAuth())
	err := svc.Move(context.Background(), "user", "/src", "/dst", nil)
	if err == nil {
		t.Fatal("expected move to fail")
	}
	if sourceDeleted {
		t.Error("source was marked as deleted despite failed copy")
	}
}
