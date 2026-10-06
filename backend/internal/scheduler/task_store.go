package scheduler

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"
)

type TaskStore struct {
	mu      sync.RWMutex
	tasks   []TaskDefinition
	history []ExecutionRecord
	nextID  int
	path    string
	changed bool
}

const maxHistory = 200

func NewTaskStore(path string) *TaskStore {
	ts := &TaskStore{
		path: path,
	}
	ts.load()
	if len(ts.tasks) == 0 {
		ts.seedDefaults()
	}
	return ts
}

func (s *TaskStore) Add(t TaskDefinition) string {
	id := generateTaskID()
	t.ID = id
	t.CreatedAt = time.Now()
	t.UpdatedAt = time.Now()
	t.Status = "idle"
	t.NextRun = calculateNextRun(t, time.Now())
	s.mu.Lock()
	defer s.mu.Unlock()
	s.tasks = append(s.tasks, t)
	s.changed = true
	s.save()
	return id
}

func (s *TaskStore) Get(id string) (TaskDefinition, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, t := range s.tasks {
		if t.ID == id {
			return t, true
		}
	}
	return TaskDefinition{}, false
}

func (s *TaskStore) Update(t TaskDefinition) bool {
	t.UpdatedAt = time.Now()
	t.NextRun = calculateNextRun(t, time.Now())
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.tasks {
		if s.tasks[i].ID == t.ID {
			s.tasks[i] = t
			s.changed = true
			s.save()
			return true
		}
	}
	return false
}

func (s *TaskStore) Delete(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.tasks {
		if s.tasks[i].ID == id {
			s.tasks = append(s.tasks[:i], s.tasks[i+1:]...)
			s.changed = true
			s.save()
			return true
		}
	}
	return false
}

func (s *TaskStore) List() []TaskDefinition {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]TaskDefinition, len(s.tasks))
	copy(result, s.tasks)
	return result
}

func (s *TaskStore) AddExecutionRecord(rec ExecutionRecord) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.history = append(s.history, rec)
	if len(s.history) > maxHistory {
		s.history = s.history[len(s.history)-maxHistory:]
	}
	s.changed = true
	s.save()
}

func (s *TaskStore) ExecutionHistory(limit int) []ExecutionRecord {
	s.mu.RLock()
	defer s.mu.RUnlock()
	n := len(s.history)
	if limit > 0 && limit < n {
		n = limit
	}
	result := make([]ExecutionRecord, n)
	copy(result, s.history[len(s.history)-n:])
	return result
}

func (s *TaskStore) ExecutionHistoryByTask(taskID string) []ExecutionRecord {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var result []ExecutionRecord
	for _, r := range s.history {
		if r.TaskID == taskID {
			result = append(result, r)
		}
	}
	return result
}

func (s *TaskStore) save() {
	if s.path == "" {
		return
	}
	data := struct {
		Tasks   []TaskDefinition  `json:"tasks"`
		History []ExecutionRecord `json:"history"`
	}{
		Tasks:   s.tasks,
		History: s.history,
	}
	b, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return
	}
	if err := os.WriteFile(s.path, b, 0644); err != nil {
		return
	}
}

func (s *TaskStore) load() {
	if s.path == "" {
		return
	}
	b, err := os.ReadFile(s.path)
	if err != nil {
		return
	}
	var data struct {
		Tasks   []TaskDefinition  `json:"tasks"`
		History []ExecutionRecord `json:"history"`
	}
	if err := json.Unmarshal(b, &data); err != nil {
		return
	}
	s.tasks = data.Tasks
	s.history = data.History
}

func (s *TaskStore) seedDefaults() {
	now := time.Now()
	defaults := []TaskDefinition{
		{
			Name:        "Storage Refresh",
			Description: "Refresh storage mount information",
			Enabled:     true,
			Trigger:     Trigger{Type: TriggerInterval, Interval: 5 * time.Minute},
			Action:      Action{Type: ActionRefreshStorage},
			CreatedAt:   now,
			UpdatedAt:   now,
			Status:      "idle",
		},
		{
			Name:        "Health Check",
			Description: "Check system health status",
			Enabled:     true,
			Trigger:     Trigger{Type: TriggerInterval, Interval: 1 * time.Minute},
			Action:      Action{Type: ActionHealthCheck},
			CreatedAt:   now,
			UpdatedAt:   now,
			Status:      "idle",
		},
	}
	for i := range defaults {
		defaults[i].ID = generateTaskID()
		defaults[i].NextRun = calculateNextRun(defaults[i], now)
		s.tasks = append(s.tasks, defaults[i])
	}
	s.changed = true
}

func calculateNextRun(t TaskDefinition, now time.Time) *time.Time {
	switch t.Trigger.Type {
	case TriggerOneshot:
		if t.LastRun != nil {
			return nil
		}
		return &t.Trigger.RunAt
	case TriggerInterval:
		base := t.LastRun
		if base == nil {
			b := t.CreatedAt
			if b.IsZero() {
				b = now
			}
			base = &b
		}
		next := base.Add(t.Trigger.Interval)
		return &next
	case TriggerCron:
		next := nextCronTime(t.Trigger.CronExpr, now)
		return &next
	}
	return nil
}

func generateTaskID() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("task-%x", time.Now().UnixNano())
	}
	return fmt.Sprintf("task-%x", b)
}
