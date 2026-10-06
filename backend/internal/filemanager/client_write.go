package filemanager

import (
	"context"
	"io"
	"os"
	"path/filepath"
)

func (fs *osFilesystem) Write(ctx context.Context, path string, reader io.Reader, _ int64) error {
	resolved, err := fs.resolve(ctx, path)
	if err != nil {
		return err
	}

	parent := filepath.Dir(resolved)
	if err := os.MkdirAll(parent, 0755); err != nil {
		return err
	}

	file, err := os.OpenFile(resolved, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = io.Copy(file, reader)
	return err
}
