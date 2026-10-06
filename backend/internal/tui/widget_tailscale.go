package tui

import (
	"fmt"

	"github.com/ullashroy/poco-server/backend/internal/tailscale"
)

func RenderTailscale(info tailscale.Info) string {
	if info.Self.Hostname == "" {
		return DimmedStyle.Render("Disconnected")
	}
	display := info.Self.Hostname
	if info.Self.IP != "" {
		display = fmt.Sprintf("%s (%s)", info.Self.Hostname, info.Self.IP)
	}
	return ValueStyle.Render(display)
}
