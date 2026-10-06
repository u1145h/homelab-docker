package history

import (
	"context"
	"fmt"
	"time"
)

type Service struct {
	repo       Repository
	config     Config
	authorizer Authorizer
}

func NewService(repo Repository, config Config, authorizer Authorizer) *Service {
	return &Service{
		repo:       repo,
		config:     config,
		authorizer: authorizer,
	}
}

func (s *Service) GetLatest(ctx context.Context, actor string) (*Sample, error) {
	if err := s.authorizer.AuthorizeHistory(ctx, actor); err != nil {
		return nil, err
	}

	sample, err := s.repo.GetLatest()
	if err != nil {
		return nil, err
	}

	return sample, nil
}

func (s *Service) QueryRange(ctx context.Context, actor string, start, end time.Time, metric MetricType, resolution, limit, offset int) ([]Sample, error) {
	if err := s.authorizer.AuthorizeHistory(ctx, actor); err != nil {
		return nil, err
	}

	if !end.After(start) {
		return nil, ErrInvalidTimeRange
	}

	if metric != "" && !ValidMetrics[metric] {
		return nil, ErrInvalidMetric
	}

	if resolution > 0 && !ValidResolutions[resolution] {
		return nil, ErrInvalidResolution
	}

	if limit < 0 {
		return nil, ErrInvalidLimit
	}
	if offset < 0 {
		return nil, ErrInvalidOffset
	}

	maxLimit := s.config.MaxQueryLimit
	if maxLimit <= 0 {
		maxLimit = 10000
	}
	if limit == 0 || limit > maxLimit {
		limit = maxLimit
	}

	filter := QueryFilter{
		Start:  start,
		End:    end,
		Limit:  limit,
		Offset: offset,
	}

	raw, err := s.repo.Query(filter)
	if err != nil {
		return nil, fmt.Errorf("history query failed: %w", err)
	}

	if len(raw) == 0 {
		return []Sample{}, nil
	}

	var samples []Sample

	if resolution > 0 {
		samples = Aggregate(raw, resolution)
	} else {
		samples = raw
	}

	if metric != "" {
		samples = filterMetric(samples, metric)
	}

	return samples, nil
}

func filterMetric(samples []Sample, metric MetricType) []Sample {
	result := make([]Sample, len(samples))
	for i, s := range samples {
		filtered := Sample{
			Timestamp: s.Timestamp,
			Hostname:  s.Hostname,
		}
		switch metric {
		case MetricCPU:
			filtered.CPU = s.CPU
		case MetricMemory:
			filtered.Memory = s.Memory
		case MetricStorage:
			filtered.Storage = s.Storage
		case MetricNetwork:
			filtered.Network = s.Network
		case MetricBattery:
			filtered.Battery = s.Battery
		case MetricThermal:
			filtered.Thermal = s.Thermal
		}
		result[i] = filtered
	}
	return result
}

func (s *Service) Close() error {
	return s.repo.Close()
}
