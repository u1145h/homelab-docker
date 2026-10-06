package filemanager

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
)

func (fs *osFilesystem) Move(ctx context.Context, source, target string, progress ProgressFunc) error {
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

	// os.Rename is a single atomic syscall — no safe interruption point exists.
	// We do NOT check ctx.Done() before it: a cancelled request context should
	// not abort a rename that would otherwise succeed. Cancellation is only
	// checked before the long-running cross-device copy fallback below.
	if err := os.Rename(src, dst); err == nil {
		return nil
	} else if !errors.Is(err, os.ErrNotExist) && !isCrossDevice(err) {
		return err
	}

	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	srcInfo, err := os.Stat(src)
	if err != nil {
		return err
	}

	if srcInfo.IsDir() {
		if err := fs.copyDir(ctx, src, dst, srcInfo, progress); err != nil {
			return err
		}
	} else {
		if err := fs.copyFile(ctx, src, dst, srcInfo, progress); err != nil {
			return err
		}
	}

	if err := os.RemoveAll(src); err != nil {
		return err
	}

	return nil
}

// isCrossDevice detects EXDEV (cross-device link) errors from os.Rename.
// Detection relies on the OS error string, which is locale-independent for
// EXDEV on Linux/macOS. The underlying error is confirmed to be from a link
// operation via *os.LinkError type assertion, reducing false positives.
//
// TODO: Replace string matching with a platform-independent approach.
// On Linux: syscall.EXDEV exists but is in golang.org/x/sys/unix.
// On Windows: cross-volume renames use ERROR_NOT_SAME_DEVICE (different string).
func isCrossDevice(err error) bool {
	var linkErr *os.LinkError
	if errors.As(err, &linkErr) {
		return strings.Contains(linkErr.Err.Error(), "cross-device link")
	}
	return strings.Contains(err.Error(), "invalid cross-device link")
}
