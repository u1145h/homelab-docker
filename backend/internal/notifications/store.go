package notifications

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type Store struct {
	mu           sync.RWMutex
	filePath     string
	items        []Notification
	maxRetention int
}

func NewStore(dataDir string, maxRetention int) *Store {
	if maxRetention <= 0 {
		maxRetention = 500
	}
	s := &Store{
		filePath:     filepath.Join(dataDir, "notifications.json"),
		items:        make([]Notification, 0),
		maxRetention: maxRetention,
	}
	_ = s.load()
	return s
}

func (s *Store) load() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := os.ReadFile(s.filePath)
	if err != nil {
		if os.IsNotExist(err) {
			s.items = make([]Notification, 0)
			return nil
		}
		return err
	}

	var items []Notification
	if err := json.Unmarshal(data, &items); err != nil {
		return err
	}
	s.items = items
	return nil
}

func (s *Store) saveLocked() error {
	dir := filepath.Dir(s.filePath)
	_ = os.MkdirAll(dir, 0755)

	data, err := json.MarshalIndent(s.items, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, data, 0644)
}

func (s *Store) Add(severity Severity, category Category, title, message, actionURL string) Notification {
	s.mu.Lock()
	defer s.mu.Unlock()

	n := Notification{
		ID:        generateID(),
		Timestamp: time.Now(),
		Severity:  severity,
		Category:  category,
		Title:     title,
		Message:   message,
		Read:      false,
		ActionURL: actionURL,
	}

	s.items = append([]Notification{n}, s.items...)

	if len(s.items) > s.maxRetention {
		s.items = s.items[:s.maxRetention]
	}

	_ = s.saveLocked()
	return n
}

func (s *Store) List(f Filter) ([]Notification, int, int) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var filtered []Notification
	unreadCount := 0

	searchLower := strings.ToLower(strings.TrimSpace(f.Search))

	for _, item := range s.items {
		if !item.Read {
			unreadCount++
		}

		if f.UnreadOnly && item.Read {
			continue
		}
		if f.Severity != "" && item.Severity != f.Severity {
			continue
		}
		if f.Category != "" && item.Category != f.Category {
			continue
		}
		if f.StartDate != nil && item.Timestamp.Before(*f.StartDate) {
			continue
		}
		if f.EndDate != nil && item.Timestamp.After(*f.EndDate) {
			continue
		}
		if searchLower != "" {
			titleMatch := strings.Contains(strings.ToLower(item.Title), searchLower)
			msgMatch := strings.Contains(strings.ToLower(item.Message), searchLower)
			catMatch := strings.Contains(strings.ToLower(string(item.Category)), searchLower)
			if !titleMatch && !msgMatch && !catMatch {
				continue
			}
		}

		filtered = append(filtered, item)
	}

	totalFiltered := len(filtered)

	offset := f.Offset
	if offset < 0 {
		offset = 0
	}
	limit := f.Limit
	if limit <= 0 {
		limit = 50
	}

	if offset >= totalFiltered {
		return []Notification{}, totalFiltered, unreadCount
	}

	end := offset + limit
	if end > totalFiltered {
		end = totalFiltered
	}

	result := make([]Notification, end-offset)
	copy(result, filtered[offset:end])

	return result, totalFiltered, unreadCount
}

func (s *Store) GetSummary(recentLimit int) Summary {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if recentLimit <= 0 {
		recentLimit = 10
	}

	unreadCount := 0
	for _, item := range s.items {
		if !item.Read {
			unreadCount++
		}
	}

	total := len(s.items)
	recentCount := total
	if recentCount > recentLimit {
		recentCount = recentLimit
	}

	recent := make([]Notification, recentCount)
	copy(recent, s.items[:recentCount])

	return Summary{
		UnreadCount: unreadCount,
		TotalCount:  total,
		Recent:      recent,
	}
}

func (s *Store) MarkRead(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i := range s.items {
		if s.items[i].ID == id {
			if !s.items[i].Read {
				s.items[i].Read = true
				_ = s.saveLocked()
			}
			return true
		}
	}
	return false
}

func (s *Store) MarkAllRead() int {
	s.mu.Lock()
	defer s.mu.Unlock()

	updated := 0
	for i := range s.items {
		if !s.items[i].Read {
			s.items[i].Read = true
			updated++
		}
	}

	if updated > 0 {
		_ = s.saveLocked()
	}
	return updated
}

func (s *Store) Delete(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i, item := range s.items {
		if item.ID == id {
			s.items = append(s.items[:i], s.items[i+1:]...)
			_ = s.saveLocked()
			return true
		}
	}
	return false
}

func (s *Store) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.items = make([]Notification, 0)
	_ = s.saveLocked()
}

func generateID() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("ntf_%x", time.Now().UnixNano())
	}
	return fmt.Sprintf("ntf_%x", b)
}
