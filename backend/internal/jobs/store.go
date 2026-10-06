package jobs

import (
	"crypto/rand"
	"fmt"
	"sync"
	"time"
)

type JobStatus string

const (
	JobQueued    JobStatus = "queued"
	JobRunning   JobStatus = "running"
	JobCompleted JobStatus = "completed"
	JobFailed    JobStatus = "failed"
	JobCancelled JobStatus = "cancelled"
)

type Severity string

const (
	SevInfo    Severity = "info"
	SevSuccess Severity = "success"
	SevWarning Severity = "warning"
	SevError   Severity = "error"
)

type Job struct {
	ID         string     `json:"id"`
	Title      string     `json:"title"`
	Source     string     `json:"source"`
	Status     JobStatus  `json:"status"`
	Progress   float64    `json:"progress"`
	StartedAt  time.Time  `json:"startedAt"`
	FinishedAt *time.Time `json:"finishedAt,omitempty"`
	Error      string     `json:"error,omitempty"`
}

type Notification struct {
	Timestamp time.Time `json:"timestamp"`
	Severity  Severity  `json:"severity"`
	Source    string    `json:"source"`
	Message   string    `json:"message"`
}

type Store struct {
	mu            sync.RWMutex
	jobs          []Job
	notifications []Notification
	maxJobs       int
	maxNotifs     int
}

func NewStore() *Store {
	return &Store{
		maxJobs:   50,
		maxNotifs: 200,
	}
}

func (s *Store) AddJob(title, source string) string {
	id := generateID()
	now := time.Now()
	s.mu.Lock()
	defer s.mu.Unlock()
	s.jobs = append(s.jobs, Job{
		ID:        id,
		Title:     title,
		Source:    source,
		Status:    JobQueued,
		Progress:  0,
		StartedAt: now,
	})
	s.trimJobs()
	return id
}

func (s *Store) UpdateJobProgress(id string, progress float64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.jobs {
		if s.jobs[i].ID == id {
			s.jobs[i].Progress = progress
			if s.jobs[i].Status == JobQueued {
				s.jobs[i].Status = JobRunning
			}
			return
		}
	}
}

func (s *Store) CompleteJob(id string) {
	now := time.Now()
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.jobs {
		if s.jobs[i].ID == id {
			s.jobs[i].Status = JobCompleted
			s.jobs[i].Progress = 100
			s.jobs[i].FinishedAt = &now
			return
		}
	}
}

func (s *Store) FailJob(id string, errMsg string) {
	now := time.Now()
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.jobs {
		if s.jobs[i].ID == id {
			s.jobs[i].Status = JobFailed
			s.jobs[i].FinishedAt = &now
			s.jobs[i].Error = errMsg
			return
		}
	}
}

func (s *Store) CancelJob(id string) {
	now := time.Now()
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.jobs {
		if s.jobs[i].ID == id {
			s.jobs[i].Status = JobCancelled
			s.jobs[i].FinishedAt = &now
			return
		}
	}
}

func (s *Store) AddNotification(severity Severity, source, message string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.notifications = append(s.notifications, Notification{
		Timestamp: time.Now(),
		Severity:  severity,
		Source:    source,
		Message:   message,
	})
	s.trimNotifications()
}

func (s *Store) ListJobs() []Job {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]Job, len(s.jobs))
	copy(result, s.jobs)
	return result
}

func (s *Store) ListJobsBySource(source string) []Job {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var result []Job
	for _, j := range s.jobs {
		if j.Source == source {
			result = append(result, j)
		}
	}
	return result
}

func (s *Store) ListNotifications() []Notification {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]Notification, len(s.notifications))
	copy(result, s.notifications)
	return result
}

func (s *Store) ClearNotifications() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.notifications = nil
}

func (s *Store) ClearJobs() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.jobs = nil
}

func (s *Store) trimJobs() {
	if len(s.jobs) > s.maxJobs {
		excess := len(s.jobs) - s.maxJobs
		s.jobs = s.jobs[excess:]
	}
}

func (s *Store) trimNotifications() {
	if len(s.notifications) > s.maxNotifs {
		excess := len(s.notifications) - s.maxNotifs
		s.notifications = s.notifications[excess:]
	}
}

func generateID() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("%x", time.Now().UnixNano())
	}
	return fmt.Sprintf("%x", b)
}
