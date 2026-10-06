package terminal

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"sync"
	"time"

	"github.com/ullashroy/poco-server/backend/internal/audit"
)

type Service struct {
	store      SessionStore
	manager    Manager
	audit      *audit.Service
	authorizer Authorizer
	config     Config

	mu       sync.RWMutex
	runtimes map[string]*SessionRuntime
}

func NewService(store SessionStore, manager Manager, audit *audit.Service, authorizer Authorizer, config Config) *Service {
	return &Service{
		store:      store,
		manager:    manager,
		audit:      audit,
		authorizer: authorizer,
		config:     config,
		runtimes:   make(map[string]*SessionRuntime),
	}
}

func (s *Service) CreateSession(ctx context.Context, actor string, req CreateSessionRequest) (*SessionResponse, error) {
	if err := s.authorizer.AuthorizeTerminal(ctx, actor); err != nil {
		return nil, err
	}

	rows := req.Rows
	if rows == 0 {
		rows = s.config.DefaultRows
	}
	cols := req.Cols
	if cols == 0 {
		cols = s.config.DefaultCols
	}
	if rows == 0 || cols == 0 {
		return nil, ErrInvalidSize
	}

	s.mu.RLock()
	activeCount := len(s.runtimes)
	s.mu.RUnlock()
	if s.config.MaxSessions > 0 && activeCount >= s.config.MaxSessions {
		return nil, ErrTooManySessions
	}

	var pty PTY
	var shell string
	var isSSH bool

	if req.SSH != nil {
		sshPTY, err := newSSHPTY(*req.SSH, rows, cols)
		if err != nil {
			return nil, fmt.Errorf("%w: %v", ErrSSHUnavailable, err)
		}
		pty = sshPTY
		shell = fmt.Sprintf("ssh://%s@%s:%d", req.SSH.Username, req.SSH.Host, req.SSH.Port)
		isSSH = true
	} else {
		shell = req.Shell
		if shell == "" {
			shell = s.config.DefaultShell
			if _, err := exec.LookPath(shell); err != nil {
				shell = findAvailableShell()
			}
		}
		if shell == "" {
			return nil, ErrShellUnavailable
		}
		if _, err := exec.LookPath(shell); err != nil {
			return nil, ErrShellUnavailable
		}
		var err error
		pty, err = s.manager.Create(shell, rows, cols)
		if err != nil {
			return nil, mapPTYError(err)
		}
	}

	id, err := generateID()
	if err != nil {
		pty.Close()
		return nil, fmt.Errorf("failed to generate session id: %w", err)
	}

	now := time.Now()
	meta := &SessionMetadata{
		ID:        id,
		User:      actor,
		PID:       pty.PID(),
		Shell:     shell,
		Rows:      rows,
		Cols:      cols,
		CreatedAt: now,
	}

	ctx, cancel := context.WithCancel(ctx)
	rt := &SessionRuntime{
		PTY:          pty,
		LastActivity: now,
		Cancel:       cancel,
	}

	s.mu.Lock()
	s.runtimes[id] = rt
	s.mu.Unlock()

	if err := s.store.Create(ctx, meta); err != nil {
		s.mu.Lock()
		delete(s.runtimes, id)
		s.mu.Unlock()
		pty.Close()
		cancel()
		return nil, err
	}

	if !isSSH {
		s.resetIdleTimer(rt, id, actor)
	}

	auditMeta := map[string]any{
		"shell": shell,
		"rows":  rows,
		"cols":  cols,
		"user":  actor,
	}
	if isSSH {
		auditMeta["type"] = "ssh"
	} else {
		auditMeta["pid"] = pty.PID()
	}

	s.auditLog(audit.LogRequest{
		Action:   audit.ActionSessionOpen,
		Actor:    actor,
		Target:   id,
		Status:   audit.StatusSuccess,
		Metadata: auditMeta,
	})

	return toSessionResponse(meta), nil
}

func (s *Service) ListSessions(ctx context.Context, actor string) ([]SessionResponse, error) {
	if err := s.authorizer.AuthorizeTerminal(ctx, actor); err != nil {
		return nil, err
	}

	sessions, err := s.store.List(ctx)
	if err != nil {
		return nil, err
	}

	resp := make([]SessionResponse, 0, len(sessions))
	for _, meta := range sessions {
		resp = append(resp, *toSessionResponse(&meta))
	}
	return resp, nil
}

func (s *Service) GetSession(ctx context.Context, actor, id string) (*SessionResponse, error) {
	if err := s.authorizer.AuthorizeTerminal(ctx, actor); err != nil {
		return nil, err
	}

	meta, err := s.store.Get(ctx, id)
	if err != nil {
		return nil, err
	}

	if err := s.authorizer.AuthorizeSessionOwner(ctx, actor, meta.User); err != nil {
		return nil, err
	}

	return toSessionResponse(meta), nil
}

func (s *Service) CloseSession(ctx context.Context, actor, id string) error {
	if err := s.authorizer.AuthorizeTerminal(ctx, actor); err != nil {
		return err
	}

	meta, err := s.store.Get(ctx, id)
	if err != nil {
		return err
	}

	if err := s.authorizer.AuthorizeSessionOwner(ctx, actor, meta.User); err != nil {
		return err
	}

	return s.closeSession(ctx, actor, id, meta)
}

