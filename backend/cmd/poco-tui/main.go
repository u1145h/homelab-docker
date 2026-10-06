package main

import (
	"context"
	"log"

	tea "github.com/charmbracelet/bubbletea"

	"github.com/ullashroy/poco-server/backend/internal/app"
	"github.com/ullashroy/poco-server/backend/internal/hardware"
	"github.com/ullashroy/poco-server/backend/internal/tui"
)

func main() {
	application := app.New()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	application.Start(ctx)

	ctrl := tui.Controllers{
		JobsStore:         application.JobsStore,
		NotificationStore: application.NotificationStore,
	}

	model := tui.New(application.State, ctrl)
	model.HardwareChan = hardware.ListenVolumeButtons()

	p := tea.NewProgram(
		model,
		tea.WithAltScreen(),
	)

	if _, err := p.Run(); err != nil {
		log.Fatal(err)
	}

	if err := application.Shutdown(); err != nil {
		log.Printf("shutdown error: %v", err)
	}
}

