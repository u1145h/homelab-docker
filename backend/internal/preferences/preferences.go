package preferences

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

// DockerSelectedContainer represents a featured container on the homepage Docker widget.
type DockerSelectedContainer struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	CustomLink string `json:"customLink,omitempty"`
}

// UserPreferences holds all user-scoped dashboard preferences.
type UserPreferences struct {
	// Appearance
	Theme  string `json:"theme"`
	Amoled bool   `json:"amoled"`

	// Widgets — list of widget IDs that are visible
	VisibleWidgets []string `json:"visible_widgets"`

	// Files Page Defaults
	FilesDefaultPath         string   `json:"files_default_path"`
	FilesDefaultViewMode     string   `json:"files_default_view_mode"`
	FilesExtraHiddenPatterns []string `json:"files_extra_hidden_patterns"`

	// Docker Homepage Widget Defaults
	DockerSelectedContainers []DockerSelectedContainer `json:"docker_selected_containers"`

	// Camera Page Defaults
	CameraDefaultOrientation string `json:"camera_default_orientation"`

	// Thresholds
	CPUWarn     int `json:"cpu_warn"`
	CPUCrit     int `json:"cpu_crit"`
	MemWarn     int `json:"mem_warn"`
	MemCrit     int `json:"mem_crit"`
	FSWarn      int `json:"fs_warn"`
	FSCrit      int `json:"fs_crit"`
	TempWarn    int `json:"temp_warn"`
	TempCrit    int `json:"temp_crit"`
	BatteryLow  int `json:"battery_low"`
	BatteryCrit int `json:"battery_crit"`

	// Notification rules & channels
	NotifyBrowser    bool   `json:"notify_browser"`
	NotifySound      bool   `json:"notify_sound"`
	MinSeverity      string `json:"min_severity"`
	QuietHours       bool   `json:"quiet_hours"`
	RenotifyInterval string `json:"renotify_interval"`

	// Category toggles (which notifications to get)
	NotifyCPU       bool `json:"notify_cpu"`
	NotifyMemory    bool `json:"notify_memory"`
	NotifyStorage   bool `json:"notify_storage"`
	NotifyThermal   bool `json:"notify_thermal"`
	NotifyBattery   bool `json:"notify_battery"`
	NotifyDocker    bool `json:"notify_docker"`
	NotifyNetwork   bool `json:"notify_network"`
	NotifyTailscale bool `json:"notify_tailscale"`
}

// DefaultPreferences returns the initial recommended values.
func DefaultPreferences() UserPreferences {
	return UserPreferences{
		Theme:  "dark",
		Amoled: false,
		VisibleWidgets: []string{
			"cpu", "memory", "storage", "network",
			"thermal", "battery", "docker", "tailscale", "activity",
		},
		FilesDefaultPath:         "/",
		FilesDefaultViewMode:     "table",
		FilesExtraHiddenPatterns: []string{},
		DockerSelectedContainers: []DockerSelectedContainer{},
		CameraDefaultOrientation: "0",
		CPUWarn:                  75,
		CPUCrit:                  90,
		MemWarn:                  80,
		MemCrit:                  95,
		FSWarn:                   85,
		FSCrit:                   95,
		TempWarn:                 70,
		TempCrit:                 85,
		BatteryLow:               20,
		BatteryCrit:              10,
		NotifyBrowser:            true,
		NotifySound:              true,
		MinSeverity:              "warning",
		QuietHours:               true,
		RenotifyInterval:         "30m",
		NotifyCPU:                true,
		NotifyMemory:             true,
		NotifyStorage:            true,
		NotifyThermal:            true,
		NotifyBattery:            true,
		NotifyDocker:             true,
		NotifyNetwork:            true,
		NotifyTailscale:          true,
	}
}

// Store manages per-user preference files under <dataDir>/preferences/.
type Store struct {
	mu      sync.RWMutex
	dataDir string
}

// NewStore creates a Store rooted at dataDir.
func NewStore(dataDir string) *Store {
	dir := filepath.Join(dataDir, "preferences")
	_ = os.MkdirAll(dir, 0755)
	return &Store{dataDir: dir}
}

func (s *Store) filePath(username string) string {
	// Sanitise username to prevent path traversal.
	safe := filepath.Base(username)
	return filepath.Join(s.dataDir, safe+".json")
}

// Load returns preferences for the given user, or defaults if not found.
func (s *Store) Load(username string) (UserPreferences, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	data, err := os.ReadFile(s.filePath(username))
	if os.IsNotExist(err) {
		return DefaultPreferences(), nil
	}
	if err != nil {
		return DefaultPreferences(), err
	}

	// Start with defaults so new fields are always populated.
	p := DefaultPreferences()
	if err := json.Unmarshal(data, &p); err != nil {
		return DefaultPreferences(), err
	}
	if p.VisibleWidgets == nil {
		p.VisibleWidgets = DefaultPreferences().VisibleWidgets
	}
	if p.FilesExtraHiddenPatterns == nil {
		p.FilesExtraHiddenPatterns = []string{}
	}
	if p.DockerSelectedContainers == nil {
		p.DockerSelectedContainers = []DockerSelectedContainer{}
	}
	return p, nil
}

// Save persists preferences for the given user.
func (s *Store) Save(username string, p UserPreferences) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if p.VisibleWidgets == nil {
		p.VisibleWidgets = DefaultPreferences().VisibleWidgets
	}
	if p.FilesExtraHiddenPatterns == nil {
		p.FilesExtraHiddenPatterns = []string{}
	}
	if p.DockerSelectedContainers == nil {
		p.DockerSelectedContainers = []DockerSelectedContainer{}
	}

	data, err := json.MarshalIndent(p, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath(username), data, 0644)
}
