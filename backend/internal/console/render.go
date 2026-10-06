package console

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/ullashroy/poco-server/backend/internal/state"
	"github.com/ullashroy/poco-server/backend/internal/tui"
)

func healthIndicator(s state.Status) (HealthStatus, string) {
	hasError := false
	hasWarning := false

	for _, z := range s.Thermal.Zones {
		if z.TemperatureC >= 80 {
			hasError = true
		} else if z.TemperatureC >= 70 {
			hasWarning = true
		}
	}

	if len(s.Storage.Mounts) > 0 {
		root := s.Storage.Mounts[0]
		if root.UsagePercent >= 95 {
			hasError = true
		} else if root.UsagePercent >= 85 {
			hasWarning = true
		}
	}

	if s.Memory.Usage >= 95 {
		hasError = true
	} else if s.Memory.Usage >= 90 {
		hasWarning = true
	}

	if s.CPU.UsagePercent >= 95 {
		hasError = true
	} else if s.CPU.UsagePercent >= 90 {
		hasWarning = true
	}

	netOK := false
	for _, iface := range s.Network.Interfaces {
		if iface.Name != "lo" && iface.Up {
			netOK = true
			break
		}
	}
	if !netOK {
		hasError = true
	}

	if s.Tailscale.Self.Hostname != "" && s.Tailscale.BackendState != "Running" {
		hasWarning = true
	}

	if hasError {
		return HealthError, "● ERROR"
	}
	if hasWarning {
		return HealthWarning, "● WARNING"
	}
	return HealthHealthy, "● HEALTHY"
}

func healthStyle(h HealthStatus) lipgloss.Style {
	switch h {
	case HealthError:
		return tui.DangerStyle
	case HealthWarning:
		return tui.WarningStyle
	default:
		return tui.GoodStyle
	}
}

