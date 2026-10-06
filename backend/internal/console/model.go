package console

import (
	tea "github.com/charmbracelet/bubbletea"
	"github.com/ullashroy/poco-server/backend/internal/state"
)

type StatusProvider interface {
	Status() state.Status
}

type Mode int

const (
	ModeStatus Mode = iota
	ModeMenu
	ModeConfirm
	ModeExecutingAction
	ModeLog
)

type HealthStatus int

const (
	HealthUnknown HealthStatus = iota
	HealthHealthy
	HealthWarning
	HealthError
)

type MenuItem struct {
	Label        string
	Action       func(*Model) tea.Cmd
	NeedsConfirm bool
	IsSeparator  bool
}

type MenuModel struct {
	Items    []MenuItem
	Selected int
}

type commandFinishedMsg struct {
	name string
	err  error
}

type Model struct {
	Provider StatusProvider
	Status   state.Status
	Width    int
	Height   int
	Mode     Mode
	Menu     MenuModel
	Confirm  string
	LogLines []string
}

func New(sp StatusProvider) Model {
	return Model{
		Provider: sp,
		Status:   sp.Status(),
		Width:    80,
		Height:   25,
		Mode:     ModeStatus,
		Menu:     defaultMenu(),
	}
}
