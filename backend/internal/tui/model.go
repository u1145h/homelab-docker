package tui

import (
	"github.com/ullashroy/poco-server/backend/internal/hardware"
	"github.com/ullashroy/poco-server/backend/internal/state"
)

type StatusProvider interface {
	Status() state.Status
}

type Model struct {
	Provider     StatusProvider
	Status       state.Status
	Width        int
	Height       int
	Page         Page
	Focus        int
	FocusCount   int
	Controllers  Controllers
	HardwareChan <-chan hardware.EventType
	Logs         LogsModule
	Palette      PaletteModule
}
