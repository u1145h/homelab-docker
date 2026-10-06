package tui

import tea "github.com/charmbracelet/bubbletea"

type ModuleUpdateFunc func(Model, tea.Msg) (Model, tea.Cmd, bool)

var moduleUpdateRegistry = map[Page]ModuleUpdateFunc{
	PageDashboard: updateDashboard,
	PageLogs:      updateLogs,
}

func dispatchModuleUpdate(m Model, msg tea.Msg) (Model, tea.Cmd, bool) {
	if fn, ok := moduleUpdateRegistry[m.Page]; ok {
		return fn(m, msg)
	}
	return m, nil, false
}
