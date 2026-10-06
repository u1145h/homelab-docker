package activities

import (
	"os"
	"path/filepath"
	"testing"
)

func TestActivitiesInMemory(t *testing.T) {
	s := New(10)
	s.Publish("info", "Test event 1", "info-icon", "#00ff00")
	s.Publish("warn", "Test event 2", "warn-icon", "#ff0000")

	events, total := s.Query(0, 10)
	if total != 2 {
		t.Fatalf("expected total=2, got %d", total)
	}
	if len(events) != 2 {
		t.Fatalf("expected 2 events, got %d", len(events))
	}
	if events[0].Text != "Test event 2" {
		t.Errorf("expected newest event first ('Test event 2'), got '%s'", events[0].Text)
	}
}

func TestActivitiesJSONPersistence(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "homelab_act_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	jsonPath := filepath.Join(tmpDir, "activities.json")

	// Store 1: publish events and save to file
	s1 := New(0, jsonPath)
	s1.Publish("system", "System booted", "server", "#3b82f6")
	s1.Publish("docker", "Container started", "docker", "#10b981")

	events1, total1 := s1.Query(0, 10)
	if total1 != 2 || len(events1) != 2 {
		t.Fatalf("s1 expected 2 events, got total=%d, len=%d", total1, len(events1))
	}

	// Verify file exists
	if _, err := os.Stat(jsonPath); os.IsNotExist(err) {
		t.Fatalf("expected JSON file to exist at %s", jsonPath)
	}

	// Store 2: reinstantiate from existing file (simulating server restart)
	s2 := New(0, jsonPath)
	events2, total2 := s2.Query(0, 10)
	if total2 != 2 || len(events2) != 2 {
		t.Fatalf("s2 expected 2 reloaded events, got total=%d, len=%d", total2, len(events2))
	}

	if events2[0].Text != "Container started" || events2[1].Text != "System booted" {
		t.Errorf("unexpected event texts in s2: %v, %v", events2[0].Text, events2[1].Text)
	}

	// Publish new event in s2 and verify ID increments cleanly
	s2.Publish("wifi", "Connected to Wi-Fi", "wifi", "#a855f7")
	events3, total3 := s2.Query(0, 10)
	if total3 != 3 {
		t.Fatalf("expected total=3 after s2 publish, got %d", total3)
	}
	if events3[0].ID != 3 {
		t.Errorf("expected new event ID to be 3, got %d", events3[0].ID)
	}
}
