package notifications

import (
	"os"
	"testing"

	"github.com/ullashroy/poco-server/backend/internal/activities"
	"github.com/ullashroy/poco-server/backend/internal/battery"
	"github.com/ullashroy/poco-server/backend/internal/preferences"
	"github.com/ullashroy/poco-server/backend/internal/state"
)

func TestBatteryNotifications(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "homelab_notif_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	notifStore := NewStore(tmpDir, 500)
	prefsStore := preferences.NewStore(tmpDir)
	_ = prefsStore.Save("admin", preferences.UserPreferences{
		BatteryLow:    20,
		QuietHours:    false,
		MinSeverity:   "info",
		NotifyBattery: true,
	})
	engine := NewEngine(notifStore, prefsStore)
	actStore := activities.New(50)
	st := state.New(actStore)

	// Initial State: Battery discharging at 50%
	st.SetBattery(battery.Info{
		Present:        true,
		Status:         "Discharging",
		Capacity:       50,
		PowerSource:    "Battery",
		RuntimeLeftMin: 180,
	})
	engine.Evaluate(st)

	// Verify no transition notification on first evaluation
	list, _, _ := notifStore.List(Filter{Category: CatBattery})
	if len(list) != 0 {
		t.Fatalf("expected 0 notifications on first evaluation, got %d", len(list))
	}

	// 1. Test Charger Connected (Plugged in)
	st.SetBattery(battery.Info{
		Present:       true,
		Status:        "Charging",
		Capacity:      51,
		PowerSource:   "AC adapter connected",
		TimeToFullMin: 45,
	})
	engine.Evaluate(st)

	list, _, _ = notifStore.List(Filter{Category: CatBattery})
	if len(list) != 1 {
		t.Fatalf("expected 1 notification after connecting charger, got %d", len(list))
	}
	if list[0].Title != "Charger Connected" || list[0].Severity != SevSuccess {
		t.Errorf("expected 'Charger Connected' SevSuccess, got '%s' %s", list[0].Title, list[0].Severity)
	}

	// 2. Test Battery Fully Charged
	st.SetBattery(battery.Info{
		Present:     true,
		Status:      "Full",
		Capacity:    100,
		PowerSource: "AC adapter connected",
	})
	engine.Evaluate(st)

	list, _, _ = notifStore.List(Filter{Category: CatBattery})
	if len(list) != 2 {
		t.Fatalf("expected 2 notifications after full charge, got %d", len(list))
	}
	if list[0].Title != "Battery Fully Charged" || list[0].Severity != SevSuccess {
		t.Errorf("expected 'Battery Fully Charged', got '%s'", list[0].Title)
	}

	// 3. Test Charger Disconnected (Unplugged)
	st.SetBattery(battery.Info{
		Present:        true,
		Status:         "Discharging",
		Capacity:       99,
		PowerSource:    "Battery",
		RuntimeLeftMin: 360,
	})
	engine.Evaluate(st)

	list, _, _ = notifStore.List(Filter{Category: CatBattery})
	if len(list) != 3 {
		t.Fatalf("expected 3 notifications after unplugging, got %d", len(list))
	}
	if list[0].Title != "Charger Disconnected" || list[0].Severity != SevWarning {
		t.Errorf("expected 'Charger Disconnected' SevWarning, got '%s' %s", list[0].Title, list[0].Severity)
	}

	// 4. Test Low Battery Warning (18% <= 20%)
	st.SetBattery(battery.Info{
		Present:        true,
		Status:         "Discharging",
		Capacity:       18,
		PowerSource:    "Battery",
		RuntimeLeftMin: 40,
	})
	engine.Evaluate(st)

	list, _, _ = notifStore.List(Filter{Category: CatBattery})
	if len(list) != 4 {
		t.Fatalf("expected 4 notifications after low battery, got %d", len(list))
	}
	if list[0].Title != "Low Battery Warning" || list[0].Severity != SevWarning {
		t.Errorf("expected 'Low Battery Warning' SevWarning, got '%s' %s", list[0].Title, list[0].Severity)
	}

	// 5. Test Critical Battery Alert (8% <= 10%)
	st.SetBattery(battery.Info{
		Present:        true,
		Status:         "Discharging",
		Capacity:       8,
		PowerSource:    "Battery",
		RuntimeLeftMin: 15,
	})
	engine.Evaluate(st)

	list, _, _ = notifStore.List(Filter{Category: CatBattery})
	if len(list) != 5 {
		t.Fatalf("expected 5 notifications after critical battery, got %d", len(list))
	}
	if list[0].Title != "Critical Battery Alert" || list[0].Severity != SevCritical {
		t.Errorf("expected 'Critical Battery Alert' SevCritical, got '%s' %s", list[0].Title, list[0].Severity)
	}

	// 6. Test Battery Overheating Alert
	st.SetBattery(battery.Info{
		Present:      true,
		Status:       "Charging",
		Capacity:     50,
		PowerSource:  "AC adapter connected",
		TemperatureC: 48.5,
	})
	engine.Evaluate(st)

	list, _, _ = notifStore.List(Filter{Category: CatBattery})
	foundOverheat := false
	for _, n := range list {
		if n.Title == "Battery Overheating" && n.Severity == SevCritical {
			foundOverheat = true
			break
		}
	}
	if !foundOverheat {
		t.Errorf("expected to find 'Battery Overheating' notification in store")
	}
}

func TestStoreOperations(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "homelab_store_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	store := NewStore(tmpDir, 500)

	// Test Add
	n1 := store.Add(SevInfo, CatBattery, "Test Info", "Info message", "/monitoring")
	n2 := store.Add(SevWarning, CatBattery, "Test Warn", "Warn message", "/monitoring")

	if n1.ID == "" || n2.ID == "" {
		t.Fatalf("expected valid notification IDs")
	}

	// Test Summary
	summary := store.GetSummary(10)
	if summary.UnreadCount != 2 || summary.TotalCount != 2 {
		t.Errorf("expected unread=2, total=2, got unread=%d, total=%d", summary.UnreadCount, summary.TotalCount)
	}

	// Test Mark Read
	ok := store.MarkRead(n1.ID)
	if !ok {
		t.Errorf("expected MarkRead to succeed")
	}

	summary = store.GetSummary(10)
	if summary.UnreadCount != 1 {
		t.Errorf("expected unread=1 after reading one, got %d", summary.UnreadCount)
	}

	// Test Mark All Read
	count := store.MarkAllRead()
	if count != 1 {
		t.Errorf("expected 1 notification marked read, got %d", count)
	}

	summary = store.GetSummary(10)
	if summary.UnreadCount != 0 {
		t.Errorf("expected unread=0 after MarkAllRead, got %d", summary.UnreadCount)
	}
}
