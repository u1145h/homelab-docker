package tui

import (
	"strings"

	"github.com/charmbracelet/lipgloss"
)

func ProgressBar(percent float64, width int, colors ...lipgloss.Color) string {
	fillColor := ColorGreen
	trackColor := ColorGreenTrack

	if len(colors) >= 2 {
		fillColor = string(colors[0])
		trackColor = string(colors[1])
	} else if len(colors) == 1 {
		fillColor = string(colors[0])
	} else {
		if percent >= 90 {
			fillColor = ColorRed
			trackColor = ColorRedTrack
		} else if percent >= 75 {
			fillColor = ColorOrange
			trackColor = ColorOrangeTrack
		}
	}

	return TexturedProgressBar(percent, width, fillColor, trackColor)
}

func TexturedProgressBar(percent float64, width int, fillHex, trackHex string) string {
	if width < 1 {
		width = 1
	}

	filled := int(float64(width) * percent / 100.0)
	if filled < 0 {
		filled = 0
	}
	if filled > width {
		filled = width
	}
	empty := width - filled

	filledPart := lipgloss.NewStyle().Foreground(lipgloss.Color(fillHex)).Render(strings.Repeat("█", filled))
	trackPart := lipgloss.NewStyle().Foreground(lipgloss.Color(trackHex)).Render(strings.Repeat("▒", empty))

	return filledPart + trackPart
}
