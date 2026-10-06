package terminal

import (
	"context"
	"sync"
)

type sessionStore struct {
	mu       sync.RWMutex
	sessions map[string]*SessionMetadata
}

func NewSessionStore() SessionStore {
	return &sessionStore{
		sessions: make(map[string]*SessionMetadata),
	}
}

func (s *sessionStore) Create(_ context.Context, meta *SessionMetadata) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions[meta.ID] = meta
	return nil
}

func (s *sessionStore) Get(_ context.Context, id string) (*SessionMetadata, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	meta, ok := s.sessions[id]
	if !ok {
		return nil, ErrSessionNotFound
	}
	return meta, nil
}

func (s *sessionStore) List(_ context.Context) ([]SessionMetadata, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]SessionMetadata, 0, len(s.sessions))
	for _, meta := range s.sessions {
		result = append(result, *meta)
	}
	return result, nil
}

func (s *sessionStore) Delete(_ context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.sessions[id]; !ok {
		return ErrSessionNotFound
	}
	delete(s.sessions, id)
	return nil
}

func (s *sessionStore) Update(_ context.Context, meta *SessionMetadata) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.sessions[meta.ID]; !ok {
		return ErrSessionNotFound
	}
	s.sessions[meta.ID] = meta
	return nil
}
