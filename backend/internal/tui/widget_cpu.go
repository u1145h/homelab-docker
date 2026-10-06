package tui

import (
	"fmt"

	"github.com/ullashroy/poco-server/backend/internal/cpu"
)

func RenderCPU(info cpu.Info, innerWidth int) string {
	pctStr := fmt.Sprintf("%.1f%%", info.UsagePercent)
	barW := innerWidth - len(pctStr) - 1
	if barW < 8 {
		barW = 8
	}

	bar := TexturedProgressBar(info.UsagePercent, barW, ColorGreen, ColorGreenTrack)
	line1 := fmt.Sprintf("%s %s", bar, ValueStyle.Render(pctStr))

	freqStr := ""
	if info.FrequencyMHz > 0 {
		freqStr = fmt.Sprintf(" @ %d MHz", info.FrequencyMHz)
	}
	line2 := SubtextStyle.Render(fmt.Sprintf("(%d cores%s)", info.LogicalCores, freqStr))

	return line1 + "\n" + line2
}