func (s *Service) closeSession(ctx context.Context, actor, id string, meta *SessionMetadata) error {
	if meta.ClosedAt != nil {
		return ErrSessionClosed
	}

	s.mu.Lock()
	rt, ok := s.runtimes[id]
	if ok {
		delete(s.runtimes, id)
	}
	s.mu.Unlock()

	if rt != nil {
		if rt.timer != nil {
			rt.timer.Stop()
		}
		rt.Cancel()
		rt.PTY.Close()
		exitCode, _ := rt.PTY.Wait()
		meta.ExitCode = &exitCode
	}

	now := time.Now()
	meta.ClosedAt = &now

	if err := s.store.Update(ctx, meta); err != nil {
		return err
	}

	duration := now.Sub(meta.CreatedAt)
	s.auditLog(audit.LogRequest{
		Action: audit.ActionSessionClose,
		Actor:  actor,
		Target: id,
		Status: audit.StatusSuccess,
		Metadata: map[string]any{
			"pid":      meta.PID,
			"shell":    meta.Shell,
			"user":     meta.User,
			"rows":     meta.Rows,
			"cols":     meta.Cols,
			"duration": duration.String(),
			"exitCode": meta.ExitCode,
		},
	})

	return nil
}

func (s *Service) ResizeSession(ctx context.Context, actor, id string, rows, cols uint16) error {
	if err := s.authorizer.AuthorizeTerminal(ctx, actor); err != nil {
		return err
	}

	if rows == 0 || cols == 0 {
		return ErrInvalidSize
	}

	meta, err := s.store.Get(ctx, id)
	if err != nil {
		return err
	}

	if err := s.authorizer.AuthorizeSessionOwner(ctx, actor, meta.User); err != nil {
		return err
	}

	if meta.ClosedAt != nil {
		return ErrSessionClosed
	}

	s.mu.RLock()
	rt, ok := s.runtimes[id]
	s.mu.RUnlock()
	if !ok || rt == nil {
		return ErrSessionClosed
	}

	if err := rt.PTY.Resize(rows, cols); err != nil {
		return mapPTYError(err)
	}

	meta.Rows = rows
	meta.Cols = cols
	if err := s.store.Update(ctx, meta); err != nil {
		return err
	}

	return nil
}

func (s *Service) AttachSession(ctx context.Context, actor, id string) (*SessionRuntime, error) {
	if err := s.authorizer.AuthorizeTerminal(ctx, actor); err != nil {
		return nil, err
	}

	meta, err := s.store.Get(ctx, id)
	if err != nil {
		return nil, err
	}

	if err := s.authorizer.AuthorizeSessionOwner(ctx, actor, meta.User); err != nil {
		return nil, err
	}

	if meta.ClosedAt != nil {
		return nil, ErrSessionClosed
	}

	s.mu.RLock()
	rt, ok := s.runtimes[id]
	s.mu.RUnlock()
	if !ok || rt == nil {
		return nil, ErrSessionClosed
	}

	return rt, nil
}

func (s *Service) ReportActivity(_ context.Context, id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	rt, ok := s.runtimes[id]
	if !ok || rt == nil {
		return
	}
	rt.LastActivity = time.Now()
	if rt.timer != nil {
		rt.timer.Reset(s.config.IdleTimeout)
	}
}

func (s *Service) resetIdleTimer(rt *SessionRuntime, id, actor string) {
	if s.config.IdleTimeout <= 0 {
		return
	}
	rt.timer = time.AfterFunc(s.config.IdleTimeout, func() {
		s.mu.Lock()
		runtime, ok := s.runtimes[id]
		s.mu.Unlock()
		if !ok || runtime == nil {
			return
		}
		meta, err := s.store.Get(context.Background(), id)
		if err != nil {
			return
		}
		_ = s.closeSession(context.Background(), "system", id, meta)
		s.auditLog(audit.LogRequest{
			Action: audit.ActionSessionTimeout,
			Actor:  "system",
			Target: id,
			Status: audit.StatusSuccess,
			Metadata: map[string]any{
				"user": actor,
			},
		})
	})
}

func (s *Service) auditLog(req audit.LogRequest) {
	if s.audit != nil {
		s.audit.Log(req)
	}
}

func generateID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return fmt.Sprintf("%x", b), nil
}

func toSessionResponse(meta *SessionMetadata) *SessionResponse {
	return &SessionResponse{
		ID:        meta.ID,
		User:      meta.User,
		PID:       meta.PID,
		Shell:     meta.Shell,
		Rows:      meta.Rows,
		Cols:      meta.Cols,
		CreatedAt: meta.CreatedAt,
		ClosedAt:  meta.ClosedAt,
		ExitCode:  meta.ExitCode,
	}
}

func mapPTYError(err error) error {
	switch {
	case errors.Is(err, ErrShellNotFound):
		return ErrShellUnavailable
	case errors.Is(err, ErrPTYClosed), errors.Is(err, ErrPTYExited):
		return ErrSessionClosed
	default:
		return ErrTerminalUnavailable
	}
}

func findAvailableShell() string {
	if envShell := os.Getenv("SHELL"); envShell != "" {
		if path, err := exec.LookPath(envShell); err == nil && path != "" {
			return envShell
		}
	}
	candidates := []string{"/bin/zsh", "/usr/bin/zsh", "/bin/bash", "/usr/bin/bash", "/bin/sh", "/bin/ash", "cmd.exe", "powershell.exe"}
	for _, sh := range candidates {
		if path, err := exec.LookPath(sh); err == nil && path != "" {
			return sh
		}
	}
	return ""
}
