package filemanager

import (
	"context"
	"os"
	"path/filepath"
)

func (fs *osFilesystem) Delete(ctx context.Context, path string) error {
	resolved, err := fs.resolve(ctx, path)
	if err != nil {
		return err
	}

	absRoot, _ := filepath.Abs(fs.root)
	if resolved == absRoot {
		return ErrRootOperation
	}

	info, err := os.Stat(resolved)
	if err != nil {
		return err
	}

	if info.IsDir() {
		return os.RemoveAll(resolved)
	}
	return os.Remove(resolved)
}
