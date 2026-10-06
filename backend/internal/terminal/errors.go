package terminal

import "errors"

// Domain errors - public, used by handlers for HTTP mapping
var (
	ErrSessionNotFound     = errors.New("session not found")
	ErrInvalidSize         = errors.New("invalid terminal size")
	ErrSessionClosed       = errors.New("session is closed")
	ErrTerminalUnavailable = errors.New("terminal is unavailable")
	ErrPermissionDenied    = errors.New("permission denied")
	ErrShellUnavailable    = errors.New("shell is unavailable")
	ErrTooManySessions     = errors.New("too many active sessions")
	ErrSessionNotOwned     = errors.New("session belongs to another user")
)

var (
	ErrSSHUnavailable = errors.New("ssh connection failed")
)

// PTY errors - internal, mapped to domain errors by Service
var (
	ErrPTYClosed     = errors.New("pty is closed")
	ErrPTYExited     = errors.New("pty process has exited")
	ErrShellNotFound = errors.New("shell binary not found")
)
