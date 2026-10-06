package tui

import (
	"fmt"

	"github.com/ullashroy/poco-server/backend/internal/system"
	"github.com/ullashroy/poco-server/backend/internal/thermal"
)

func RenderSystemHeader(sys system.Info, th thermal.Info) string {
	line1 := fmt.Sprintf("%s %s", LabelStyle.Render("Hostname"), ValueStyle.Render(sys.Hostname))
	line2 := fmt.Sprintf("%s %s", LabelStyle.Render("Uptime"), ValueStyle.Render(formatUptime(sys.Uptime)))

	tempStr := "N/A"
	if len(th.Zones) > 0 {
		var maxTemp float64
		for _, z := range th.Zones {
			if z.TemperatureC > maxTemp {
				maxTemp = z.TemperatureC
			}
		}
		tempStr = fmt.Sprintf("%.1f°C", maxTemp)
	}
	line3 := fmt.Sprintf("%s %s", LabelStyle.Render("Temperature"), ValueStyle.Render(tempStr))

	return line1 + "\n" + line2 + "\n" + line3
}

func RenderSystem(info system.Info) string {
	return fmt.Sprintf(
		"%s %s",
		LabelStyle.Render("Hostname"),
		ValueStyle.Render(info.Hostname),
	)
}

func RenderUptime(info system.Info) string {
	return fmt.Sprintf(
		"%s %s",
		LabelStyle.Render("Uptime"),
		ValueStyle.Render(formatUptime(info.Uptime)),
	)
}

func RenderThermal(info thermal.Info) string {
	if len(info.Zones) == 0 {
		return fmt.Sprintf(
			"%s %s",
			LabelStyle.Render("Temperature"),
			DimmedStyle.Render("N/A"),
		)
	}
	var maxTemp float64
	for _, z := range info.Zones {
		if z.TemperatureC > maxTemp {
			maxTemp = z.TemperatureC
		}
	}
	return fmt.Sprintf(
		"%s %s",
		LabelStyle.Render("Temperature"),
		ValueStyle.Render(fmt.Sprintf("%.1f°C", maxTemp)),
	)
}
