package terminal

import (
	"errors"
	"fmt"
	"io"
	"net"
	"time"

	"golang.org/x/crypto/ssh"
)

type SSHConfig struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"username"`
	Password string `json:"password,omitempty"`
	Key      string `json:"key,omitempty"` // PEM-encoded private key
}

type sshPTY struct {
	client  *ssh.Client
	session *ssh.Session
	stdin   io.WriteCloser
	stdout  io.Reader
}

func newSSHPTY(cfg SSHConfig, rows, cols uint16) (*sshPTY, error) {
	if cfg.Host == "" {
		return nil, errors.New("ssh: host is required")
	}
	if cfg.Username == "" {
		return nil, errors.New("ssh: username is required")
	}
	if cfg.Port == 0 {
		cfg.Port = 22
	}

	authMethods := []ssh.AuthMethod{}
	if cfg.Key != "" {
		signer, err := ssh.ParsePrivateKey([]byte(cfg.Key))
		if err != nil {
			return nil, fmt.Errorf("ssh: invalid private key: %w", err)
		}
		authMethods = append(authMethods, ssh.PublicKeys(signer))
	}
	if cfg.Password != "" {
		authMethods = append(authMethods, ssh.Password(cfg.Password))
	}
	if len(authMethods) == 0 {
		return nil, errors.New("ssh: password or private key is required")
	}

	clientConfig := &ssh.ClientConfig{
		User:            cfg.Username,
		Auth:            authMethods,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}

	addr := net.JoinHostPort(cfg.Host, fmt.Sprintf("%d", cfg.Port))
	client, err := ssh.Dial("tcp", addr, clientConfig)
	if err != nil {
		return nil, fmt.Errorf("ssh: dial failed: %w", err)
	}

	session, err := client.NewSession()
	if err != nil {
		client.Close()
		return nil, fmt.Errorf("ssh: session creation failed: %w", err)
	}

	modes := ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.TTY_OP_ISPEED: 115200,
		ssh.TTY_OP_OSPEED: 115200,
	}

	if err := session.RequestPty("xterm-256color", int(rows), int(cols), modes); err != nil {
		session.Close()
		client.Close()
		return nil, fmt.Errorf("ssh: pty request failed: %w", err)
	}

	stdin, err := session.StdinPipe()
	if err != nil {
		session.Close()
		client.Close()
		return nil, fmt.Errorf("ssh: stdin pipe failed: %w", err)
	}

	stdout, err := session.StdoutPipe()
	if err != nil {
		session.Close()
		client.Close()
		return nil, fmt.Errorf("ssh: stdout pipe failed: %w", err)
	}

	if err := session.Shell(); err != nil {
		session.Close()
		client.Close()
		return nil, fmt.Errorf("ssh: shell start failed: %w", err)
	}

	return &sshPTY{
		client:  client,
		session: session,
		stdin:   stdin,
		stdout:  stdout,
	}, nil
}

func (s *sshPTY) PID() int {
	return 0
}

func (s *sshPTY) Read(b []byte) (int, error) {
	return s.stdout.Read(b)
}

func (s *sshPTY) Write(b []byte) (int, error) {
	return s.stdin.Write(b)
}

func (s *sshPTY) Close() error {
	sessionErr := s.session.Close()
	clientErr := s.client.Close()
	if sessionErr != nil {
		return sessionErr
	}
	return clientErr
}

func (s *sshPTY) Resize(rows, cols uint16) error {
	return s.session.WindowChange(int(rows), int(cols))
}

func (s *sshPTY) Wait() (int, error) {
	err := s.session.Wait()
	if err == nil {
		return 0, nil
	}
	var exitErr *ssh.ExitError
	if errors.As(err, &exitErr) {
		return exitErr.ExitStatus(), nil
	}
	return 0, err
}
