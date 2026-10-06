package history

import (
	"context"
	"log/slog"
	"time"
)

func (s *Service) RunRetention(ctx context.Context) {
	slog.Info("history: retention worker started",
		"retention_period", s.config.RetentionPeriod,
		"cleanup_interval", s.config.CleanupInterval,
	)

	ticker := time.NewTicker(s.config.CleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("history: retention worker stopped")
			return
		case <-ticker.C:
			s.cleanup()
		}
	}
}

func (s *Service) cleanup() {
	cutoff := time.Now().Add(-s.config.RetentionPeriod)

	deleted, err := s.repo.DeleteBefore(cutoff)
	if err != nil {
		slog.Error("history: retention cleanup failed", "error", err)
		return
	}

	if deleted > 0 {
		slog.Info("history: retention cleanup completed",
			"deleted", deleted,
			"cutoff", cutoff.Format(time.RFC3339),
		)
	}
}
