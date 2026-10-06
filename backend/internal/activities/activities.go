package activities

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type Event struct {
	ID        int       `json:"id"`
	Type      string    `json:"type"`
	Text      string    `json:"text"`
	Timestamp time.Time `json:"timestamp"`
	Icon      string    `json:"icon"`
	Color     string    `json:"color"`
}

type fileData struct {
	Events []Event `json:"events"`
	NextID int     `json:"next_id"`
}

type Store struct {
	mu     sync.Mutex
	events []Event
	nextID int
	max    int
	path   string
}

func New(max int, path ...string) *Store {
	var filePath string
	if len(path) > 0 {
		filePath = path[0]
	}

	s := &Store{
		max:  max,
		path: filePath,
	}

	if s.path != "" {
		s.load()
	}

	return s
}

func (s *Store) load() {
	raw, err := os.ReadFile(s.path)
	if err != nil {
		return
	}

	var data fileData
	if err := json.Unmarshal(raw, &data); err != nil {
		return
	}

	s.events = data.Events
	s.nextID = data.NextID

	for _, e := range s.events {
		if e.ID >= s.nextID {
			s.nextID = e.ID
		}
	}
}

func (s *Store) save() {
	if s.path == "" {
		return
	}

	dir := filepath.Dir(s.path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return
	}

	data := fileData{
		Events: s.events,
		NextID: s.nextID,
	}

	raw, err := json.MarshalIndent(data, "", "    ")
	if err != nil {
		return
	}

	tmpPath := s.path + ".tmp"
	f, err := os.OpenFile(tmpPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		return
	}

	if _, err := f.Write(raw); err != nil {
		f.Close()
		os.Remove(tmpPath)
		return
	}

	if err := f.Sync(); err != nil {
		f.Close()
		os.Remove(tmpPath)
		return
	}

	if err := f.Close(); err != nil {
		os.Remove(tmpPath)
		return
	}

	_ = os.Rename(tmpPath, s.path)
}

func (s *Store) Publish(typ, text, icon, color string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.nextID++
	e := Event{
		ID:        s.nextID,
		Type:      typ,
		Text:      text,
		Timestamp: time.Now(),
		Icon:      icon,
		Color:     color,
	}

	s.events = append([]Event{e}, s.events...)

	if s.max > 0 && len(s.events) > s.max {
		s.events = s.events[:s.max]
	}

	s.save()
}

func (s *Store) Query(offset, limit int) ([]Event, int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	total := len(s.events)

	if offset < 0 {
		offset = 0
	}
	if limit <= 0 {
		limit = 15
	}
	if offset >= total {
		return []Event{}, total
	}

	end := offset + limit
	if end > total {
		end = total
	}

	result := make([]Event, end-offset)
	copy(result, s.events[offset:end])
	return result, total
}
