package filemanager

import (
	"context"
	"os"
	"path/filepath"
	"strings"
)

func (fs *osFilesystem) Rename(ctx context.Context, source, target string) error {
	src, err := fs.resolve(ctx, source)
	if err != nil {
		return err
	}

	dst, err := fs.resolve(ctx, target)
	if err != nil {
		return err
	}

	if src == dst {
		return nil
	}

	rel, err := filepath.Rel(src, dst)
	if err == nil && rel != "." && !strings.HasPrefix(rel, "..") {
		return ErrMoveIntoSelf
	}

	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		return err
	}

	return os.Rename(src, dst)
}
