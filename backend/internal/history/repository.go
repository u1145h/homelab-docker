package history

import (
	"context"
	"time"
)

const defaultLimit = 100

type Repository interface {
	Store(sample *Sample) error
	Query(filter QueryFilter) ([]Sample, error)
	GetLatest() (*Sample, error)
	DeleteBefore(before time.Time) (int64, error)
	Close() error
}

type QueryFilter struct {
	Start  time.Time
	End    time.Time
	Limit  int
	Offset int
}

type Authorizer interface {
	AuthorizeHistory(ctx context.Context, username string) error
}
