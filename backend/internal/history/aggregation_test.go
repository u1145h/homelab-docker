package history

import (
	"testing"
	"time"
)

func TestAggregateEmpty(t *testing.T) {
	result := Aggregate(nil, 60)
	if result != nil {
		t.Errorf("expected nil for nil input, got %d samples", len(result))
	}
}

func TestAggregateSingleBucket(t *testing.T) {
	base := time.Now().Truncate(time.Minute).UTC()

	samples := []Sample{
		{
			Timestamp: base,
			Hostname:  "host1",
			CPU:       CPUStats{UsagePercent: 10, LogicalCores: 2, FrequencyMHz: 2000},
			Memory:    MemoryStats{Total: 1000, Used: 500, Available: 500, UsagePercent: 50},
			Network:   NetworkStats{RXBytes: 100, TXBytes: 50},
			Thermal:   ThermalStats{TemperatureMax: 60},
		},
		{
			Timestamp: base.Add(15 * time.Second),
			Hostname:  "host1",
			CPU:       CPUStats{UsagePercent: 20, LogicalCores: 2, FrequencyMHz: 2000},
			Memory:    MemoryStats{Total: 1000, Used: 600, Available: 400, UsagePercent: 60},
			Network:   NetworkStats{RXBytes: 200, TXBytes: 100},
			Thermal:   ThermalStats{TemperatureMax: 70},
		},
	}

	result := Aggregate(samples, 60)

	if len(result) != 1 {
		t.Fatalf("expected 1 bucket, got %d", len(result))
	}

	r := result[0]

	if r.CPU.UsagePercent != 15 {
		t.Errorf("expected avg cpu 15, got %f", r.CPU.UsagePercent)
	}
	if r.Memory.UsagePercent != 55 {
		t.Errorf("expected avg memory usage 55, got %f", r.Memory.UsagePercent)
	}
	if r.Network.RXBytes != 200 {
		t.Errorf("expected last rx 200, got %d", r.Network.RXBytes)
	}
	if r.Network.TXBytes != 100 {
		t.Errorf("expected last tx 100, got %d", r.Network.TXBytes)
	}
	if r.Thermal.TemperatureMax != 70 {
		t.Errorf("expected max temp 70, got %f", r.Thermal.TemperatureMax)
	}
}

func TestAggregateMultipleBuckets(t *testing.T) {
	base := time.Now().Truncate(60 * time.Second).Add(-120 * time.Second).UTC()

	samples := []Sample{
		{Timestamp: base, Hostname: "host1", CPU: CPUStats{UsagePercent: 10}},
		{Timestamp: base.Add(30 * time.Second), Hostname: "host1", CPU: CPUStats{UsagePercent: 20}},
		{Timestamp: base.Add(90 * time.Second), Hostname: "host1", CPU: CPUStats{UsagePercent: 30}},
		{Timestamp: base.Add(120 * time.Second), Hostname: "host1", CPU: CPUStats{UsagePercent: 40}},
	}

	result := Aggregate(samples, 60)

	if len(result) != 3 {
		t.Fatalf("expected 3 buckets, got %d", len(result))
	}
}
