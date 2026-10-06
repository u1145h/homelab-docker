package filemanager

import (
	"context"

	"github.com/ullashroy/poco-server/backend/internal/audit"
)

func (s *Service) Copy(ctx context.Context, actor, source, target string, progress ProgressFunc) error {
	if err := ValidatePath(source); err != nil {
		return err
	}
	if err := ValidatePath(target); err != nil {
		return err
	}
	if err := s.authorize(ctx, actor, OpCopy); err != nil {
		return err
	}

	if err := s.fs.Copy(ctx, source, target, progress); err != nil {
		s.auditLog(audit.LogRequest{
			Action:  audit.ActionFileCopy,
			Actor:   actor,
			Target:  source + " -> " + target,
			Status:  audit.StatusFailure,
			Message: err.Error(),
		})
		return mapClientError(err)
	}

	s.auditLog(audit.LogRequest{
		Action: audit.ActionFileCopy,
		Actor:  actor,
		Target: source + " -> " + target,
		Status: audit.StatusSuccess,
	})
	return nil
}
