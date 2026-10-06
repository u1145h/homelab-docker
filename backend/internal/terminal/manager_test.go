package terminal

import (
	"errors"
	"testing"
)

func TestNewManager(t *testing.T) {
	m := NewManager()
	if m == nil {
		t.Fatal("expected non-nil Manager")
	}
}

func TestManagerCreate_ShellNotFound(t *testing.T) {
	m := NewManager()
	pty, err := m.Create("/bin/nonexistent_shell", 24, 80)
	if pty != nil {
		t.Error("expected nil PTY for nonexistent shell")
	}
	if !errors.Is(err, ErrShellNotFound) {
		t.Errorf("expected ErrShellNotFound, got %v", err)
	}
}

func TestManagerCreate_EmptyShell(t *testing.T) {
	m := NewManager()
	pty, err := m.Create("", 24, 80)
	if pty != nil {
		t.Error("expected nil PTY for empty shell")
	}
	if !errors.Is(err, ErrShellNotFound) {
		t.Errorf("expected ErrShellNotFound, got %v", err)
	}
}
