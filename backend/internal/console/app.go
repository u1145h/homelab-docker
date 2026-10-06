package console

import (
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

const refreshInterval = time.Second

type tickMsg struct{}

func (m Model) Init() tea.Cmd {
	return tick()
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tickMsg:
		m.Status = m.Provider.Status()
		return m, tick()

	case tea.WindowSizeMsg:
		m.Width = msg.Width
		m.Height = msg.Height

	case tea.KeyMsg:
		switch m.Mode {
		case ModeStatus:
			switch msg.String() {
			case "f2":
				m.Mode = ModeExecutingAction
				return m, execNmtui(&m)
			case "f10":
				m.Mode = ModeMenu
			case "q", "ctrl+c":
				return m, tea.Quit
			}

		case ModeMenu:
			switch msg.String() {
			case "up", "k":
				m.Menu.Selected--
				if m.Menu.Selected < 0 {
					m.Menu.Selected = len(m.Menu.Items) - 1
				}
				for m.Menu.Items[m.Menu.Selected].IsSeparator {
					m.Menu.Selected--
					if m.Menu.Selected < 0 {
						m.Menu.Selected = len(m.Menu.Items) - 1
					}
				}
			case "down", "j":
				m.Menu.Selected++
				if m.Menu.Selected >= len(m.Menu.Items) {
					m.Menu.Selected = 0
				}
				for m.Menu.Items[m.Menu.Selected].IsSeparator {
					m.Menu.Selected++
					if m.Menu.Selected >= len(m.Menu.Items) {
						m.Menu.Selected = 0
					}
				}
			case "enter":
				item := m.Menu.Items[m.Menu.Selected]
				if item.IsSeparator {
					break
				}
				if item.NeedsConfirm {
					m.Confirm = item.Label
					m.Mode = ModeConfirm
				} else {
					m.Mode = ModeExecutingAction
					if item.Action != nil {
						cmd := item.Action(&m)
						if cmd != nil {
							return m, cmd
						}
					}
					m.Mode = ModeStatus
				}
			case "esc":
				m.Mode = ModeStatus
			}

		case ModeConfirm:
			switch msg.String() {
			case "y", "Y":
				m.Mode = ModeExecutingAction
				item := m.Menu.Items[m.Menu.Selected]
				if item.Action != nil {
					cmd := item.Action(&m)
					if cmd != nil {
						return m, cmd
					}
				}
				m.Mode = ModeStatus
			case "n", "N", "esc":
				m.Mode = ModeMenu
			}

		case ModeExecutingAction:
			switch msg.String() {
			case "q", "ctrl+c":
				return m, tea.Quit
			}
		}

	case commandFinishedMsg:
		m.Mode = ModeStatus
	}

	return m, nil
}

func (m Model) View() string {
	switch m.Mode {
	case ModeMenu:
		status := renderStatusScreen(m)
		menu := renderMenuOverlay(m)
		return overlayStatus(status, menu, m.Width, m.Height)
	case ModeConfirm:
		status := renderStatusScreen(m)
		confirm := renderConfirmOverlay(m)
		return overlayStatus(status, confirm, m.Width, m.Height)
	case ModeExecutingAction:
		return ""
	default:
		return renderStatusScreen(m)
	}
}

func overlayStatus(status, overlay string, _, height int) string {
	statusLines := strings.Split(status, "\n")
	overlayLines := strings.Split(overlay, "\n")

	result := make([]string, height)
	for y := 0; y < height; y++ {
		if y < len(overlayLines) && overlayLines[y] != "" {
			result[y] = overlayLines[y]
		} else if y < len(statusLines) {
			result[y] = statusLines[y]
		}
	}
	return strings.Join(result, "\n")
}

func tick() tea.Cmd {
	return tea.Tick(refreshInterval, func(t time.Time) tea.Msg {
		return tickMsg{}
	})
}
