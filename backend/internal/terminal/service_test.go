package terminal

import (
	"context"
	"errors"
	"io"
	"runtime"
	"testing"
	"time"
)

type mockPTY struct {
	pid       int
	data      string
	readErr   error
	writeErr  error
	closeErr  error
	resizeErr error
	waitCode  int
	waitErr   error
	closed    bool
}

func (m *mockPTY) PID() int { return m.pid }
func (m *mockPTY) Read(b []byte) (int, error) {
	if m.closed {
		return 0, ErrPTYClosed
	}
	return copy(b, m.data), m.readErr
}
func (m *mockPTY) Write(b []byte) (int, error) {
	if m.closed {
		return 0, ErrPTYClosed
	}
	return len(b), m.writeErr
}
func (m *mockPTY) Close() error {
	if m.closed {
		return ErrPTYClosed
	}
	m.closed = true
	return m.closeErr
}
func (m *mockPTY) Resize(rows, cols uint16) error { return m.resizeErr }
func (m *mockPTY) Wait() (int, error)             { return m.waitCode, m.waitErr }

type mockManager struct {
	pty PTY
	err error
}

func (m *mockManager) Create(shell string, rows, cols uint16) (PTY, error) {
	return m.pty, m.err
}

type mockStore struct {
	sessions map[string]*SessionMetadata
	err      error
}

func (m *mockStore) Create(_ context.Context, meta *SessionMetadata) error {
	if m.err != nil {
		return m.err
	}
	m.sessions[meta.ID] = meta
	return nil
}

func (m *mockStore) Get(_ context.Context, id string) (*SessionMetadata, error) {
	if m.err != nil {
		return nil, m.err
	}
	s, ok := m.sessions[id]
	if !ok {
		return nil, ErrSessionNotFound
	}
	return s, nil
}

func (m *mockStore) List(_ context.Context) ([]SessionMetadata, error) {
	if m.err != nil {
		return nil, m.err
	}
	result := make([]SessionMetadata, 0, len(m.sessions))
	for _, s := range m.sessions {
		result = append(result, *s)
	}
	return result, nil
}

func (m *mockStore) Delete(_ context.Context, id string) error {
	if m.err != nil {
		return m.err
	}
	delete(m.sessions, id)
	return nil
}

func (m *mockStore) Update(_ context.Context, meta *SessionMetadata) error {
	if m.err != nil {
		return m.err
	}
	m.sessions[meta.ID] = meta
	return nil
}

type mockAuthorizer struct {
	terminalErr error
	ownerErr    error
}

func (m *mockAuthorizer) AuthorizeTerminal(_ context.Context, _ string) error {
	return m.terminalErr
}

func (m *mockAuthorizer) AuthorizeSessionOwner(_ context.Context, _, _ string) error {
	return m.ownerErr
}

func defaultShell() string {
	if runtime.GOOS == "windows" {
		return "cmd.exe"
	}
	return "/bin/bash"
}

func defaultConfig() Config {
	return Config{
		DefaultShell:    defaultShell(),
		MaxSessions:     10,
		IdleTimeout:     5 * time.Minute,
		DefaultRows:     24,
		DefaultCols:     80,
		MaxOutputBuffer: 65536,
		MaxInputSize:    4096,
		ReadBufferSize:  4096,
		WriteBufferSize: 4096,
	}
}

func newTestService(store SessionStore, manager Manager, authz Authorizer) *Service {
	return NewService(store, manager, nil, authz, defaultConfig())
}

