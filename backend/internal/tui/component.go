package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
)

func Panel(title, content string, width int) string {
	style := lipgloss.NewStyle().
		Border(lipgloss.NormalBorder()).
		Padding(0, 1).
		Width(width).
		BorderForeground(lipgloss.Color(ColorBorder))

	inner := PanelTitleStyle.Render(title) + "\n" + content
	return style.Render(inner)
}

func Card(title, content string, width int) string {
	if width < 10 {
		width = 10
	}
	style := lipgloss.NewStyle().
		Border(lipgloss.NormalBorder()).
		Padding(0, 1).
		Width(width).
		BorderForeground(lipgloss.Color(ColorBorder))

	var b strings.Builder
	if title != "" {
		b.WriteString(HeadingStyle.Render(title))
		b.WriteString("\n")
	}
	b.WriteString(content)
	return style.Render(b.String())
}

func KuroCard(title string, titleColor string, content string, width int) string {
	if width < 10 {
		width = 10
	}
	style := lipgloss.NewStyle().
		Border(lipgloss.NormalBorder()).
		Padding(0, 1).
		Width(width).
		BorderForeground(lipgloss.Color(ColorBorder))

	var b strings.Builder
	if title != "" {
		tStyle := HeadingStyle
		if titleColor != "" {
			tStyle = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(titleColor))
		}
		b.WriteString(tStyle.Render(title))
		b.WriteString("\n")
	}
	b.WriteString(content)
	return style.Render(b.String())
}

func VStack(items ...string) string {
	var filtered []string
	for _, it := range items {
		if it != "" {
			filtered = append(filtered, it)
		}
	}
	return lipgloss.JoinVertical(lipgloss.Top, filtered...)
}

func HStack(spacing int, items ...string) string {
	if len(items) == 0 {
		return ""
	}
	result := items[0]
	gap := strings.Repeat(" ", spacing)
	for _, item := range items[1:] {
		result = lipgloss.JoinHorizontal(lipgloss.Top, result, gap, item)
	}
	return result
}

func Spacer(height int) string {
	return strings.Repeat("\n", height)
}

func Separator(width int) string {
	if width < 2 {
		width = 2
	}
	return DimmedStyle.Render(fmt.Sprintf("─%s─", strings.Repeat("─", width-2)))
}

func padRight(s string, n int) string {
	if len(s) >= n {
		return s[:n]
	}
	return s + strings.Repeat(" ", n-len(s))
}
