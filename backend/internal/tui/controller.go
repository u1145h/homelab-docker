package tui

import (
	"github.com/ullashroy/poco-server/backend/internal/jobs"
	"github.com/ullashroy/poco-server/backend/internal/notifications"
)

type Controllers struct {
	JobsStore         *jobs.Store
	NotificationStore *notifications.Store
}
