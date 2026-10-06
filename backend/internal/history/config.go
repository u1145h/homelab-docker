package history

import "time"

type Config struct {
	DBPath            string
	SamplingInterval  time.Duration
	RetentionPeriod   time.Duration
	CleanupInterval   time.Duration
	MaxQueryLimit     int
	DefaultResolution int
}
