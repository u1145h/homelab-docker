package history

import "errors"

var (
	ErrNoSamples         = errors.New("no historical samples available")
	ErrInvalidTimeRange  = errors.New("invalid time range: end must be after start")
	ErrInvalidMetric     = errors.New("invalid metric type")
	ErrInvalidResolution = errors.New("invalid resolution: must be one of 30, 60, 300, 900, 1800, 3600, 21600, 43200, 86400")
	ErrInvalidLimit      = errors.New("invalid limit")
	ErrInvalidOffset     = errors.New("invalid offset")
	ErrPermissionDenied  = errors.New("permission denied")
)
