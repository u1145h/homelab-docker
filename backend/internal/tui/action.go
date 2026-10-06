package tui

import tea "github.com/charmbracelet/bubbletea"

type Action int

const (
	ActionNone Action = iota
	ActionQuit
	ActionPageDashboard
	ActionPageLogs
	ActionNextPage
	ActionPrevPage
)

type keyBinding struct {
	Key    string
	Action Action
}

var defaultBindings = []keyBinding{
	{"q", ActionQuit},
	{"ctrl+c", ActionQuit},
	{"1", ActionPageDashboard},
	{"2", ActionPageLogs},
	{"f1", ActionPageDashboard},
	{"f2", ActionPageLogs},
	{"up", ActionPrevPage},
	{"down", ActionNextPage},
	{"k", ActionPrevPage},
	{"j", ActionNextPage},
	{"pgup", ActionPrevPage},
	{"pgdown", ActionNextPage},
	{"space", ActionNextPage},
	{"tab", ActionNextPage},
	{"shift+tab", ActionPrevPage},
}

func actionForKey(key string) Action {
	for _, b := range defaultBindings {
		if b.Key == key {
			return b.Action
		}
	}
	return ActionNone
}

func executeAction(m Model, a Action) (Model, tea.Cmd) {
	switch a {
	case ActionQuit:
		return m, tea.Quit
	case ActionPageDashboard:
		m.Page = PageDashboard
	case ActionPageLogs:
		m.Page = PageLogs
	case ActionNextPage:
		m.Page = NextPage(m.Page)
	case ActionPrevPage:
		m.Page = PrevPage(m.Page)
	}
	return m, nil
}
