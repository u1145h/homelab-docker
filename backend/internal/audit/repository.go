package audit

import "errors"

var ErrNotFound = errors.New("audit entry not found")

type Repository interface {
	List(filter AuditFilter) ([]Entry, error)
	GetByID(id string) (*Entry, error)
	Create(entry *Entry) error
}
