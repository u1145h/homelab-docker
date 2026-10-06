package filemanager

import (
	"context"
	"errors"
	"os"

	"github.com/ullashroy/poco-server/backend/internal/audit"
)

type Service struct {
	fs         Filesystem
	audit      *audit.Service
	authorizer Authorizer
}

func NewService(fs Filesystem, audit *audit.Service, authorizer Authorizer) *Service {
	return &Service{fs: fs, audit: audit, authorizer: authorizer}
}

func (s *Service) auditLog(req audit.LogRequest) {
	if s.audit != nil {
		s.audit.Log(req)
	}
}

func (s *Service) authorize(ctx context.Context, actor string, op Operation) error {
	if s.authorizer == nil {
		return nil
	}
	return s.authorizer.Authorize(ctx, actor, op)
}

func mapClientError(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, ErrEmptyPath) ||
		errors.Is(err, ErrPathTraversal) ||
		errors.Is(err, ErrInvalidPath) ||
		errors.Is(err, ErrRootOperation) ||
		errors.Is(err, ErrCopyIntoSelf) ||
		errors.Is(err, ErrMoveIntoSelf) ||
		errors.Is(err, ErrIsDirectory) ||
		errors.Is(err, ErrNotDirectory) {
		return err
	}
	if os.IsNotExist(err) {
		return ErrNotFound
	}
	if os.IsPermission(err) {
		return ErrPermissionDenied
	}
	if os.IsExist(err) {
		return ErrAlreadyExists
	}
	return err
}