func TestCreateSession_Success(t *testing.T) {
	pty := &mockPTY{pid: 100}
	store := &mockStore{sessions: make(map[string]*SessionMetadata)}
	authz := &mockAuthorizer{}
	svc := newTestService(store, &mockManager{pty: pty}, authz)

	session, err := svc.CreateSession(context.Background(), "alice", CreateSessionRequest{
		Shell: defaultShell(),
		Rows:  24,
		Cols:  80,
	})
	if err != nil {
		t.Fatal(err)
	}
	if session.PID != 100 {
		t.Errorf("expected PID 100, got %d", session.PID)
	}
	if session.User != "alice" {
		t.Errorf("expected User alice, got %s", session.User)
	}
	if session.Shell != defaultShell() {
		t.Errorf("expected Shell /bin/bash, got %s", session.Shell)
	}
	if session.Rows != 24 {
		t.Errorf("expected Rows 24, got %d", session.Rows)
	}
	if session.Cols != 80 {
		t.Errorf("expected Cols 80, got %d", session.Cols)
	}
	if session.ClosedAt != nil {
		t.Error("expected ClosedAt to be nil")
	}
	if session.ExitCode != nil {
		t.Error("expected ExitCode to be nil")
	}
}

func TestCreateSession_Defaults(t *testing.T) {
	pty := &mockPTY{pid: 101}
	store := &mockStore{sessions: make(map[string]*SessionMetadata)}
	authz := &mockAuthorizer{}
	svc := newTestService(store, &mockManager{pty: pty}, authz)

	session, err := svc.CreateSession(context.Background(), "bob", CreateSessionRequest{})
	if err != nil {
		t.Fatal(err)
	}
	if session.Shell != defaultShell() {
		t.Errorf("expected default shell /bin/bash, got %s", session.Shell)
	}
	if session.Rows != 24 {
		t.Errorf("expected default Rows 24, got %d", session.Rows)
	}
	if session.Cols != 80 {
		t.Errorf("expected default Cols 80, got %d", session.Cols)
	}
}

func TestCreateSession_Unauthorized(t *testing.T) {
	store := &mockStore{sessions: make(map[string]*SessionMetadata)}
	authz := &mockAuthorizer{terminalErr: ErrPermissionDenied}
	svc := newTestService(store, &mockManager{}, authz)

	_, err := svc.CreateSession(context.Background(), "alice", CreateSessionRequest{})
	if !errors.Is(err, ErrPermissionDenied) {
		t.Fatalf("expected ErrPermissionDenied, got %v", err)
	}
}

func TestCreateSession_TooManySessions(t *testing.T) {
	pty := &mockPTY{pid: 200}
	store := &mockStore{sessions: make(map[string]*SessionMetadata)}
	authz := &mockAuthorizer{}
	cfg := defaultConfig()
	cfg.MaxSessions = 1
	svc := NewService(store, &mockManager{pty: pty}, nil, authz, cfg)

	_, err := svc.CreateSession(context.Background(), "alice", CreateSessionRequest{
		Shell: defaultShell(),
		Rows:  24,
		Cols:  80,
	})
	if err != nil {
		t.Fatal(err)
	}

	_, err = svc.CreateSession(context.Background(), "alice", CreateSessionRequest{
		Shell: defaultShell(),
		Rows:  24,
		Cols:  80,
	})
	if !errors.Is(err, ErrTooManySessions) {
		t.Fatalf("expected ErrTooManySessions, got %v", err)
	}
}

func TestCreateSession_InvalidSize(t *testing.T) {
	store := &mockStore{sessions: make(map[string]*SessionMetadata)}
	authz := &mockAuthorizer{}
	pty := &mockPTY{pid: 99}

	cfg := defaultConfig()
	cfg.DefaultRows = 0
	cfg.DefaultCols = 0
	svc := NewService(store, &mockManager{pty: pty}, nil, authz, cfg)

	_, err := svc.CreateSession(context.Background(), "alice", CreateSessionRequest{
		Shell: defaultShell(),
		Rows:  0,
		Cols:  0,
	})
	if !errors.Is(err, ErrInvalidSize) {
		t.Fatalf("expected ErrInvalidSize, got %v", err)
	}
}

func TestCreateSession_ShellUnavailable(t *testing.T) {
	store := &mockStore{sessions: make(map[string]*SessionMetadata)}
	authz := &mockAuthorizer{}
	svc := newTestService(store, &mockManager{}, authz)

	_, err := svc.CreateSession(context.Background(), "alice", CreateSessionRequest{
		Shell: "/bin/nonexistent",
		Rows:  24,
		Cols:  80,
	})
	if !errors.Is(err, ErrShellUnavailable) {
		t.Fatalf("expected ErrShellUnavailable, got %v", err)
	}
}

