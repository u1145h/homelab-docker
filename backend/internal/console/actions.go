package console

import (
	"os/exec"

	tea "github.com/charmbracelet/bubbletea"
)

func execNmtui(_ *Model) tea.Cmd {
	return tea.ExecProcess(exec.Command("nmtui"), func(err error) tea.Msg {
		return commandFinishedMsg{name: "nmtui", err: err}
	})
}

func restartBackend(_ *Model) tea.Cmd {
	return tea.ExecProcess(exec.Command("systemctl", "restart", "poco-backend"), func(err error) tea.Msg {
		return commandFinishedMsg{name: "restart-backend", err: err}
	})
}

func restartDocker(_ *Model) tea.Cmd {
	return tea.ExecProcess(exec.Command("systemctl", "restart", "docker"), func(err error) tea.Msg {
		return commandFinishedMsg{name: "restart-docker", err: err}
	})
}

func viewLogs(_ *Model) tea.Cmd {
	return tea.ExecProcess(exec.Command("journalctl", "-n", "50", "--no-pager"), func(err error) tea.Msg {
		return commandFinishedMsg{name: "logs", err: err}
	})
}

func systemReboot(_ *Model) tea.Cmd {
	return tea.ExecProcess(exec.Command("systemctl", "reboot"), func(err error) tea.Msg {
		return commandFinishedMsg{name: "reboot", err: err}
	})
}

func systemPoweroff(_ *Model) tea.Cmd {
	return tea.ExecProcess(exec.Command("systemctl", "poweroff"), func(err error) tea.Msg {
		return commandFinishedMsg{name: "poweroff", err: err}
	})
}

func noopAction(_ *Model) tea.Cmd {
	return nil
}
