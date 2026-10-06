package filemanager

import (
	"context"
	"path/filepath"
)

func (s *Service) List(ctx context.Context, actor, path string) (*Directory, error) {
	if err := ValidatePath(path); err != nil {
		return nil, err
	}
	if err := s.authorize(ctx, actor, OpList); err != nil {
		return nil, err
	}

	items, err := s.fs.List(ctx, path)
	if err != nil {
		return nil, mapClientError(err)
	}

	parent := filepath.ToSlash(filepath.Dir(path))
	if path == "/" || parent == "." || parent == "" {
		parent = "/"
	}

	return &Directory{
		Path:   path,
		Parent: parent,
		Items:  items,
	}, nil
}
