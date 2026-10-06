package notifications

import (
	"time"
)

type Severity string

const (
	SevCritical Severity = "critical"
	SevWarning  Severity = "warning"
	SevInfo     Severity = "info"
	SevSuccess  Severity = "success"
)

type Category string

const (
	CatCPU       Category = "cpu"
	CatMemory    Category = "memory"
	CatStorage   Category = "storage"
	CatThermal   Category = "thermal"
	CatBattery   Category = "battery"
	CatDocker    Category = "docker"
	CatNetwork   Category = "network"
	CatTailscale Category = "tailscale"
	CatAuth      Category = "auth"
	CatSystem    Category = "system"
	CatTask      Category = "task"
)

type Notification struct {
	ID        string    `json:"id"`
	Timestamp time.Time `json:"timestamp"`
	Severity  Severity  `json:"severity"`
	Category  Category  `json:"category"`
	Title     string    `json:"title"`
	Message   string    `json:"message"`
	Read      bool      `json:"read"`
	ActionURL string    `json:"action_url,omitempty"`
}

type Filter struct {
	StartDate  *time.Time `json:"start_date,omitempty"`
	EndDate    *time.Time `json:"end_date,omitempty"`
	Severity   Severity   `json:"severity,omitempty"`
	Category   Category   `json:"category,omitempty"`
	UnreadOnly bool       `json:"unread_only,omitempty"`
	Search     string     `json:"search,omitempty"`
	Limit      int        `json:"limit,omitempty"`
	Offset     int        `json:"offset,omitempty"`
}

type Summary struct {
	UnreadCount int            `json:"unread_count"`
	TotalCount  int            `json:"total_count"`
	Recent      []Notification `json:"recent"`
}
