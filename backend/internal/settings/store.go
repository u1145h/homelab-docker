package settings

import (
	"encoding/json"
	"os"
	"sync"
)

type Settings struct {
	Theme                 string `json:"theme"`
	RefreshInterval       int    `json:"refreshInterval"`
	DefaultPage           string `json:"defaultPage"`
	ShowHiddenFiles       bool   `json:"showHiddenFiles"`
	NotificationRetention int    `json:"notificationRetention"`
	JobRetention          int    `json:"jobRetention"`
}

type Store struct {
	mu   sync.RWMutex
	s    Settings
	path string
}

func NewStore(path string) *Store {
	s := &Store{
		path: path,
		s:    defaultSettings(),
	}
	s.load()
	return s
}

func defaultSettings() Settings {
	return Settings{
		Theme:                 "dark",
		RefreshInterval:       1,
		DefaultPage:           "Dashboard",
		ShowHiddenFiles:       false,
		NotificationRetention: 200,
		JobRetention:          50,
	}
}

func (s *Store) Get() Settings {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.s
}

func (s *Store) Set(settings Settings) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.s = settings
	s.save()
}

func (s *Store) save() {
	if s.path == "" {
		return
	}
	b, err := json.MarshalIndent(s.s, "", "  ")
	if err != nil {
		return
	}
	os.WriteFile(s.path, b, 0644)
}

func (s *Store) load() {
	if s.path == "" {
		return
	}
	b, err := os.ReadFile(s.path)
	if err != nil {
		return
	}
	var loaded Settings
	if err := json.Unmarshal(b, &loaded); err != nil {
		return
	}
	s.s = loaded
}
