package tui

type Page int

const (
	PageDashboard Page = iota
	PageLogs
)

func (p Page) String() string {
	switch p {
	case PageDashboard:
		return "Dashboard"
	case PageLogs:
		return "System Logs"
	default:
		return "Dashboard"
	}
}

func NextPage(p Page) Page {
	if p == PageDashboard {
		return PageLogs
	}
	return PageDashboard
}

func PrevPage(p Page) Page {
	if p == PageLogs {
		return PageDashboard
	}
	return PageLogs
}

