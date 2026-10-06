package audit_test

import (
	"errors"
	"testing"
	"time"

	"github.com/ullashroy/poco-server/backend/internal/audit"
)

type mockRepo struct {
	entries []audit.Entry
	err     error
}

func (m *mockRepo) List(filter audit.AuditFilter) ([]audit.Entry, error) {
	if m.err != nil {
		return nil, m.err
	}
	entries := m.entries
	if filter.Action != "" {
		filtered := make([]audit.Entry, 0, len(entries))
		for i := range entries {
			if entries[i].Action == filter.Action {
				filtered = append(filtered, entries[i])
			}
		}
		entries = filtered
	}
	offset := filter.Offset
	if offset < 0 {
		offset = 0
	}
	if offset >= len(entries) {
		return []audit.Entry{}, nil
	}
	entries = entries[offset:]
	if filter.Limit > 0 && filter.Limit < len(entries) {
		entries = entries[:filter.Limit]
	}
	res := make([]audit.Entry, len(entries))
	copy(res, entries)
	return res, nil
}

func (m *mockRepo) GetByID(id string) (*audit.Entry, error) {
	if m.err != nil {
		return nil, m.err
	}
	for i := range m.entries {
		if m.entries[i].ID == id {
			e := m.entries[i]
			return &e, nil
		}
	}
	return nil, audit.ErrNotFound
}

func (m *mockRepo) Create(entry *audit.Entry) error {
	if m.err != nil {
		return m.err
	}
	m.entries = append(m.entries, *entry)
	return nil
}

func noopCheckAdmin(username string) error { return nil }
func denyCheckAdmin(username string) error { return errors.New("access denied") }

func TestLog_Success(t *testing.T) {
	repo := &mockRepo{}
	svc := audit.NewService(repo, noopCheckAdmin)

	svc.Log(audit.LogRequest{
		Action: audit.ActionUserCreate,
		Actor:  "admin",
		Status: audit.StatusSuccess,
	})

	if len(repo.entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(repo.entries))
	}

	e := repo.entries[0]
	if e.Action != audit.ActionUserCreate {
		t.Fatalf("expected action %s, got %s", audit.ActionUserCreate, e.Action)
	}
	if e.Actor != "admin" {
		t.Fatalf("expected actor admin, got %s", e.Actor)
	}
	if e.Status != audit.StatusSuccess {
		t.Fatalf("expected status success, got %s", e.Status)
	}
}

func TestLog_AssignsIDAndTimestamp(t *testing.T) {
	repo := &mockRepo{}
	svc := audit.NewService(repo, noopCheckAdmin)

	before := time.Now()
	svc.Log(audit.LogRequest{
		Action: audit.ActionUserLogin,
		Actor:  "alice",
		Status: audit.StatusSuccess,
	})
	after := time.Now()

	e := repo.entries[0]
	if e.ID == "" {
		t.Fatal("expected non-empty id")
	}
	if e.Timestamp.Before(before) || e.Timestamp.After(after) {
		t.Fatal("timestamp should be within range")
	}
}

func TestLog_WithAllFields(t *testing.T) {
	repo := &mockRepo{}
	svc := audit.NewService(repo, noopCheckAdmin)

	svc.Log(audit.LogRequest{
		Action:   audit.ActionUserUpdate,
		Actor:    "admin",
		Target:   "bob",
		Status:   audit.StatusFailure,
		Message:  "invalid role",
		Metadata: map[string]any{"attempted_role": "superadmin"},
	})

	e := repo.entries[0]
	if e.Target != "bob" {
		t.Fatalf("expected target bob, got %s", e.Target)
	}
	if e.Status != audit.StatusFailure {
		t.Fatalf("expected status failure, got %s", e.Status)
	}
	if e.Message != "invalid role" {
		t.Fatalf("expected message 'invalid role', got %s", e.Message)
	}
	if e.Metadata["attempted_role"] != "superadmin" {
		t.Fatalf("expected metadata attempted_role=superadmin, got %v", e.Metadata["attempted_role"])
	}
}

