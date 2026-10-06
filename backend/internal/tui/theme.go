package tui

import "github.com/charmbracelet/lipgloss"

const (
	ColorBackground  = "#0E1011"
	ColorSurface     = "#181A1B"
	ColorBorder      = "#7E8287"
	ColorBorderFocus = "#9ECE6A"
	ColorAccent      = "#9ECE6A"
	ColorGreen       = "#4EFA58"
	ColorGreenTrack  = "#1A3320"
	ColorOrange      = "#FFAA00"
	ColorOrangeTrack = "#3D2B0E"
	ColorRed         = "#FF6E6E"
	ColorRedTrack    = "#3D1B1B"
	ColorPurple      = "#D3869B"
	ColorBlue        = "#7DAEA3"
	ColorWhite       = "#FFFFFF"
	ColorTextPrimary = "#FFFFFF"
	ColorTextMuted   = "#7E8287"
	ColorDimmed      = "#52565A"

	CanvasPaddingHorizontal = 2
	CanvasPaddingVertical   = 1
	SectionGap              = 1
	CardGap                 = 1
	HeaderGap               = 1
	FooterGap               = 1
	CardPaddingV            = 0
	CardPaddingH            = 1
	MinCanvasWidth          = 44
	MaxCanvasWidth          = 68
	BarOverhead             = 12
)

var (
	TitleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color(ColorWhite))

	HeaderStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color(ColorAccent))

	LabelStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color(ColorTextMuted))

	ValueStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color(ColorWhite))

	FooterStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color(ColorDimmed))

	BorderStyle = lipgloss.NewStyle().
			Border(lipgloss.NormalBorder()).
			Padding(0, 1).
			BorderForeground(lipgloss.Color(ColorBorder))

	CardBorderStyle = lipgloss.NewStyle().
			Border(lipgloss.NormalBorder()).
			Padding(0, 1).
			BorderForeground(lipgloss.Color(ColorBorder))

	ProgressFilledStyle = lipgloss.NewStyle().
				Foreground(lipgloss.Color(ColorGreen))

	ProgressEmptyStyle = lipgloss.NewStyle().
				Foreground(lipgloss.Color(ColorGreenTrack))

	DangerStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color(ColorRed))

	WarningStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color(ColorOrange))

	GoodStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color(ColorGreen))

	DimmedStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color(ColorDimmed))

	ActiveTabStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color(ColorAccent))

	InactiveTabStyle = lipgloss.NewStyle().
				Foreground(lipgloss.Color(ColorDimmed))

	SectionStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color(ColorAccent))

	SubtextStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color(ColorTextMuted))

	PanelTitleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color(ColorAccent))

	LogoStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color(ColorAccent))

	LogoIconStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color(ColorAccent))

	HeadingStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color(ColorAccent))

	BodyStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color(ColorWhite))

	StatusStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color(ColorGreen))
)

type Theme struct {
	Title          lipgloss.Style
	Header         lipgloss.Style
	Label          lipgloss.Style
	Value          lipgloss.Style
	Footer         lipgloss.Style
	Border         lipgloss.Style
	ProgressFilled lipgloss.Style
	ProgressEmpty  lipgloss.Style
	Danger         lipgloss.Style
	Warning        lipgloss.Style
	Good           lipgloss.Style
	Dimmed         lipgloss.Style
	ActiveTab      lipgloss.Style
	InactiveTab    lipgloss.Style
	Section        lipgloss.Style
	Subtext        lipgloss.Style
	PanelTitle     lipgloss.Style
	Logo           lipgloss.Style
	Heading        lipgloss.Style
	Body           lipgloss.Style
	Status         lipgloss.Style
}

var themes = map[string]Theme{
	"dark":         darkTheme(),
	"light":        lightTheme(),
	"highcontrast": highContrastTheme(),
}

func darkTheme() Theme {
	return Theme{
		Title:          lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(ColorWhite)),
		Header:         lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(ColorAccent)),
		Label:          lipgloss.NewStyle().Foreground(lipgloss.Color(ColorTextMuted)),
		Value:          lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(ColorWhite)),
		Footer:         lipgloss.NewStyle().Foreground(lipgloss.Color(ColorDimmed)),
		Border:         lipgloss.NewStyle().Border(lipgloss.NormalBorder()).Padding(0, 1).BorderForeground(lipgloss.Color(ColorBorder)),
		ProgressFilled: lipgloss.NewStyle().Foreground(lipgloss.Color(ColorGreen)),
		ProgressEmpty:  lipgloss.NewStyle().Foreground(lipgloss.Color(ColorGreenTrack)),
		Danger:         lipgloss.NewStyle().Foreground(lipgloss.Color(ColorRed)),
		Warning:        lipgloss.NewStyle().Foreground(lipgloss.Color(ColorOrange)),
		Good:           lipgloss.NewStyle().Foreground(lipgloss.Color(ColorGreen)),
		Dimmed:         lipgloss.NewStyle().Foreground(lipgloss.Color(ColorDimmed)),
		ActiveTab:      lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(ColorAccent)),
		InactiveTab:    lipgloss.NewStyle().Foreground(lipgloss.Color(ColorDimmed)),
		Section:        lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(ColorAccent)),
		Subtext:        lipgloss.NewStyle().Foreground(lipgloss.Color(ColorTextMuted)),
		PanelTitle:     lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(ColorAccent)),
		Logo:           lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(ColorAccent)),
		Heading:        lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color(ColorAccent)),
		Body:           lipgloss.NewStyle().Foreground(lipgloss.Color(ColorWhite)),
		Status:         lipgloss.NewStyle().Foreground(lipgloss.Color(ColorGreen)),
	}
}