func TestCreateSession_PTYFailure(t *testing.T) {
	store := &mockStore{sessions: make(map[string]*SessionMetadata)}
	authz := &mockAuthorizer{}
	svc := newTestService(store, &mockManager{err: errors.New("fork failed")}, authz)

	_, err := svc.CreateSession(context.Background(), "alice", CreateSessionRequest{
		Shell: defaultShell(),
		Rows:  24,
		Cols:  80,
	})
	if !errors.Is(err, ErrTerminalUnavailable) {
		t.Fatalf("expected ErrTerminalUnavailable, got %v", err)
	}
}

func TestListSessions_Success(t *testing.T) {
	pty := &mockPTY{pid: 300}
	store := &mockStore{sessions: make(map[string]*SessionMetadata)}
	authz := &mockAuthorizer{}
	svc := newTestService(store, &mockManager{pty: pty}, authz)

	_, err := svc.CreateSession(context.Background(), "alice", CreateSessionRequest{
		Shell: defaultShell(),
		Rows:  24,
		Cols:  80,
	})
	if err != nil {
		t.Fatal(err)
	}

	sessions, err := svc.ListSessions(context.Background(), "alice")
	if err != nil {
		t.Fatal(err)
	}
	if len(sessions) != 1 {
		t.Fatalf("expected 1 session, got %d", len(sessions))
	}
}

