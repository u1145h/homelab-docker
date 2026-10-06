package filemanager

import "errors"

var (
	ErrNotFound         = errors.New("file or directory not found")
	ErrAlreadyExists    = errors.New("file or directory already exists")
	ErrPermissionDenied = errors.New("permission denied")
	ErrInvalidPath      = errors.New("invalid path")
	ErrPathTraversal    = errors.New("path traversal detected")
	ErrEmptyPath        = errors.New("path is empty")
	ErrRootOperation    = errors.New("cannot modify filesystem root")
	ErrIsDirectory      = errors.New("path is a directory")
	ErrNotDirectory     = errors.New("path is not a directory")
	ErrCopyIntoSelf     = errors.New("cannot copy directory into itself")
	ErrMoveIntoSelf     = errors.New("cannot move directory into itself")
)
