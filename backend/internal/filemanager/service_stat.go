package filemanager

import (
	"context"
)

func (s *Service) Stat(ctx context.Context, actor, path string) (*StatInfo, error) {
	if err := ValidatePath(path); err != nil {
		return nil, err
	}
	if err := s.authorize(ctx, actor, OpStat); err != nil {
		return nil, err
	}

	info, err := s.fs.Stat(ctx, path)
	if err != nil {
		return nil, mapClientError(err)
	}
	return info, nil
}
