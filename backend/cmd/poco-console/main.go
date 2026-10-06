package main

import (
	"context"
	"log"

	tea "github.com/charmbracelet/bubbletea"

	"github.com/ullashroy/poco-server/backend/internal/app"
	"github.com/ullashroy/poco-server/backend/internal/console"
)

func main() {
	application := app.New()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	application.Start(ctx)

	p := tea.NewProgram(
		console.New(application.State),
		tea.WithAltScreen(),
	)

	if _, err := p.Run(); err != nil {
		log.Fatal(err)
	}

	if err := application.Shutdown(); err != nil {
		log.Printf("shutdown error: %v", err)
	}
}
