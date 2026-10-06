package filemanager

import (
	"context"
	"os"
	"path/filepath"
)

type osFilesystem struct {
	root string
}

func NewOSFilesystem(root string) (*osFilesystem, error) {
	absRoot, err := filepath.Abs(root)
	if err != nil {
		return nil, ErrInvalidPath
	}
	if err := os.MkdirAll(absRoot, 0755); err != nil {
		return nil, err
	}
	return &osFilesystem{root: absRoot}, nil
}

func (fs *osFilesystem) resolve(_ context.Context, unsafe string) (string, error) {
	return Resolve(fs.root, unsafe)
}
