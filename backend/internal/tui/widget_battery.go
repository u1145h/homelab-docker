package tui

import (
	"fmt"

	"github.com/charmbracelet/lipgloss"
	"github.com/ullashroy/poco-server/backend/internal/battery"
)

func RenderBattery(info battery.Info, innerWidth int) string {
	if !info.Present {
		return DimmedStyle.Render("No battery detected (AC Powered)")
	}

	pct := float64(info.Capacity)
	pctStr := fmt.Sprintf("%d%%", info.Capacity)
	barW := innerWidth - len(pctStr) - 1
	if barW < 8 {
		barW = 8
	}

	bar := TexturedProgressBar(pct, barW, ColorRed, ColorRedTrack)
	line1 := fmt.Sprintf("%s %s", bar, lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(ColorRed)).Render(pctStr))

	statusStr := info.Status
	if statusStr == "" {
		statusStr = "Active"
	}
	line2 := SubtextStyle.Render(fmt.Sprintf("(%s)", statusStr))

	return line1 + "\n" + line2
}
