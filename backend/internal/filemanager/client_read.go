package filemanager

import (
	"context"
	"io"
	"os"
)

func (fs *osFilesystem) Read(ctx context.Context, path string) (io.ReadCloser, *StatInfo, error) {
	resolved, err := fs.resolve(ctx, path)
	if err != nil {
		return nil, nil, err
	}

	file, err := os.Open(resolved)
	if err != nil {
		return nil, nil, err
	}

	info, err := file.Stat()
	if err != nil {
		file.Close()
		return nil, nil, err
	}

	if info.IsDir() {
		file.Close()
		return nil, nil, ErrIsDirectory
	}

	return file, toStatInfo(info, resolved), nil
}
