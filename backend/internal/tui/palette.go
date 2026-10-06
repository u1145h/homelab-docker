package tui

import (
	"fmt"
	"strings"
	"unicode"

	tea "github.com/charmbracelet/bubbletea"
)

type PaletteModule struct {
	Open     bool
	Query    string
	Results  []PaletteItem
	Selected int
}

type PaletteItem struct {
	Title    string
	Subtitle string
	Page     Page
}

func (m *PaletteModule) search(query string) {
	m.Results = nil
	m.Selected = 0
	if query == "" {
		return
	}
	q := strings.ToLower(strings.TrimSpace(query))

	pages := []struct {
		name string
		page Page
	}{
		{"Dashboard", PageDashboard},
	}

	for _, p := range pages {
		if fuzzyMatch(q, strings.ToLower(p.name)) {
			m.Results = append(m.Results, PaletteItem{Title: p.name, Subtitle: "Page", Page: p.page})
		}
	}
}

func fuzzyMatch(query, target string) bool {
	qi := 0
	for ti := 0; ti < len(target) && qi < len(query); ti++ {
		if query[qi] == target[ti] {
			qi++
		}
	}
	return qi == len(query)
}

func renderPaletteOverlay(m Model, currentView string) string {
	query := m.Palette.Query
	cursor := "█"
	input := query + cursor

	prompt := fmt.Sprintf("> %s", input)
	var resultLines []string
	for i, r := range m.Palette.Results {
		line := fmt.Sprintf("  %-20s %s", r.Title, DimmedStyle.Render(r.Subtitle))
		if i == m.Palette.Selected {
			line = HeaderStyle.Render("▸ " + r.Title)
		}
		resultLines = append(resultLines, line)
		if len(resultLines) >= 10 {
			break
		}
	}

	results := ""
	if len(resultLines) > 0 {
		results = strings.Join(resultLines, "\n")
	} else if query != "" {
		results = DimmedStyle.Render("  No results")
	}

	paletteContent := prompt
	if results != "" {
		paletteContent += "\n" + results
	}

	paletteBox := BorderStyle.Render(paletteContent)

	lines := strings.SplitN(currentView, "\n", 2)
	top := ""
	if len(lines) > 0 {
		top = lines[0]
	}

	return top + "\n" + paletteBox + "\n"
}

func handlePaletteKeys(m Model, msg tea.KeyMsg) (Model, tea.Cmd, bool) {
	if !m.Palette.Open {
		return m, nil, false
	}

	switch msg.String() {
	case "esc":
		m.Palette.Open = false
		m.Palette.Query = ""
		m.Palette.Results = nil
		return m, nil, true

	case "enter":
		if m.Palette.Selected >= 0 && m.Palette.Selected < len(m.Palette.Results) {
			item := m.Palette.Results[m.Palette.Selected]
			m.Palette.Open = false
			m.Palette.Query = ""
			m.Palette.Results = nil
			m.Page = item.Page
			return m, nil, true
		}
		return m, nil, true

	case "up":
		if m.Palette.Selected > 0 {
			m.Palette.Selected--
		}
		return m, nil, true

	case "down":
		if m.Palette.Selected < len(m.Palette.Results)-1 {
			m.Palette.Selected++
		}
		return m, nil, true

	case "backspace":
		if len(m.Palette.Query) > 0 {
			m.Palette.Query = m.Palette.Query[:len(m.Palette.Query)-1]
			m.Palette.search(m.Palette.Query)
		}
		return m, nil, true

	default:
		if msg.Type == tea.KeyRunes {
			for _, r := range msg.Runes {
				if !unicode.IsControl(r) {
					m.Palette.Query += string(r)
				}
			}
			m.Palette.search(m.Palette.Query)
		}
		return m, nil, true
	}
}
