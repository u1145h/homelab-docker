package filemanager

import (
	"context"

	"github.com/ullashroy/poco-server/backend/internal/audit"
)

func (s *Service) Delete(ctx context.Context, actor, path string) error {
	if err := ValidatePath(path); err != nil {
		return err
	}
	if err := s.authorize(ctx, actor, OpDelete); err != nil {
		return err
	}

	if err := s.fs.Delete(ctx, path); err != nil {
		s.auditLog(audit.LogRequest{
			Action:  audit.ActionFileDelete,
			Actor:   actor,
			Target:  path,
			Status:  audit.StatusFailure,
			Message: err.Error(),
		})
		return mapClientError(err)
	}

	s.auditLog(audit.LogRequest{
		Action: audit.ActionFileDelete,
		Actor:  actor,
		Target: path,
		Status: audit.StatusSuccess,
	})
	return nil
}
