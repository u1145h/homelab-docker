package filemanager

import (
	"context"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

func (fs *osFilesystem) List(ctx context.Context, path string) ([]Item, error) {
	resolved, err := fs.resolve(ctx, path)
	if err != nil {
		return nil, err
	}

	entries, err := os.ReadDir(resolved)
	if err != nil {
		return nil, err
	}

	items := make([]Item, 0, len(entries))
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			continue
		}
		items = append(items, Item{
			Name:     info.Name(),
			Path:     filepath.Join(path, info.Name()),
			Type:     fileType(info),
			Size:     info.Size(),
			Modified: info.ModTime(),
			Mode:     info.Mode().String(),
		})
	}

	sort.Slice(items, func(i, j int) bool {
		if items[i].Type == "directory" && items[j].Type != "directory" {
			return true
		}
		if items[i].Type != "directory" && items[j].Type == "directory" {
			return false
		}
		return strings.ToLower(items[i].Name) < strings.ToLower(items[j].Name)
	})

	return items, nil
}

func fileType(info os.FileInfo) string {
	if info.IsDir() {
		return "directory"
	}
	if info.Mode()&os.ModeSymlink != 0 {
		return "symlink"
	}
	return "file"
}