func lightTheme() Theme {
	return Theme{
		Title:          lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#005F87")),
		Header:         lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#008000")),
		Label:          lipgloss.NewStyle().Foreground(lipgloss.Color("#444444")),
		Value:          lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#000000")),
		Footer:         lipgloss.NewStyle().Foreground(lipgloss.Color("#999999")),
		Border:         lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).Padding(0, 1).BorderForeground(lipgloss.Color("#CCCCCC")),
		ProgressFilled: lipgloss.NewStyle().Foreground(lipgloss.Color("#008000")),
		ProgressEmpty:  lipgloss.NewStyle().Foreground(lipgloss.Color("#E0E0E0")),
		Danger:         lipgloss.NewStyle().Foreground(lipgloss.Color("#CC0000")),
		Warning:        lipgloss.NewStyle().Foreground(lipgloss.Color("#CC8800")),
		Good:           lipgloss.NewStyle().Foreground(lipgloss.Color("#008000")),
		Dimmed:         lipgloss.NewStyle().Foreground(lipgloss.Color("#AAAAAA")),
		ActiveTab:      lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#005F87")),
		InactiveTab:    lipgloss.NewStyle().Foreground(lipgloss.Color("#AAAAAA")),
		Section:        lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#008000")),
		Subtext:        lipgloss.NewStyle().Foreground(lipgloss.Color("#666666")),
		PanelTitle:     lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#008000")),
		Logo:           lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#000000")),
		Heading:        lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#008000")),
		Body:           lipgloss.NewStyle().Foreground(lipgloss.Color("#000000")),
		Status:         lipgloss.NewStyle().Foreground(lipgloss.Color("#008000")),
	}
}

func highContrastTheme() Theme {
	return Theme{
		Title:          lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#FFFF00")).Background(lipgloss.Color("#0000FF")),
		Header:         lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#00FF00")),
		Label:          lipgloss.NewStyle().Foreground(lipgloss.Color("#FFFFFF")),
		Value:          lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#FFFFFF")).Background(lipgloss.Color("#000000")),
		Footer:         lipgloss.NewStyle().Foreground(lipgloss.Color("#888888")),
		Border:         lipgloss.NewStyle().Border(lipgloss.DoubleBorder()).Padding(0, 1).BorderForeground(lipgloss.Color("#FFFF00")),
		ProgressFilled: lipgloss.NewStyle().Foreground(lipgloss.Color("#00FF00")),
		ProgressEmpty:  lipgloss.NewStyle().Foreground(lipgloss.Color("#444444")),
		Danger:         lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#FF0000")).Background(lipgloss.Color("#FFFFFF")),
		Warning:        lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#FFAA00")),
		Good:           lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#00FF00")),
		Dimmed:         lipgloss.NewStyle().Foreground(lipgloss.Color("#888888")),
		ActiveTab:      lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#FFFF00")).Background(lipgloss.Color("#0000FF")),
		InactiveTab:    lipgloss.NewStyle().Foreground(lipgloss.Color("#888888")),
		Section:        lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#00FF00")),
		Subtext:        lipgloss.NewStyle().Foreground(lipgloss.Color("#AAAAAA")),
		PanelTitle:     lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#00FF00")),
		Logo:           lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#FFFF00")).Background(lipgloss.Color("#0000FF")),
		Heading:        lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#00FF00")),
		Body:           lipgloss.NewStyle().Foreground(lipgloss.Color("#FFFFFF")).Background(lipgloss.Color("#000000")),
		Status:         lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#00FF00")),
	}
}

func ApplyTheme(name string) {
	t, ok := themes[name]
	if !ok {
		t = themes["dark"]
	}
	TitleStyle = t.Title
	HeaderStyle = t.Header
	LabelStyle = t.Label
	ValueStyle = t.Value
	FooterStyle = t.Footer
	BorderStyle = t.Border
	CardBorderStyle = t.Border
	ProgressFilledStyle = t.ProgressFilled
	ProgressEmptyStyle = t.ProgressEmpty
	DangerStyle = t.Danger
	WarningStyle = t.Warning
	GoodStyle = t.Good
	DimmedStyle = t.Dimmed
	ActiveTabStyle = t.ActiveTab
	InactiveTabStyle = t.InactiveTab
	SectionStyle = t.Section
	SubtextStyle = t.Subtext
	PanelTitleStyle = t.PanelTitle
	LogoStyle = t.Logo
	LogoIconStyle = t.Logo
	HeadingStyle = t.Heading
	BodyStyle = t.Body
	StatusStyle = t.Status
}
