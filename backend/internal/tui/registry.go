package tui

type PageRenderFunc func(Model) string

var pageRegistry = map[Page]PageRenderFunc{
	PageDashboard: RenderDashboard,
	PageLogs:      RenderLogsPage,
}

func RenderPage(m Model) string {
	if fn, ok := pageRegistry[m.Page]; ok {
		return fn(m)
	}
	return RenderDashboard(m)
}
