package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
)

func RenderLogsPage(m Model) string {
	canvasWidth, leftPad, _ := calculateCanvas(m.Width)

	innerW := canvasWidth - 4
	if innerW < 10 {
		innerW = 10
	}

	titleStyle := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(ColorGreen))
	header := fmt.Sprintf("%s    %s",
		titleStyle.Render("SYSTEM LOGS"),
		SubtextStyle.Render("(Read-Only)"),
	)

	var logContent string
	if m.Logs.Loading && len(m.Logs.Lines) == 0 {
		logContent = DimmedStyle.Render("Loading system logs...")
	} else if len(m.Logs.Lines) == 0 {
		logContent = DimmedStyle.Render("No log entries available.")
	} else {
		maxVisibleLines := m.Height - 12
		if maxVisibleLines < 5 {
			maxVisibleLines = 5
		}
		lines := m.Logs.Lines
		if len(lines) > maxVisibleLines {
			lines = lines[len(lines)-maxVisibleLines:]
		}

		// Truncate long lines to fit innerW
		var truncated []string
		for _, l := range lines {
			l = strings.TrimRight(l, "\r\n")
			if lipgloss.Width(l) > innerW {
				l = l[:innerW]
			}
			truncated = append(truncated, l)
		}
		logContent = BodyStyle.Render(strings.Join(truncated, "\n"))
	}

	card := KuroCard("", "", logContent, canvasWidth)

	var contentBuilder strings.Builder
	contentBuilder.WriteString(header)
	contentBuilder.WriteString("\n\n")
	contentBuilder.WriteString(card)

	contentStr := contentBuilder.String()
	contentHeight := lipgloss.Height(contentStr)

	topPad := 0
	if m.Height > contentHeight {
		topPad = (m.Height - contentHeight) / 2
	}

	var b strings.Builder
	if topPad > 0 {
		b.WriteString(strings.Repeat("\n", topPad))
	}
	b.WriteString(contentStr)

	return renderCanvas(b.String(), canvasWidth, leftPad)
}
