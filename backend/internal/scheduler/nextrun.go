package scheduler

import "time"

func CalculateNextRun(t TaskDefinition, now time.Time) *time.Time {
	return calculateNextRun(t, now)
}
