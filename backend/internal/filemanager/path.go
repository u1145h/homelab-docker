package filemanager

import (
	"os"
	"path/filepath"
	"strings"
)

func Resolve(root, unsafe string) (string, error) {
	if unsafe == "" {
		return "", ErrEmptyPath
	}

	for _, part := range strings.FieldsFunc(unsafe, func(r rune) bool {
		return r == '/' || r == '\\'
	}) {
		if part == ".." {
			return "", ErrPathTraversal
		}
	}

	absRoot, err := filepath.Abs(root)
	if err != nil {
		return "", ErrInvalidPath
	}

	unsafe = strings.TrimLeft(unsafe, "/\\")
	if unsafe == "" {
		return absRoot, nil
	}

	clean := filepath.Clean(unsafe)

	if filepath.IsAbs(clean) {
		return "", ErrPathTraversal
	}

	resolved := filepath.Join(absRoot, clean)

	if !IsSubPath(absRoot, resolved) {
		return "", ErrPathTraversal
	}

	if info, err := os.Lstat(resolved); err == nil && info.Mode()&os.ModeSymlink != 0 {
		real, err := filepath.EvalSymlinks(resolved)
		if err != nil {
			return "", ErrPathTraversal
		}
		if !IsSubPath(absRoot, real) {
			return "", ErrPathTraversal
		}
	}

	return resolved, nil
}

func IsSubPath(base, target string) bool {
	rel, err := filepath.Rel(base, target)
	if err != nil {
		return false
	}
	return !strings.HasPrefix(rel, "..") && rel != ".."
}

func ValidatePath(path string) error {
	if path == "" {
		return ErrEmptyPath
	}
	if strings.Contains(path, "\x00") {
		return ErrInvalidPath
	}
	return nil
}
