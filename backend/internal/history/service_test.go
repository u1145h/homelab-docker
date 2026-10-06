package history

import (
	"context"
	"testing"
	"time"
)

type mockRepo struct {
	samples []Sample
	err     error
}

func (m *mockRepo) Store(sample *Sample) error {
	m.samples = append(m.samples, *sample)
	return m.err
}

func (m *mockRepo) Query(filter QueryFilter) ([]Sample, error) {
	var result []Sample
	for _, s := range m.samples {
		if (s.Timestamp.Equal(filter.Start) || s.Timestamp.After(filter.Start)) &&
			(s.Timestamp.Equal(filter.End) || s.Timestamp.Before(filter.End)) {
			result = append(result, s)
		}
	}
	return result, m.err
}

func (m *mockRepo) GetLatest() (*Sample, error) {
	if len(m.samples) == 0 {
		return nil, ErrNoSamples
	}
	return &m.samples[len(m.samples)-1], m.err
}

func (m *mockRepo) DeleteBefore(before time.Time) (int64, error) {
	var deleted int64
	var remaining []Sample
	for _, s := range m.samples {
		if s.Timestamp.Before(before) {
			deleted++
		} else {
			remaining = append(remaining, s)
		}
	}
	m.samples = remaining
	return deleted, m.err
}

func (m *mockRepo) Close() error { return nil }

type mockAuthorizer struct {
	err error
}

func (m *mockAuthorizer) AuthorizeHistory(_ context.Context, username string) error {
	return m.err
}

func TestGetLatestSuccess(t *testing.T) {
	repo := &mockRepo{
		samples: []Sample{
			{Timestamp: time.Now(), Hostname: "host1"},
		},
	}
	auth := &mockAuthorizer{}
	svc := NewService(repo, Config{}, auth)

	sample, err := svc.GetLatest(context.Background(), "admin")
	if err != nil {
		t.Fatalf("GetLatest failed: %v", err)
	}
	if sample.Hostname != "host1" {
		t.Errorf("expected host1, got %s", sample.Hostname)
	}
}

func TestGetLatestNoSamples(t *testing.T) {
	repo := &mockRepo{}
	auth := &mockAuthorizer{}
	svc := NewService(repo, Config{}, auth)

	_, err := svc.GetLatest(context.Background(), "admin")
	if err != ErrNoSamples {
		t.Errorf("expected ErrNoSamples, got %v", err)
	}
}

func TestGetLatestPermissionDenied(t *testing.T) {
	repo := &mockRepo{}
	auth := &mockAuthorizer{err: ErrPermissionDenied}
	svc := NewService(repo, Config{}, auth)

	_, err := svc.GetLatest(context.Background(), "unknown")
	if err != ErrPermissionDenied {
		t.Errorf("expected ErrPermissionDenied, got %v", err)
	}
}

func TestQueryRangeSuccess(t *testing.T) {
	now := time.Now()
	repo := &mockRepo{
		samples: []Sample{
			{Timestamp: now.Add(-30 * time.Minute), Hostname: "host1", CPU: CPUStats{UsagePercent: 10}},
			{Timestamp: now.Add(-20 * time.Minute), Hostname: "host1", CPU: CPUStats{UsagePercent: 20}},
			{Timestamp: now.Add(-10 * time.Minute), Hostname: "host1", CPU: CPUStats{UsagePercent: 30}},
		},
	}
	auth := &mockAuthorizer{}
	svc := NewService(repo, Config{MaxQueryLimit: 100}, auth)

	samples, err := svc.QueryRange(
		context.Background(),
		"admin",
		now.Add(-1*time.Hour),
		now,
		"",
		0,
		0,
		0,
	)
	if err != nil {
		t.Fatalf("QueryRange failed: %v", err)
	}
	if len(samples) != 3 {
		t.Errorf("expected 3 samples, got %d", len(samples))
	}
}

func TestQueryRangeInvalidTimeRange(t *testing.T) {
	repo := &mockRepo{}
	auth := &mockAuthorizer{}
	svc := NewService(repo, Config{}, auth)

	_, err := svc.QueryRange(
		context.Background(),
		"admin",
		time.Now(),
		time.Now().Add(-1*time.Hour),
		"",
		0,
		0,
		0,
	)
	if err != ErrInvalidTimeRange {
		t.Errorf("expected ErrInvalidTimeRange, got %v", err)
	}
}

