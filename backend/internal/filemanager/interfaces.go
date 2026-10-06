package filemanager

import (
	"context"
	"io"
)

type Filesystem interface {
	List(ctx context.Context, path string) ([]Item, error)
	Read(ctx context.Context, path string) (io.ReadCloser, *StatInfo, error)
	Write(ctx context.Context, path string, reader io.Reader, size int64) error
	Delete(ctx context.Context, path string) error
	Rename(ctx context.Context, source, target string) error
	Move(ctx context.Context, source, target string, progress ProgressFunc) error
	Copy(ctx context.Context, source, target string, progress ProgressFunc) error
	Mkdir(ctx context.Context, path string) error
	Stat(ctx context.Context, path string) (*StatInfo, error)
}

type Authorizer interface {
	Authorize(ctx context.Context, username string, op Operation) error
}
