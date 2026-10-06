package history

import (
	"testing"
	"time"
)

func newTestRepo(t *testing.T) *sqliteRepository {
	t.Helper()
	repo, err := NewSQLiteRepository(":memory:")
	if err != nil {
		t.Fatalf("failed to create test repository: %v", err)
	}
	return repo
}

func sampleAt(t time.Time) *Sample {
	return &Sample{
		Timestamp: t,
		Hostname:  "testhost",
		CPU: CPUStats{
			UsagePercent: 45.5,
			LogicalCores: 4,
			FrequencyMHz: 2400.0,
		},
		Memory: MemoryStats{
			Total:        16000000000,
			Used:         8000000000,
			Available:    8000000000,
			UsagePercent: 50.0,
		},
		Storage: StorageStats{
			Total:        500000000000,
			Used:         250000000000,
			Available:    250000000000,
			UsagePercent: 50.0,
		},
		Network: NetworkStats{
			RXBytes: 1000,
			TXBytes: 500,
		},
		Battery: BatteryStats{
			Present:  true,
			Capacity: 85.5,
			Status:   "Charging",
		},
		Thermal: ThermalStats{
			TemperatureMax: 65.2,
		},
	}
}

func TestStoreAndGetLatest(t *testing.T) {
	repo := newTestRepo(t)
	defer repo.Close()

	s := sampleAt(time.Now())

	if err := repo.Store(s); err != nil {
		t.Fatalf("Store failed: %v", err)
	}

	got, err := repo.GetLatest()
	if err != nil {
		t.Fatalf("GetLatest failed: %v", err)
	}

	if got.Hostname != s.Hostname {
		t.Errorf("expected hostname %s, got %s", s.Hostname, got.Hostname)
	}
	if got.CPU.UsagePercent != s.CPU.UsagePercent {
		t.Errorf("expected cpu usage %f, got %f", s.CPU.UsagePercent, got.CPU.UsagePercent)
	}
	if got.Battery.Capacity != s.Battery.Capacity {
		t.Errorf("expected battery capacity %f, got %f", s.Battery.Capacity, got.Battery.Capacity)
	}
}

func TestRepoGetLatestNoSamples(t *testing.T) {
	repo := newTestRepo(t)
	defer repo.Close()

	_, err := repo.GetLatest()
	if err != ErrNoSamples {
		t.Errorf("expected ErrNoSamples, got %v", err)
	}
}

func TestStoreAndQuery(t *testing.T) {
	repo := newTestRepo(t)
	defer repo.Close()

	now := time.Now().UTC()
	s1 := sampleAt(now.Add(-2 * time.Minute))
	s2 := sampleAt(now.Add(-1 * time.Minute))
	s3 := sampleAt(now)

	for _, s := range []*Sample{s1, s2, s3} {
		if err := repo.Store(s); err != nil {
			t.Fatalf("Store failed: %v", err)
		}
	}

	samples, err := repo.Query(QueryFilter{
		Start:  now.Add(-3 * time.Minute),
		End:    now,
		Limit:  100,
		Offset: 0,
	})
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if len(samples) != 3 {
		t.Errorf("expected 3 samples, got %d", len(samples))
	}
}

func TestQueryLimitAndOffset(t *testing.T) {
	repo := newTestRepo(t)
	defer repo.Close()

	now := time.Now().UTC()
	for i := 0; i < 10; i++ {
		s := sampleAt(now.Add(time.Duration(i) * time.Minute))
		if err := repo.Store(s); err != nil {
			t.Fatalf("Store failed: %v", err)
		}
	}

	samples, err := repo.Query(QueryFilter{
		Start:  now.Add(-1 * time.Hour),
		End:    now.Add(1 * time.Hour),
		Limit:  3,
		Offset: 2,
	})
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if len(samples) != 3 {
		t.Errorf("expected 3 samples, got %d", len(samples))
	}
}

func TestDeleteBefore(t *testing.T) {
	repo := newTestRepo(t)
	defer repo.Close()

	now := time.Now().UTC()
	old := sampleAt(now.Add(-48 * time.Hour))
	recent := sampleAt(now)

	for _, s := range []*Sample{old, recent} {
		if err := repo.Store(s); err != nil {
			t.Fatalf("Store failed: %v", err)
		}
	}

	deleted, err := repo.DeleteBefore(now.Add(-24 * time.Hour))
	if err != nil {
		t.Fatalf("DeleteBefore failed: %v", err)
	}

	if deleted != 1 {
		t.Errorf("expected 1 deleted, got %d", deleted)
	}

	samples, err := repo.Query(QueryFilter{
		Start:  now.Add(-72 * time.Hour),
		End:    now.Add(1 * time.Hour),
		Limit:  100,
		Offset: 0,
	})
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if len(samples) != 1 {
		t.Errorf("expected 1 sample after deletion, got %d", len(samples))
	}
}

func TestStoreWithZeroValues(t *testing.T) {
	repo := newTestRepo(t)
	defer repo.Close()

	s := &Sample{
		Timestamp: time.Now().UTC(),
		Hostname:  "testhost",
	}

	if err := repo.Store(s); err != nil {
		t.Fatalf("Store failed: %v", err)
	}

	got, err := repo.GetLatest()
	if err != nil {
		t.Fatalf("GetLatest failed: %v", err)
	}

	if got.CPU.UsagePercent != 0 {
		t.Errorf("expected 0 cpu usage for zero-valued sample, got %f", got.CPU.UsagePercent)
	}
}
