package filemanager

import (
	"context"
	"os"
)

func (fs *osFilesystem) Mkdir(ctx context.Context, path string) error {
	resolved, err := fs.resolve(ctx, path)
	if err != nil {
		return err
	}

	return os.MkdirAll(resolved, 0755)
}
