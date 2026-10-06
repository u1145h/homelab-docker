package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
)

func Window(title, body, footer string, width int) string {
	var content strings.Builder
	content.WriteString(TitleStyle.Render(title))
	content.WriteString("\n\n")
	content.WriteString(strings.TrimSpace(body))
	content.WriteString("\n\n")
	content.WriteString(footer)
	return BorderStyle.Render(content.String())
}

func RenderDashboard(m Model) string {
	canvasWidth, leftPad, _ := calculateCanvas(m.Width)

	// Card inner width (subtract border and padding)
	innerW := canvasWidth - 4
	if innerW < 10 {
		innerW = 10
	}

	header := renderDashboardHeader(m, canvasWidth, m.Height < 32)
	metrics := renderMetricsSection(m, canvasWidth, innerW)
	services := renderServicesSection(m, canvasWidth)

	gap := "\n"
	if m.Height >= 36 {
		gap = "\n\n"
	}

	var contentBuilder strings.Builder
	contentBuilder.WriteString(header)
	contentBuilder.WriteString(gap)
	contentBuilder.WriteString(metrics)
	contentBuilder.WriteString("\n")
	contentBuilder.WriteString(services)

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

func calculateCanvas(termWidth int) (canvasWidth, leftPad, topPad int) {
	cw := 56
	if termWidth < 60 {
		cw = termWidth - 4
		if cw < 36 {
			cw = termWidth - 2
		}
		if cw < 20 {
			cw = termWidth
		}
	} else if termWidth > 80 {
		cw = 58
	}

	leftPad = (termWidth - cw) / 2
	if leftPad < 0 {
		leftPad = 0
	}
	topPad = 1
	return cw, leftPad, topPad
}

func renderCanvas(content string, canvasWidth, leftPad int) string {
	if leftPad <= 0 {
		return content
	}
	pad := strings.Repeat(" ", leftPad)
	lines := strings.Split(content, "\n")
	for i, line := range lines {
		lines[i] = pad + line
	}
	return strings.Join(lines, "\n")
}

func renderDashboardHeader(m Model, canvasWidth int, compact bool) string {
	mascotStyle := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(ColorAccent))
	kuroStyle := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(ColorAccent))

	mascotLines := []string{
		"   ○    ",
		" ╭─┴─╮  ",
		"╭┤● ●├╮ ",
		"╰┴───┴╯ ",
	}
	kuroLines := []string{
		"",
		kuroStyle.Render("  KURO"),
		"",
		"",
	}

	var logoLines []string
	for i := 0; i < len(mascotLines); i++ {
		logoLines = append(logoLines, mascotStyle.Render(mascotLines[i])+kuroLines[i])
	}
	logoBlock := strings.Join(logoLines, "\n")

	infoBlock := RenderSystemHeader(m.Status.System, m.Status.Thermal)

	if compact {
		return VStack(logoBlock, infoBlock)
	}
	return VStack(logoBlock, "", infoBlock)
}

func renderMetricsSection(m Model, canvasWidth, innerW int) string {
	cpuCard := KuroCard("CPU", ColorGreen, RenderCPU(m.Status.CPU, innerW), canvasWidth)
	memCard := KuroCard("Memory", ColorGreen, RenderMemory(m.Status.Memory, innerW), canvasWidth)
	stoCard := KuroCard("Storage", ColorOrange, RenderStorage(m.Status.Storage, innerW), canvasWidth)
	batCard := KuroCard("Battery", ColorGreen, RenderBattery(m.Status.Battery, innerW), canvasWidth)

	return VStack(cpuCard, memCard, stoCard, batCard)
}

func renderServicesSection(m Model, canvasWidth int) string {
	netTitle := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(ColorGreen)).Render("Network")
	netContent := RenderNetwork(m.Status.Network)
	netWidget := fmt.Sprintf("%s\n%s", netTitle, netContent)

	docTitle := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(ColorGreen)).Render("Docker")
	docContent := RenderDocker(m.Status.Docker)
	docWidget := fmt.Sprintf("%s\n%s", docTitle, docContent)

	tsTitle := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(ColorGreen)).Render("Tailscale")
	tsContent := RenderTailscale(m.Status.Tailscale)
	tsWidget := fmt.Sprintf("%s\n%s", tsTitle, tsContent)

	col1Width := canvasWidth / 2
	if col1Width < 16 {
		col1Width = 16
	}

	docLines := strings.Split(docWidget, "\n")
	for i, l := range docLines {
		w := lipgloss.Width(l)
		if w < col1Width {
			docLines[i] = l + strings.Repeat(" ", col1Width-w)
		}
	}
	paddedDocWidget := strings.Join(docLines, "\n")

	splitRow := lipgloss.JoinHorizontal(lipgloss.Top, paddedDocWidget, tsWidget)

	return VStack(netWidget, "", splitRow)
}