func TestGetSession_Success(t *testing.T) {
	pty := &mockPTY{pid: 400}
	store := &mockStore{sessions: make(map[string]*SessionMetadata)}
	authz := &mockAuthorizer{}
	svc := newTestService(store, &mockManager{pty: pty}, authz)

	created, err := svc.CreateSession(context.Background(), "alice", CreateSessionRequest{
		Shell: defaultShell(),
		Rows:  24,
		Cols:  80,
	})
	if err != nil {
		t.Fatal(err)
	}

	got, err := svc.GetSession(context.Background(), "alice", created.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.ID != created.ID {
		t.Errorf("expected ID %s, got %s", created.ID, got.ID)
	}
}

func TestGetSession_NotFound(t *testing.T) {
	authz := &mockAuthorizer{}
	svc := newTestService(&mockStore{sessions: make(map[string]*SessionMetadata)}, &mockManager{}, authz)

	_, err := svc.GetSession(context.Background(), "alice", "nonexistent")
	if !errors.Is(err, ErrSessionNotFound) {
		t.Fatalf("expected ErrSessionNotFound, got %v", err)
	}
}

func TestGetSession_NotOwned(t *testing.T) {
	pty := &mockPTY{pid: 500}
	store := &mockStore{sessions: make(map[string]*SessionMetadata)}
	authz := &mockAuthorizer{ownerErr: ErrSessionNotOwned}
	svc := newTestService(store, &mockManager{pty: pty}, authz)

	created, err := svc.CreateSession(context.Background(), "alice", CreateSessionRequest{
		Shell: defaultShell(),
		Rows:  24,
		Cols:  80,
	})
	if err != nil {
		t.Fatal(err)
	}

	_, err = svc.GetSession(context.Background(), "bob", created.ID)
	if !errors.Is(err, ErrSessionNotOwned) {
		t.Fatalf("expected ErrSessionNotOwned, got %v", err)
	}
}

func TestCloseSession_Success(t *testing.T) {
	pty := &mockPTY{pid: 600}
	store := &mockStore{sessions: make(map[string]*SessionMetadata)}
	authz := &mockAuthorizer{}
	svc := newTestService(store, &mockManager{pty: pty}, authz)

	created, err := svc.CreateSession(context.Background(), "alice", CreateSessionRequest{
		Shell: defaultShell(),
		Rows:  24,
		Cols:  80,
	})
	if err != nil {
		t.Fatal(err)
	}

	if err := svc.CloseSession(context.Background(), "alice", created.ID); err != nil {
		t.Fatal(err)
	}

	meta, _ := store.Get(context.Background(), created.ID)
	if meta.ClosedAt == nil {
		t.Error("expected ClosedAt to be set")
	}
}

func TestCloseSession_NotFound(t *testing.T) {
	authz := &mockAuthorizer{}
	svc := newTestService(&mockStore{sessions: make(map[string]*SessionMetadata)}, &mockManager{}, authz)

	err := svc.CloseSession(context.Background(), "alice", "nonexistent")
	if !errors.Is(err, ErrSessionNotFound) {
		t.Fatalf("expected ErrSessionNotFound, got %v", err)
	}
}

func TestCloseSession_AlreadyClosed(t *testing.T) {
	pty := &mockPTY{pid: 700}
	store := &mockStore{sessions: make(map[string]*SessionMetadata)}
	authz := &mockAuthorizer{}
	svc := newTestService(store, &mockManager{pty: pty}, authz)

	created, err := svc.CreateSession(context.Background(), "alice", CreateSessionRequest{
		Shell: defaultShell(),
		Rows:  24,
		Cols:  80,
	})
	if err != nil {
		t.Fatal(err)
	}

	_ = svc.CloseSession(context.Background(), "alice", created.ID)
	err = svc.CloseSession(context.Background(), "alice", created.ID)
	if !errors.Is(err, ErrSessionClosed) {
		t.Fatalf("expected ErrSessionClosed, got %v", err)
	}
}

func TestResizeSession_Success(t *testing.T) {
	pty := &mockPTY{pid: 800}
	store := &mockStore{sessions: make(map[string]*SessionMetadata)}
	authz := &mockAuthorizer{}
	svc := newTestService(store, &mockManager{pty: pty}, authz)

	created, err := svc.CreateSession(context.Background(), "alice", CreateSessionRequest{
		Shell: defaultShell(),
		Rows:  24,
		Cols:  80,
	})
	if err != nil {
		t.Fatal(err)
	}

	if err := svc.ResizeSession(context.Background(), "alice", created.ID, 40, 120); err != nil {
		t.Fatal(err)
	}

	meta, _ := store.Get(context.Background(), created.ID)
	if meta.Rows != 40 {
		t.Errorf("expected Rows 40, got %d", meta.Rows)
	}
	if meta.Cols != 120 {
		t.Errorf("expected Cols 120, got %d", meta.Cols)
	}
}

func TestResizeSession_InvalidSize(t *testing.T) {
	pty := &mockPTY{pid: 900}
	store := &mockStore{sessions: make(map[string]*SessionMetadata)}
	authz := &mockAuthorizer{}
	svc := newTestService(store, &mockManager{pty: pty}, authz)

	created, err := svc.CreateSession(context.Background(), "alice", CreateSessionRequest{
		Shell: defaultShell(),
		Rows:  24,
		Cols:  80,
	})
	if err != nil {
		t.Fatal(err)
	}

	err = svc.ResizeSession(context.Background(), "alice", created.ID, 0, 0)
	if !errors.Is(err, ErrInvalidSize) {
		t.Fatalf("expected ErrInvalidSize, got %v", err)
	}
}

func TestResizeSession_NotFound(t *testing.T) {
	authz := &mockAuthorizer{}
	svc := newTestService(&mockStore{sessions: make(map[string]*SessionMetadata)}, &mockManager{}, authz)

	err := svc.ResizeSession(context.Background(), "alice", "nonexistent", 40, 120)
	if !errors.Is(err, ErrSessionNotFound) {
		t.Fatalf("expected ErrSessionNotFound, got %v", err)
	}
}

func TestAttachSession_Success(t *testing.T) {
	pty := &mockPTY{pid: 1000}
	store := &mockStore{sessions: make(map[string]*SessionMetadata)}
	authz := &mockAuthorizer{}
	svc := newTestService(store, &mockManager{pty: pty}, authz)

	created, err := svc.CreateSession(context.Background(), "alice", CreateSessionRequest{
		Shell: defaultShell(),
		Rows:  24,
		Cols:  80,
	})
	if err != nil {
		t.Fatal(err)
	}

	rt, err := svc.AttachSession(context.Background(), "alice", created.ID)
	if err != nil {
		t.Fatal(err)
	}
	if rt.PTY.PID() != 1000 {
		t.Errorf("expected PID 1000, got %d", rt.PTY.PID())
	}
}

func TestAttachSession_NotOwned(t *testing.T) {
	pty := &mockPTY{pid: 1100}
	store := &mockStore{sessions: make(map[string]*SessionMetadata)}
	authz := &mockAuthorizer{ownerErr: ErrSessionNotOwned}
	svc := newTestService(store, &mockManager{pty: pty}, authz)

	created, err := svc.CreateSession(context.Background(), "alice", CreateSessionRequest{
		Shell: defaultShell(),
		Rows:  24,
		Cols:  80,
	})
	if err != nil {
		t.Fatal(err)
	}

	_, err = svc.AttachSession(context.Background(), "bob", created.ID)
	if !errors.Is(err, ErrSessionNotOwned) {
		t.Fatalf("expected ErrSessionNotOwned, got %v", err)
	}
}

func TestAttachSession_Closed(t *testing.T) {
	pty := &mockPTY{pid: 1200}
	store := &mockStore{sessions: make(map[string]*SessionMetadata)}
	authz := &mockAuthorizer{}
	svc := newTestService(store, &mockManager{pty: pty}, authz)

	created, err := svc.CreateSession(context.Background(), "alice", CreateSessionRequest{
		Shell: defaultShell(),
		Rows:  24,
		Cols:  80,
	})
	if err != nil {
		t.Fatal(err)
	}

	_ = svc.CloseSession(context.Background(), "alice", created.ID)

	_, err = svc.AttachSession(context.Background(), "alice", created.ID)
	if !errors.Is(err, ErrSessionClosed) {
		t.Fatalf("expected ErrSessionClosed, got %v", err)
	}
}

func TestReportActivity(t *testing.T) {
	pty := &mockPTY{pid: 1300}
	store := &mockStore{sessions: make(map[string]*SessionMetadata)}
	authz := &mockAuthorizer{}
	svc := newTestService(store, &mockManager{pty: pty}, authz)

	created, err := svc.CreateSession(context.Background(), "alice", CreateSessionRequest{
		Shell: defaultShell(),
		Rows:  24,
		Cols:  80,
	})
	if err != nil {
		t.Fatal(err)
	}

	svc.mu.RLock()
	rt := svc.runtimes[created.ID]
	svc.mu.RUnlock()

	oldActivity := rt.LastActivity

	time.Sleep(time.Millisecond)

	svc.ReportActivity(context.Background(), created.ID)

	svc.mu.RLock()
	rt = svc.runtimes[created.ID]
	svc.mu.RUnlock()

	if !rt.LastActivity.After(oldActivity) {
		t.Error("expected LastActivity to be updated")
	}
}

func TestErrorMapping_PTYClosed(t *testing.T) {
	err := mapPTYError(ErrPTYClosed)
	if !errors.Is(err, ErrSessionClosed) {
		t.Fatalf("expected ErrSessionClosed, got %v", err)
	}
}

func TestErrorMapping_PTYExited(t *testing.T) {
	err := mapPTYError(ErrPTYExited)
	if !errors.Is(err, ErrSessionClosed) {
		t.Fatalf("expected ErrSessionClosed, got %v", err)
	}
}

func TestErrorMapping_ShellNotFound(t *testing.T) {
	err := mapPTYError(ErrShellNotFound)
	if !errors.Is(err, ErrShellUnavailable) {
		t.Fatalf("expected ErrShellUnavailable, got %v", err)
	}
}

func TestErrorMapping_Unknown(t *testing.T) {
	err := mapPTYError(io.EOF)
	if !errors.Is(err, ErrTerminalUnavailable) {
		t.Fatalf("expected ErrTerminalUnavailable, got %v", err)
	}
}