func TestLog_RepositoryErrorDoesNotPanic(t *testing.T) {
	repo := &mockRepo{err: errors.New("disk full")}
	svc := audit.NewService(repo, noopCheckAdmin)

	svc.Log(audit.LogRequest{
		Action: audit.ActionUserDelete,
		Actor:  "admin",
		Status: audit.StatusSuccess,
	})
}

func TestList_AdminAuthorized(t *testing.T) {
	repo := &mockRepo{}
	svc := audit.NewService(repo, noopCheckAdmin)

	svc.Log(audit.LogRequest{Action: audit.ActionUserLogin, Actor: "alice", Status: audit.StatusSuccess})
	svc.Log(audit.LogRequest{Action: audit.ActionUserLogin, Actor: "bob", Status: audit.StatusSuccess})

	entries, err := svc.List("admin", audit.AuditFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(entries))
	}
}

func TestList_NonAdminDenied(t *testing.T) {
	repo := &mockRepo{}
	svc := audit.NewService(repo, denyCheckAdmin)

	_, err := svc.List("user", audit.AuditFilter{})
	if err == nil {
		t.Fatal("expected error for non-admin")
	}
}

func TestList_Pagination(t *testing.T) {
	repo := &mockRepo{}
	svc := audit.NewService(repo, noopCheckAdmin)

	for i := 0; i < 10; i++ {
		svc.Log(audit.LogRequest{
			Action: audit.ActionUserLogin,
			Actor:  "alice",
			Status: audit.StatusSuccess,
		})
	}

	entries, err := svc.List("admin", audit.AuditFilter{Offset: 2, Limit: 3})
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 3 {
		t.Fatalf("expected 3 entries, got %d", len(entries))
	}
}

func TestList_ActionFilter(t *testing.T) {
	repo := &mockRepo{}
	svc := audit.NewService(repo, noopCheckAdmin)

	svc.Log(audit.LogRequest{Action: audit.ActionUserCreate, Actor: "admin", Status: audit.StatusSuccess})
	svc.Log(audit.LogRequest{Action: audit.ActionUserLogin, Actor: "alice", Status: audit.StatusSuccess})
	svc.Log(audit.LogRequest{Action: audit.ActionUserUpdate, Actor: "admin", Status: audit.StatusSuccess})

	entries, err := svc.List("admin", audit.AuditFilter{Action: audit.ActionUserLogin})
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(entries))
	}
	if entries[0].Action != audit.ActionUserLogin {
		t.Fatalf("expected action %s, got %s", audit.ActionUserLogin, entries[0].Action)
	}
}

func TestList_Empty(t *testing.T) {
	repo := &mockRepo{}
	svc := audit.NewService(repo, noopCheckAdmin)

	entries, err := svc.List("admin", audit.AuditFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 0 {
		t.Fatalf("expected 0 entries, got %d", len(entries))
	}
}

func TestGetByID_AdminAuthorized(t *testing.T) {
	repo := &mockRepo{}
	svc := audit.NewService(repo, noopCheckAdmin)

	svc.Log(audit.LogRequest{Action: audit.ActionUserLogin, Actor: "alice", Status: audit.StatusSuccess})
	id := repo.entries[0].ID

	entry, err := svc.GetByID("admin", id)
	if err != nil {
		t.Fatal(err)
	}
	if entry.ID != id {
		t.Fatalf("expected id %s, got %s", id, entry.ID)
	}
}

func TestGetByID_NonAdminDenied(t *testing.T) {
	repo := &mockRepo{}
	svc := audit.NewService(repo, denyCheckAdmin)

	_, err := svc.GetByID("user", "any")
	if err == nil {
		t.Fatal("expected error for non-admin")
	}
}

func TestGetByID_NotFound(t *testing.T) {
	repo := &mockRepo{}
	svc := audit.NewService(repo, noopCheckAdmin)

	_, err := svc.GetByID("admin", "nonexistent")
	if !errors.Is(err, audit.ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}
