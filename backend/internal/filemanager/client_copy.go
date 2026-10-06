package filemanager

import (
	"context"
	"io"
	"os"
	"path/filepath"
	"strings"
)

func (fs *osFilesystem) Copy(ctx context.Context, source, target string, progress ProgressFunc) error {
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
		return ErrCopyIntoSelf
	}

	srcInfo, err := os.Stat(src)
	if err != nil {
		return err
	}

	if srcInfo.IsDir() {
		return fs.copyDir(ctx, src, dst, srcInfo, progress)
	}
	return fs.copyFile(ctx, src, dst, srcInfo, progress)
}

func (fs *osFilesystem) copyFile(ctx context.Context, src, dst string, info os.FileInfo, progress ProgressFunc) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	srcFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		return err
	}

	dstFile, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, info.Mode())
	if err != nil {
		return err
	}
	defer dstFile.Close()

	written, err := io.Copy(dstFile, srcFile)
	if err != nil {
		return err
	}

	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	if progress != nil {
		progress(Progress{
			Operation: OpCopy,
			Path:      dst,
			Completed: written,
			Total:     info.Size(),
		})
	}

	return nil
}

func (fs *osFilesystem) copyDir(ctx context.Context, src, dst string, info os.FileInfo, progress ProgressFunc) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	if err := os.MkdirAll(dst, info.Mode()); err != nil {
		return err
	}

	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())

		entryInfo, err := entry.Info()
		if err != nil {
			return err
		}

		if entryInfo.IsDir() {
			if err := fs.copyDir(ctx, srcPath, dstPath, entryInfo, progress); err != nil {
				return err
			}
		} else {
			if err := fs.copyFile(ctx, srcPath, dstPath, entryInfo, progress); err != nil {
				return err
			}
		}
	}

	return nil
}
