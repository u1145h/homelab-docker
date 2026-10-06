package filemanager

import (
	"context"

	"github.com/ullashroy/poco-server/backend/internal/audit"
)

func (s *Service) Move(ctx context.Context, actor, source, target string, progress ProgressFunc) error {
	if err := ValidatePath(source); err != nil {
		return err
	}
	if err := ValidatePath(target); err != nil {
		return err
	}
	if err := s.authorize(ctx, actor, OpMove); err != nil {
		return err
	}

	if err := s.fs.Move(ctx, source, target, progress); err != nil {
		s.auditLog(audit.LogRequest{
			Action:  audit.ActionFileMove,
			Actor:   actor,
			Target:  source + " -> " + target,
			Status:  audit.StatusFailure,
			Message: err.Error(),
		})
		return mapClientError(err)
	}

	s.auditLog(audit.LogRequest{
		Action: audit.ActionFileMove,
		Actor:  actor,
		Target: source + " -> " + target,
		Status: audit.StatusSuccess,
	})
	return nil
}

func (s *Service) Rename(ctx context.Context, actor, source, target string) error {
	if err := ValidatePath(source); err != nil {
		return err
	}
	if err := ValidatePath(target); err != nil {
		return err
	}
	if err := s.authorize(ctx, actor, OpRename); err != nil {
		return err
	}

	if err := s.fs.Rename(ctx, source, target); err != nil {
		s.auditLog(audit.LogRequest{
			Action:  audit.ActionFileRename,
			Actor:   actor,
			Target:  source + " -> " + target,
			Status:  audit.StatusFailure,
			Message: err.Error(),
		})
		return mapClientError(err)
	}

	s.auditLog(audit.LogRequest{
		Action: audit.ActionFileRename,
		Actor:  actor,
		Target: source + " -> " + target,
		Status: audit.StatusSuccess,
	})
	return nil
}
