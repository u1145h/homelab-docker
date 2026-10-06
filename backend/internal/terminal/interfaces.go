package terminal

import (
	"context"
	"io"
)

type PTY interface {
	PID() int
	io.ReadWriteCloser
	Resize(rows, cols uint16) error
	Wait() (int, error)
}

type Manager interface {
	Create(shell string, rows, cols uint16) (PTY, error)
}

type SessionStore interface {
	Create(ctx context.Context, meta *SessionMetadata) error
	Get(ctx context.Context, id string) (*SessionMetadata, error)
	List(ctx context.Context) ([]SessionMetadata, error)
	Delete(ctx context.Context, id string) error
	Update(ctx context.Context, meta *SessionMetadata) error
}

type Authorizer interface {
	AuthorizeTerminal(ctx context.Context, username string) error
	AuthorizeSessionOwner(ctx context.Context, username, sessionUser string) error
}