func renderStatusScreen(m Model) string {
	s := m.Status
	w := m.Width
	compact := m.Height < 25

	var b strings.Builder

	writeLine := func(line string) {
		b.WriteString(line)
		b.WriteByte('\n')
	}

	writeRight := func(label, value string) string {
		line := label + " " + value
		pad := w - lipgloss.Width(line)
		if pad > 0 {
			line += strings.Repeat(" ", pad)
		}
		return line
	}

	writeLine("")

	logo := tui.LogoStyle.Render("KURO")
	logoPad := (w - lipgloss.Width(logo)) / 2
	if logoPad > 0 {
		writeLine(strings.Repeat(" ", logoPad) + logo)
	} else {
		writeLine(logo)
	}

	health, healthText := healthIndicator(s)
	hostname := s.System.Hostname
	if hostname == "" {
		hostname = "unknown"
	}
	healthLine := healthStyle(health).Render(healthText) + tui.DimmedStyle.Render(" · ") + tui.ValueStyle.Render(hostname)
	hlPad := (w - lipgloss.Width(healthLine)) / 2
	if hlPad > 0 {
		writeLine(strings.Repeat(" ", hlPad) + healthLine)
	} else {
		writeLine(healthLine)
	}

	uptime := s.System.Uptime
	writeLine(writeRight(
		tui.LabelStyle.Render("Uptime"),
		tui.ValueStyle.Render(formatUptime(uptime)),
	))

	var tempStr string
	if len(s.Thermal.Zones) > 0 {
		var maxTemp float64
		for _, z := range s.Thermal.Zones {
			if z.TemperatureC > maxTemp {
				maxTemp = z.TemperatureC
			}
		}
		tempStyle := tui.ValueStyle
		if maxTemp >= 80 {
			tempStyle = tui.DangerStyle
		} else if maxTemp >= 70 {
			tempStyle = tui.WarningStyle
		}
		tempStr = tempStyle.Render(fmt.Sprintf("%.1f°C", maxTemp))
	} else {
		tempStr = tui.DimmedStyle.Render("N/A")
	}
	writeLine(writeRight(tui.LabelStyle.Render("Temp"), tempStr))

	if !compact {
		writeLine("")
	}

	barWidth := w - 22
	noSubtext := false
	if barWidth < 20 {
		barWidth = w - 12
		noSubtext = true
	}
	if barWidth < 10 {
		barWidth = 10
	}

	resLabel := tui.HeadingStyle.Render("Resources")
	resPad := (w - lipgloss.Width(resLabel)) / 2
	if resPad > 0 {
		writeLine(strings.Repeat(" ", resPad) + resLabel)
	} else {
		writeLine(resLabel)
	}

	renderResourceLine := func(label string, percent float64, subtext string) {
		bar := tui.ProgressBar(percent, barWidth)
		padded := fmt.Sprintf("%-7s", label)
		var line string
		if noSubtext {
			line = fmt.Sprintf("%s %s", tui.HeadingStyle.Render(padded), bar)
		} else {
			st := tui.SubtextStyle.Render(subtext)
			line = fmt.Sprintf("%s %s %s", tui.HeadingStyle.Render(padded), bar, st)
		}
		writeLine(line)
	}

	cpuInfo := s.CPU
	renderResourceLine("CPU", cpuInfo.UsagePercent,
		fmt.Sprintf("%.1f%%", cpuInfo.UsagePercent))

	memInfo := s.Memory
	memSubtext := fmt.Sprintf("%.1f%% (%.1f/%.1f GB)", memInfo.Usage,
		float64(memInfo.Used)/1e9, float64(memInfo.Total)/1e9)
	renderResourceLine("Memory", memInfo.Usage, memSubtext)

	storageInfo := s.Storage
	var storagePercent float64
	var storageSubtext string
	if len(storageInfo.Mounts) > 0 {
		root := storageInfo.Mounts[0]
		storagePercent = root.UsagePercent
		storageSubtext = fmt.Sprintf("%.0f%% (%.1f/%.1f GB)", root.UsagePercent,
			float64(root.Used)/1e9, float64(root.Total)/1e9)
	} else {
		storageSubtext = "N/A"
	}
	renderResourceLine("Disk", storagePercent, storageSubtext)

	if !compact {
		writeLine("")
	}

	connLabel := tui.HeadingStyle.Render("Connectivity")
	connPad := (w - lipgloss.Width(connLabel)) / 2
	if connPad > 0 {
		writeLine(strings.Repeat(" ", connPad) + connLabel)
	} else {
		writeLine(connLabel)
	}

	netName := "N/A"
	netIP := ""
	netUp := false
	for _, iface := range s.Network.Interfaces {
		if iface.Name != "lo" && iface.Up {
			netName = iface.Name
			if len(iface.Addresses) > 0 {
				netIP = iface.Addresses[0]
			}
			netUp = true
			break
		}
	}
	netStyle := tui.ValueStyle
	netUpStr := "down"
	if netUp {
		netUpStr = netName
	} else {
		netStyle = tui.DangerStyle
	}
	writeLine(writeRight(tui.LabelStyle.Render("Network"), netStyle.Render(netUpStr)))
	if netIP != "" {
		writeLine(writeRight(tui.LabelStyle.Render("IP"), tui.ValueStyle.Render(netIP)))
	}

	tsLine := tui.DimmedStyle.Render("Disconnected")
	if s.Tailscale.Self.Hostname != "" {
		if s.Tailscale.BackendState == "Running" {
			display := s.Tailscale.Self.Hostname
			if s.Tailscale.Self.IP != "" {
				display = fmt.Sprintf("%s (%s)", s.Tailscale.Self.Hostname, s.Tailscale.Self.IP)
			}
			tsLine = tui.GoodStyle.Render(display)
		} else {
			tsLine = tui.WarningStyle.Render("Not connected")
		}
	}
	writeLine(writeRight(tui.LabelStyle.Render("Tailscale"), tsLine))

	dockerLine := tui.DimmedStyle.Render("No containers")
	if len(s.Docker.Containers) > 0 {
		running := 0
		for _, c := range s.Docker.Containers {
			if c.State == "running" {
				running++
			}
		}
		if running > 0 {
			dockerLine = tui.GoodStyle.Render(fmt.Sprintf("%d/%d running", running, len(s.Docker.Containers)))
		} else {
			dockerLine = tui.WarningStyle.Render("0 running")
		}
	}
	writeLine(writeRight(tui.LabelStyle.Render("Docker"), dockerLine))

	if !compact {
		writeLine("")
	}

	writeLine(writeRight(
		tui.DimmedStyle.Render("F2"),
		tui.DimmedStyle.Render("Network Recovery"),
	))
	writeLine(writeRight(
		tui.DimmedStyle.Render("F10"),
		tui.DimmedStyle.Render("Menu"),
	))

	result := b.String()
	resultHeight := strings.Count(result, "\n")
	if resultHeight < m.Height {
		result += strings.Repeat("\n", m.Height-resultHeight)
	}
	return result
}

func formatUptime(seconds uint64) string {
	days := seconds / 86400
	hours := (seconds % 86400) / 3600
	minutes := (seconds % 3600) / 60
	if days > 0 {
		return fmt.Sprintf("%dd %dh %dm", days, hours, minutes)
	}
	return fmt.Sprintf("%dh %dm", hours, minutes)
}
