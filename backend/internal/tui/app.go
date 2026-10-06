package tui

import (
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/ullashroy/poco-server/backend/internal/hardware"
)

const RefreshInterval = time.Second

type tickMsg struct{}
type VolumeUpMsg struct{}
type VolumeDownMsg struct{}

func New(sp StatusProvider, ctrl Controllers) Model {
	return Model{Provider: sp, Controllers: ctrl}
}

func (m Model) Init() tea.Cmd {
	return tea.Batch(tick(), ListenHardwareButtons(m.HardwareChan))
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tickMsg:
		m.Status = m.Provider.Status()
		modM, modCmd, _ := dispatchModuleUpdate(m, msg)
		return modM, tea.Batch(tick(), modCmd)

	case VolumeUpMsg:
		m.Page = PrevPage(m.Page)
		return m, ListenHardwareButtons(m.HardwareChan)

	case VolumeDownMsg:
		m.Page = NextPage(m.Page)
		return m, ListenHardwareButtons(m.HardwareChan)

	case tea.WindowSizeMsg:
		m.Width = msg.Width
		m.Height = msg.Height

	case tea.KeyMsg:
		if msg.String() == "ctrl+p" {
			m.Palette.Open = !m.Palette.Open
			if m.Palette.Open {
				m.Palette.Query = ""
				m.Palette.Results = nil
				m.Palette.Selected = 0
			}
			return m, nil
		}

		if m.Palette.Open {
			newM, cmd, _ := handlePaletteKeys(m, msg)
			return newM, cmd
		}

		newM, cmd, handled := dispatchModuleUpdate(m, msg)
		if handled {
			return newM, cmd
		}
		a := actionForKey(msg.String())
		if a != ActionNone {
			return executeAction(m, a)
		}
		return m, nil
	}

	newM, cmd, _ := dispatchModuleUpdate(m, msg)
	return newM, cmd
}

func (m Model) View() string {
	view := RenderPage(m)
	if m.Palette.Open {
		view = renderPaletteOverlay(m, view)
	}
	return view
}

func tick() tea.Cmd {
	return tea.Tick(RefreshInterval, func(t time.Time) tea.Msg {
		return tickMsg{}
	})
}

func ListenHardwareButtons(ch <-chan hardware.EventType) tea.Cmd {
	if ch == nil {
		return nil
	}
	return func() tea.Msg {
		evt, ok := <-ch
		if !ok {
			return nil
		}
		if evt == hardware.EventVolumeUp {
			return VolumeUpMsg{}
		}
		return VolumeDownMsg{}
	}
}
