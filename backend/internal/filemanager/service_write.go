package filemanager

import (
	"context"
	"io"

	"github.com/ullashroy/poco-server/backend/internal/audit"
)

func (s *Service) Write(ctx context.Context, actor, path string, reader io.Reader, size int64) error {
	if err := ValidatePath(path); err != nil {
		return err
	}
	if err := s.authorize(ctx, actor, OpWrite); err != nil {
		return err
	}

	_, statErr := s.fs.Stat(ctx, path)
	exists := statErr == nil

	action := audit.ActionFileCreate
	if exists {
		action = audit.ActionFileUpdate
	}

	if err := s.fs.Write(ctx, path, reader, size); err != nil {
		s.auditLog(audit.LogRequest{
			Action:  action,
			Actor:   actor,
			Target:  path,
			Status:  audit.StatusFailure,
			Message: err.Error(),
		})
		return mapClientError(err)
	}

	s.auditLog(audit.LogRequest{
		Action: action,
		Actor:  actor,
		Target: path,
		Status: audit.StatusSuccess,
	})
	return nil
}