func TestQueryRangeInvalidMetric(t *testing.T) {
	repo := &mockRepo{}
	auth := &mockAuthorizer{}
	svc := NewService(repo, Config{}, auth)

	_, err := svc.QueryRange(
		context.Background(),
		"admin",
		time.Now().Add(-1*time.Hour),
		time.Now(),
		"invalid",
		0,
		0,
		0,
	)
	if err != ErrInvalidMetric {
		t.Errorf("expected ErrInvalidMetric, got %v", err)
	}
}

func TestQueryRangePermissionDenied(t *testing.T) {
	repo := &mockRepo{}
	auth := &mockAuthorizer{err: ErrPermissionDenied}
	svc := NewService(repo, Config{}, auth)

	_, err := svc.QueryRange(
		context.Background(),
		"unknown",
		time.Now().Add(-1*time.Hour),
		time.Now(),
		"",
		0,
		0,
		0,
	)
	if err != ErrPermissionDenied {
		t.Errorf("expected ErrPermissionDenied, got %v", err)
	}
}

func TestQueryRangeMetricFilter(t *testing.T) {
	now := time.Now()
	repo := &mockRepo{
		samples: []Sample{
			{
				Timestamp: now,
				Hostname:  "host1",
				CPU:       CPUStats{UsagePercent: 50},
				Memory:    MemoryStats{Total: 1000, Used: 500, Available: 500, UsagePercent: 50},
			},
		},
	}
	auth := &mockAuthorizer{}
	svc := NewService(repo, Config{MaxQueryLimit: 100}, auth)

	samples, err := svc.QueryRange(
		context.Background(),
		"admin",
		now.Add(-1*time.Hour),
		now.Add(1*time.Hour),
		MetricCPU,
		0,
		0,
		0,
	)
	if err != nil {
		t.Fatalf("QueryRange failed: %v", err)
	}
	if len(samples) != 1 {
		t.Fatalf("expected 1 sample, got %d", len(samples))
	}
	if samples[0].CPU.UsagePercent != 50 {
		t.Errorf("expected cpu 50, got %f", samples[0].CPU.UsagePercent)
	}
	if samples[0].Memory.Total != 0 {
		t.Errorf("expected memory to be filtered out, got total %d", samples[0].Memory.Total)
	}
}

func TestQueryRangeWithAggregation(t *testing.T) {
	base := time.Now().Truncate(60 * time.Second)
	repo := &mockRepo{
		samples: []Sample{
			{Timestamp: base.Add(5 * time.Second), Hostname: "host1", CPU: CPUStats{UsagePercent: 10}},
			{Timestamp: base.Add(15 * time.Second), Hostname: "host1", CPU: CPUStats{UsagePercent: 20}},
			{Timestamp: base.Add(25 * time.Second), Hostname: "host1", CPU: CPUStats{UsagePercent: 30}},
		},
	}
	auth := &mockAuthorizer{}
	svc := NewService(repo, Config{MaxQueryLimit: 100}, auth)

	samples, err := svc.QueryRange(
		context.Background(),
		"admin",
		base.Add(-1*time.Minute),
		base.Add(1*time.Minute),
		"",
		60,
		0,
		0,
	)
	if err != nil {
		t.Fatalf("QueryRange failed: %v", err)
	}
	if len(samples) != 1 {
		t.Fatalf("expected 1 aggregated sample, got %d", len(samples))
	}
	if samples[0].CPU.UsagePercent != 20 {
		t.Errorf("expected avg cpu 20, got %f", samples[0].CPU.UsagePercent)
	}
}

func TestFilterMetric(t *testing.T) {
	samples := []Sample{
		{
			Timestamp: time.Now(),
			Hostname:  "host1",
			CPU:       CPUStats{UsagePercent: 50},
			Memory:    MemoryStats{Total: 1000},
		},
	}

	filtered := filterMetric(samples, MetricCPU)
	if filtered[0].CPU.UsagePercent != 50 {
		t.Errorf("expected cpu 50, got %f", filtered[0].CPU.UsagePercent)
	}
	if filtered[0].Memory.Total != 0 {
		t.Errorf("expected memory filtered out, got total %d", filtered[0].Memory.Total)
	}
}
