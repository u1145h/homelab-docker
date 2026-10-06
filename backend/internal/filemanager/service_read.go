package filemanager

import (
	"context"
	"io"
)

func (s *Service) Read(ctx context.Context, actor, path string) (io.ReadCloser, *StatInfo, error) {
	if err := ValidatePath(path); err != nil {
		return nil, nil, err
	}
	if err := s.authorize(ctx, actor, OpRead); err != nil {
		return nil, nil, err
	}

	reader, info, err := s.fs.Read(ctx, path)
	if err != nil {
		return nil, nil, mapClientError(err)
	}
	return reader, info, nil
}
