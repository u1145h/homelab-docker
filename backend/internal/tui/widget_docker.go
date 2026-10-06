package tui

import (
	"fmt"

	"github.com/ullashroy/poco-server/backend/internal/docker"
)

func RenderDocker(info docker.Info) string {
	if len(info.Containers) == 0 {
		return DimmedStyle.Render("No containers")
	}
	running := 0
	for _, c := range info.Containers {
		if c.State == "running" {
			running++
		}
	}
	return ValueStyle.Render(fmt.Sprintf("%d/%d running", running, len(info.Containers)))
}
