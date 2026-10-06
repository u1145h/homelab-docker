package tui

import (
	"fmt"

	"github.com/charmbracelet/lipgloss"
	"github.com/ullashroy/poco-server/backend/internal/storage"
)

func RenderStorage(info storage.Info, innerWidth int) string {
	var total, used uint64
	var usagePct float64

	if info.Summary.TotalCapacity > 0 {
		total = info.Summary.TotalCapacity
		used = info.Summary.Used
		usagePct = (float64(used) / float64(total)) * 100
	} else if len(info.Mounts) > 0 {
		var target *storage.Mount
		for i := range info.Mounts {
			if info.Mounts[i].Mount == "/" {
				target = &info.Mounts[i]
				break
			}
		}
		if target == nil {
			for i := range info.Mounts {
				if info.Mounts[i].Total > 0 {
					target = &info.Mounts[i]
					break
				}
			}
		}
		if target != nil {
			total = target.Total
			used = target.Used
			usagePct = target.UsagePercent
		} else {
			return DimmedStyle.Render("No storage mounts found")
		}
	} else {
		return DimmedStyle.Render("No storage mounts found")
	}

	pctStr := fmt.Sprintf("%.0f%%", usagePct)
	barW := innerWidth - len(pctStr) - 1
	if barW < 8 {
		barW = 8
	}

	bar := TexturedProgressBar(usagePct, barW, ColorOrange, ColorOrangeTrack)
	line1 := fmt.Sprintf("%s %s", bar, lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(ColorOrange)).Render(pctStr))
	line2 := SubtextStyle.Render(fmt.Sprintf("(%s / %s)", formatBytes(used), formatBytes(total)))

	return line1 + "\n" + line2
}
