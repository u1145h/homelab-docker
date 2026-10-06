package terminal

import (
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"

	"github.com/creack/pty"
)

type ptyInstance struct {
	master *os.File
	cmd    *exec.Cmd
	exited chan int
	mu     sync.Mutex
	closed bool
}

func newPTY(shell string, rows, cols uint16) (*ptyInstance, error) {
	path, err := exec.LookPath(shell)
	if err != nil {
		return nil, ErrShellNotFound
	}

	baseShell := strings.ToLower(filepath.Base(path))
	var cmd *exec.Cmd
	if strings.Contains(baseShell, "zsh") || strings.Contains(baseShell, "bash") || strings.Contains(baseShell, "sh") || strings.Contains(baseShell, "ash") {
		cmd = exec.Command(path, "-l")
	} else {
		cmd = exec.Command(path)
	}

	env := os.Environ()
	env = setEnvIfMissing(env, "TERM", "xterm-256color")
	env = setEnvIfMissing(env, "COLORTERM", "truecolor")
	env = setEnvIfMissing(env, "LANG", "en_US.UTF-8")
	cmd.Env = env

	homeDir, err := os.UserHomeDir()
	if err == nil {
		cmd.Dir = homeDir
	}

	winSize := &pty.Winsize{
		Rows: rows,
		Cols: cols,
	}

	master, err := pty.StartWithSize(cmd, winSize)
	if err != nil {
		return nil, err
	}

	inst := &ptyInstance{
		master: master,
		cmd:    cmd,
		exited: make(chan int, 1),
	}

	go func() {
		err := cmd.Wait()
		var exitCode int
		if err != nil {
			var exitErr *exec.ExitError
			if errors.As(err, &exitErr) {
				exitCode = exitErr.ExitCode()
			} else {
				exitCode = -1
			}
		}
		inst.exited <- exitCode
	}()

	return inst, nil
}

func (p *ptyInstance) PID() int {
	if p.cmd != nil && p.cmd.Process != nil {
		return p.cmd.Process.Pid
	}
	return 0
}

func (p *ptyInstance) Read(b []byte) (int, error) {
	p.mu.Lock()
	if p.closed {
		p.mu.Unlock()
		return 0, ErrPTYClosed
	}
	p.mu.Unlock()

	n, err := p.master.Read(b)
	if err != nil {
		if errors.Is(err, os.ErrClosed) || errors.Is(err, io.EOF) || isEIO(err) {
			return n, ErrPTYClosed
		}
	}
	return n, err
}

func (p *ptyInstance) Write(b []byte) (int, error) {
	p.mu.Lock()
	if p.closed {
		p.mu.Unlock()
		return 0, ErrPTYClosed
	}
	p.mu.Unlock()

	n, err := p.master.Write(b)
	if err != nil {
		if errors.Is(err, os.ErrClosed) {
			return n, ErrPTYClosed
		}
	}
	return n, err
}

func (p *ptyInstance) Close() error {
	p.mu.Lock()
	if p.closed {
		p.mu.Unlock()
		return ErrPTYClosed
	}
	p.closed = true
	p.mu.Unlock()

	return p.master.Close()
}

func (p *ptyInstance) Resize(rows, cols uint16) error {
	p.mu.Lock()
	if p.closed {
		p.mu.Unlock()
		return ErrPTYClosed
	}
	p.mu.Unlock()

	winSize := &pty.Winsize{
		Rows: rows,
		Cols: cols,
	}
	return pty.Setsize(p.master, winSize)
}

func (p *ptyInstance) Wait() (int, error) {
	exitCode := <-p.exited
	if exitCode != 0 {
		return exitCode, ErrPTYExited
	}
	return exitCode, nil
}

func isEIO(err error) bool {
	if err == nil {
		return false
	}
	var pathErr *os.PathError
	if errors.As(err, &pathErr) {
		var errno syscall.Errno
		if errors.As(pathErr.Err, &errno) && errno == syscall.EIO {
			return true
		}
	}
	return strings.Contains(err.Error(), "input/output error")
}

func setEnvIfMissing(env []string, key, defaultValue string) []string {
	prefix := key + "="
	for _, item := range env {
		if strings.HasPrefix(item, prefix) {
			return env
		}
	}
	return append(env, key+"="+defaultValue)
}
