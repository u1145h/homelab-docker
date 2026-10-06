package tui

import (
	"os"
	"os/exec"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
)

type LogsModule struct {
	Lines   []string
	Loading bool
	Err     error
}

type logsLoadedMsg struct {
	Lines []string
	Err   error
}

func fetchSystemLogs() tea.Cmd {
	return func() tea.Msg {
		// Priority 1: journalctl -n 200 -e --no-pager
		out, err := exec.Command("journalctl", "-n", "200", "-e", "--no-pager").Output()
		if err == nil && len(out) > 0 {
			lines := strings.Split(strings.TrimSpace(string(out)), "\n")
			return logsLoadedMsg{Lines: lines}
		}

		// Priority 2: dmesg | tail -n 200
		out, err = exec.Command("sh", "-c", "dmesg | tail -n 200").Output()
		if err == nil && len(out) > 0 {
			lines := strings.Split(strings.TrimSpace(string(out)), "\n")
			return logsLoadedMsg{Lines: lines}
		}

		// Priority 3: Read /var/log/syslog or /var/log/messages
		for _, logFile := range []string{"/var/log/syslog", "/var/log/messages"} {
			data, err := os.ReadFile(logFile)
			if err == nil && len(data) > 0 {
				allLines := strings.Split(strings.TrimSpace(string(data)), "\n")
				if len(allLines) > 200 {
					allLines = allLines[len(allLines)-200:]
				}
				return logsLoadedMsg{Lines: allLines}
			}
		}

		return logsLoadedMsg{Lines: []string{"No system logs available or insufficient permissions."}}
	}
}

func updateLogs(m Model, msg tea.Msg) (Model, tea.Cmd, bool) {
	switch msg := msg.(type) {
	case tickMsg:
		if m.Page == PageLogs && (len(m.Logs.Lines) == 0 || !m.Logs.Loading) {
			m.Logs.Loading = true
			return m, fetchSystemLogs(), true
		}
		return m, nil, false

	case logsLoadedMsg:
		m.Logs.Loading = false
		if msg.Err != nil {
			m.Logs.Err = msg.Err
		} else {
			m.Logs.Lines = msg.Lines
		}
		return m, nil, true
	}

	return m, nil, false
}
