package audit

import (
	"crypto/rand"
	"fmt"
	"log/slog"
	"time"
)

type Service struct {
	repo       Repository
	checkAdmin func(username string) error
}

func NewService(repo Repository, checkAdmin func(username string) error) *Service {
	return &Service{repo: repo, checkAdmin: checkAdmin}
}

func (s *Service) Log(req LogRequest) {
	id, err := generateID()
	if err != nil {
		slog.Error("audit: failed to generate id", "error", err)
		return
	}

	entry := &Entry{
		ID:        id,
		Action:    req.Action,
		Actor:     req.Actor,
		Target:    req.Target,
		Status:    req.Status,
		Message:   req.Message,
		Metadata:  req.Metadata,
		Timestamp: time.Now(),
	}

	if err := s.repo.Create(entry); err != nil {
		slog.Error("audit: failed to persist entry",
			"error", err, "action", req.Action, "actor", req.Actor)
	}
}

func (s *Service) List(actorUsername string, filter AuditFilter) ([]Entry, error) {
	if err := s.checkAdmin(actorUsername); err != nil {
		return nil, err
	}
	return s.repo.List(filter)
}

func (s *Service) GetByID(actorUsername, id string) (*Entry, error) {
	if err := s.checkAdmin(actorUsername); err != nil {
		return nil, err
	}
	return s.repo.GetByID(id)
}

func generateID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return fmt.Sprintf("%x", b), nil
}
