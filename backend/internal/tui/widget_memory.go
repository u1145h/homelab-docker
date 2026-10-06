package tui

import (
	"fmt"

	"github.com/ullashroy/poco-server/backend/internal/memory"
)

func RenderMemory(info memory.Info, innerWidth int) string {
	pctStr := fmt.Sprintf("%.1f%%", info.Usage)
	barW := innerWidth - len(pctStr) - 1
	if barW < 8 {
		barW = 8
	}

	bar := TexturedProgressBar(info.Usage, barW, ColorGreen, ColorGreenTrack)
	line1 := fmt.Sprintf("%s %s", bar, ValueStyle.Render(pctStr))
	line2 := SubtextStyle.Render(fmt.Sprintf("(%s / %s)", formatBytes(info.Used), formatBytes(info.Total)))

	return line1 + "\n" + line2
}
