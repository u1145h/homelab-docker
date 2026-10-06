package audit

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

type JSONRepository struct {
	path string
	mu   sync.RWMutex
}

type auditData struct {
	Entries []Entry `json:"entries"`
}

func NewJSONRepository(path string) (*JSONRepository, error) {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}
	return &JSONRepository{path: path}, nil
}

func (r *JSONRepository) List(filter AuditFilter) ([]Entry, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	data, err := r.load()
	if err != nil {
		return nil, err
	}

	entries := make([]Entry, len(data.Entries))
	copy(entries, data.Entries)

	for i, j := 0, len(entries)-1; i < j; i, j = i+1, j-1 {
		entries[i], entries[j] = entries[j], entries[i]
	}

	if filter.Action != "" {
		filtered := make([]Entry, 0, len(entries))
		for i := range entries {
			if entries[i].Action == filter.Action {
				filtered = append(filtered, entries[i])
			}
		}
		entries = filtered
	}

	offset := filter.Offset
	if offset < 0 {
		offset = 0
	}
	if offset >= len(entries) {
		return []Entry{}, nil
	}
	entries = entries[offset:]

	if filter.Limit > 0 && filter.Limit < len(entries) {
		entries = entries[:filter.Limit]
	}

	return entries, nil
}

func (r *JSONRepository) GetByID(id string) (*Entry, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	data, err := r.load()
	if err != nil {
		return nil, err
	}

	for i := range data.Entries {
		if data.Entries[i].ID == id {
			entry := data.Entries[i]
			return &entry, nil
		}
	}

	return nil, ErrNotFound
}

func (r *JSONRepository) Create(entry *Entry) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	data, err := r.load()
	if err != nil {
		return err
	}

	data.Entries = append(data.Entries, *entry)

	return r.save(data)
}

func (r *JSONRepository) load() (auditData, error) {
	raw, err := os.ReadFile(r.path)
	if err != nil {
		if os.IsNotExist(err) {
			return auditData{}, nil
		}
		return auditData{}, err
	}

	var data auditData
	if err := json.Unmarshal(raw, &data); err != nil {
		return auditData{}, err
	}

	return data, nil
}

func (r *JSONRepository) save(data auditData) error {
	raw, err := json.MarshalIndent(data, "", "    ")
	if err != nil {
		return err
	}

	tmpPath := r.path + ".tmp"

	f, err := os.OpenFile(tmpPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		return err
	}

	if _, err := f.Write(raw); err != nil {
		f.Close()
		os.Remove(tmpPath)
		return err
	}

	if err := f.Sync(); err != nil {
		f.Close()
		os.Remove(tmpPath)
		return err
	}

	if err := f.Close(); err != nil {
		os.Remove(tmpPath)
		return err
	}

	if err := os.Rename(tmpPath, r.path); err != nil {
		os.Remove(tmpPath)
		return err
	}

	return nil
}
