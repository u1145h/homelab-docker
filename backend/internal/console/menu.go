package console

import (
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/ullashroy/poco-server/backend/internal/tui"
)

func defaultMenu() MenuModel {
	return MenuModel{
		Items: []MenuItem{
			{Label: "Network Recovery", Action: execNmtui},
			{Label: "Restart Backend", Action: restartBackend, NeedsConfirm: true},
			{Label: "Restart Docker", Action: restartDocker, NeedsConfirm: true},
			{Label: "View Logs", Action: viewLogs},
			{Label: "─────────────────", IsSeparator: true},
			{Label: "Reboot", Action: systemReboot, NeedsConfirm: true},
			{Label: "Shutdown", Action: systemPoweroff, NeedsConfirm: true},
			{Label: "─────────────────", IsSeparator: true},
			{Label: "About", Action: showAbout},
			{Label: "< Back", Action: closeMenu},
		},
		Selected: 0,
	}
}

func closeMenu(m *Model) tea.Cmd {
	m.Mode = ModeStatus
	return nil
}

func showAbout(_ *Model) tea.Cmd {
	return nil
}

func renderMenuOverlay(m Model) string {
	boxW := 34
	boxH := len(m.Menu.Items) + 2
	startX := (m.Width - boxW) / 2
	startY := (m.Height - boxH) / 2
	if startY < 0 {
		startY = 1
	}

	top := "┌" + strings.Repeat("─", boxW-2) + "┐"
	bottom := "└" + strings.Repeat("─", boxW-2) + "┘"

	var items []string
	for i, item := range m.Menu.Items {
		line := "│ "
		if item.IsSeparator {
			line += tui.DimmedStyle.Render(strings.Repeat("─", boxW-6))
		} else if i == m.Menu.Selected {
			line += tui.HeadingStyle.Render("▸ " + item.Label)
		} else {
			if item.Label == "< Back" {
				line += tui.DimmedStyle.Render("  " + item.Label)
			} else {
				line += tui.BodyStyle.Render("  " + item.Label)
			}
		}
		line += strings.Repeat(" ", boxW-lipgloss.Width(line)-1) + "│"
		items = append(items, line)
	}

	box := make([]string, 0, boxH)
	for i := 0; i < boxH; i++ {
		if i == 0 {
			box = append(box, top)
		} else if i == boxH-1 {
			box = append(box, bottom)
		} else {
			box = append(box, items[i-1])
		}
	}

	overlayLines := make([]string, m.Height)
	for y := 0; y < m.Height; y++ {
		if y >= startY && y < startY+boxH {
			bx := y - startY
			line := strings.Repeat(" ", startX) + box[bx]
			line += strings.Repeat(" ", m.Width-lipgloss.Width(line))
			overlayLines[y] = line
		} else {
			overlayLines[y] = ""
		}
	}
	return strings.Join(overlayLines, "\n")
}

func renderConfirmOverlay(m Model) string {
	msg := "Are you sure?"
	if m.Confirm != "" {
		msg = m.Confirm
	}
	prompt := " (y/n) "
	boxW := len(msg) + len(prompt) + 4
	if boxW < 30 {
		boxW = 30
	}
	startX := (m.Width - boxW) / 2
	startY := m.Height / 2

	top := "┌" + strings.Repeat("─", boxW-2) + "┐"
	middle := "│ " + tui.WarningStyle.Render(msg) + tui.DimmedStyle.Render(prompt) + strings.Repeat(" ", boxW-4-lipgloss.Width(tui.WarningStyle.Render(msg))-lipgloss.Width(tui.DimmedStyle.Render(prompt))) + " │"
	bottom := "└" + strings.Repeat("─", boxW-2) + "┘"

	lines := make([]string, m.Height)
	for y := 0; y < m.Height; y++ {
		switch y {
		case startY - 1:
			lines[y] = strings.Repeat(" ", startX) + top
		case startY:
			lines[y] = strings.Repeat(" ", startX) + middle
		case startY + 1:
			lines[y] = strings.Repeat(" ", startX) + bottom
		default:
			lines[y] = ""
		}
	}
	return strings.Join(lines, "\n")
}
