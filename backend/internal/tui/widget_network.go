package tui

import (
	"fmt"
	"strings"

	"github.com/ullashroy/poco-server/backend/internal/network"
)

func RenderNetwork(info network.Info) string {
	for _, iface := range info.Interfaces {
		if iface.Name == "lo" || !iface.Up {
			continue
		}
		if strings.HasPrefix(iface.Name, "tailscale") || strings.HasPrefix(iface.Name, "docker") || strings.HasPrefix(iface.Name, "veth") {
			continue
		}

		nameLower := strings.ToLower(iface.Name)
		isWifi := strings.HasPrefix(nameLower, "w") || strings.Contains(nameLower, "wifi") || iface.SSID != "" || info.Wifi.SSID != ""

		if isWifi {
			ssid := iface.SSID
			if ssid == "" {
				ssid = info.Wifi.SSID
			}
			if ssid != "" {
				return ValueStyle.Render(fmt.Sprintf("Wi-Fi (%s)", ssid))
			}
			return ValueStyle.Render("Wi-Fi")
		}

		return ValueStyle.Render("Ethernet")
	}
	return DimmedStyle.Render("Disconnected")
}
