package terminal

import (
	"context"
	"time"
)

type Config struct {
	DefaultShell    string
	MaxSessions     int
	IdleTimeout     time.Duration
	DefaultRows     uint16
	DefaultCols     uint16
	MaxOutputBuffer int
	MaxInputSize    int
	ReadBufferSize  int
	WriteBufferSize int
	AllowedOrigins  []string
}

type SessionMetadata struct {
	ID        string     `json:"id"`
	User      string     `json:"user"`
	PID       int        `json:"pid"`
	Shell     string     `json:"shell"`
	Rows      uint16     `json:"rows"`
	Cols      uint16     `json:"cols"`
	CreatedAt time.Time  `json:"createdAt"`
	ClosedAt  *time.Time `json:"closedAt,omitempty"`
	ExitCode  *int       `json:"exitCode,omitempty"`
}

type SessionRuntime struct {
	PTY          PTY
	LastActivity time.Time
	Cancel       context.CancelFunc
	timer        *time.Timer
}

type CreateSessionRequest struct {
	Shell string     `json:"shell,omitempty"`
	Rows  uint16     `json:"rows,omitempty"`
	Cols  uint16     `json:"cols,omitempty"`
	SSH   *SSHConfig `json:"ssh,omitempty"`
}

type SessionResponse struct {
	ID        string     `json:"id"`
	User      string     `json:"user"`
	PID       int        `json:"pid"`
	Shell     string     `json:"shell"`
	Rows      uint16     `json:"rows"`
	Cols      uint16     `json:"cols"`
	CreatedAt time.Time  `json:"createdAt"`
	ClosedAt  *time.Time `json:"closedAt,omitempty"`
	ExitCode  *int       `json:"exitCode,omitempty"`
}

type ListSessionsResponse struct {
	Sessions []SessionResponse `json:"sessions"`
}

type ResizeRequest struct {
	Rows uint16 `json:"rows"`
	Cols uint16 `json:"cols"`
}

type WSMessageType string

const (
	WSMessageInput  WSMessageType = "input"
	WSMessageOutput WSMessageType = "output"
	WSMessageResize WSMessageType = "resize"
	WSMessagePing   WSMessageType = "ping"
	WSMessagePong   WSMessageType = "pong"
	WSMessageExit   WSMessageType = "exit"
)

type WSMessage struct {
	Type WSMessageType `json:"type"`
	Data string        `json:"data,omitempty"`
	Rows uint16        `json:"rows,omitempty"`
	Cols uint16        `json:"cols,omitempty"`
	Code int           `json:"code,omitempty"`
}
