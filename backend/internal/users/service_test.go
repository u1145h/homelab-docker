package users_test

import (
	"errors"
	"testing"

	"github.com/ullashroy/poco-server/backend/internal/audit"
	"github.com/ullashroy/poco-server/backend/internal/auth"
	"github.com/ullashroy/poco-server/backend/internal/users"
)

type noopAuditRepo struct{}

func (n *noopAuditRepo) List(filter audit.AuditFilter) ([]audit.Entry, error) {
	return nil, nil
}
func (n *noopAuditRepo) GetByID(id string) (*audit.Entry, error) {
	return nil, audit.ErrNotFound
}
func (n *noopAuditRepo) Create(entry *audit.Entry) error { return nil }

func newAuditSvc() *audit.Service {
	return audit.NewService(&noopAuditRepo{}, func(s string) error { return nil })
}

type mockRepo struct {
	users map[string]*users.User
}

func newMockRepo() *mockRepo {
	return &mockRepo{users: make(map[string]*users.User)}
}

func (m *mockRepo) GetByUsername(username string) (*users.User, error) {
	for _, u := range m.users {
		if u.Username == username {
			cp := *u
			return &cp, nil
		}
	}
	return nil, users.ErrUserNotFound
}

func (m *mockRepo) GetByID(id string) (*users.User, error) {
	u, ok := m.users[id]
	if !ok {
		return nil, users.ErrUserNotFound
	}
	cp := *u
	return &cp, nil
}

func (m *mockRepo) List() ([]users.User, error) {
	res := make([]users.User, 0, len(m.users))
	for _, u := range m.users {
		res = append(res, *u)
	}
	return res, nil
}

func (m *mockRepo) Create(user *users.User) error {
	if _, ok := m.users[user.ID]; ok {
		return users.ErrDuplicateUsername
	}
	for _, u := range m.users {
		if u.Username == user.Username {
			return users.ErrDuplicateUsername
		}
	}
	cp := *user
	m.users[user.ID] = &cp
	return nil
}

func (m *mockRepo) Update(user *users.User) error {
	if _, ok := m.users[user.ID]; !ok {
		return users.ErrUserNotFound
	}
	cp := *user
	m.users[user.ID] = &cp
	return nil
}

func (m *mockRepo) Delete(id string) error {
	if _, ok := m.users[id]; !ok {
		return users.ErrUserNotFound
	}
	delete(m.users, id)
	return nil
}

func seedAdmin() (*users.Service, *mockRepo, error) {
	repo := newMockRepo()
	svc := users.NewService(repo, newAuditSvc())

	hash, err := auth.HashPassword("admin123")
	if err != nil {
		return nil, nil, err
	}

	if err := svc.BootstrapAdmin("admin", hash); err != nil {
		return nil, nil, err
	}

	return svc, repo, nil
}

func TestBootstrapAdmin_SeedsOnEmpty(t *testing.T) {
	repo := newMockRepo()
	svc := users.NewService(repo, newAuditSvc())

	hash, _ := auth.HashPassword("admin123")
	if err := svc.BootstrapAdmin("admin", hash); err != nil {
		t.Fatal(err)
	}

	list, _ := svc.List("admin")
	if len(list) != 1 || list[0].Username != "admin" {
		t.Fatalf("expected 1 admin user, got %+v", list)
	}
}

func TestBootstrapAdmin_SkipsIfNotEmpty(t *testing.T) {
	svc, _, _ := seedAdmin()

	hash, _ := auth.HashPassword("admin123")
	if err := svc.BootstrapAdmin("admin2", hash); err != nil {
		t.Fatal(err)
	}

	list, _ := svc.List("admin")
	if len(list) != 1 {
		t.Fatalf("expected 1 user (no reseed), got %d", len(list))
	}
}

func TestAuthenticate_Valid(t *testing.T) {
	svc, _, _ := seedAdmin()
	if err := svc.Authenticate("admin", "admin123"); err != nil {
		t.Fatal("expected valid auth, got:", err)
	}
}

func TestAuthenticate_InvalidPassword(t *testing.T) {
	svc, _, _ := seedAdmin()
	if err := svc.Authenticate("admin", "wrong"); !errors.Is(err, users.ErrInvalidCredentials) {
		t.Fatal("expected ErrInvalidCredentials, got:", err)
	}
}

func TestAuthenticate_UnknownUser(t *testing.T) {
	svc, _, _ := seedAdmin()
	if err := svc.Authenticate("nobody", "pass"); !errors.Is(err, users.ErrInvalidCredentials) {
		t.Fatal("expected ErrInvalidCredentials, got:", err)
	}
}

func TestGetByUsername(t *testing.T) {
	svc, _, _ := seedAdmin()
	u, err := svc.GetByUsername("admin")
	if err != nil {
		t.Fatal(err)
	}
	if u.Username != "admin" {
		t.Fatalf("expected admin, got %s", u.Username)
	}
}

func TestGetByUsername_NotFound(t *testing.T) {
	svc, _, _ := seedAdmin()
	_, err := svc.GetByUsername("nobody")
	if !errors.Is(err, users.ErrUserNotFound) {
		t.Fatal("expected ErrUserNotFound, got:", err)
	}
}

func TestGetByID(t *testing.T) {
	svc, repo, _ := seedAdmin()
	list, _ := svc.List("admin")
	id := list[0].ID

	u, err := svc.GetByID(id)
	if err != nil {
		t.Fatal(err)
	}
	if u.ID != id {
		t.Fatalf("expected id %s, got %s", id, u.ID)
	}

	_ = repo
}

func TestCreateUser_AdminSuccess(t *testing.T) {
	svc, _, _ := seedAdmin()

	u, err := svc.CreateUser("admin", "bob", "password123", "user")
	if err != nil {
		t.Fatal(err)
	}
	if u.Username != "bob" {
		t.Fatalf("expected bob, got %s", u.Username)
	}
}

func TestCreateUser_NotAdmin(t *testing.T) {
	svc, repo, _ := seedAdmin()

	hash, _ := auth.HashPassword("userpass")
	_ = repo.Create(&users.User{
		ID: "u2", Username: "user1", PasswordHash: hash, Role: users.RoleUser,
	})

	_, err := svc.CreateUser("user1", "bob", "password123", "user")
	if !errors.Is(err, users.ErrNotAdmin) {
		t.Fatal("expected ErrNotAdmin, got:", err)
	}
}

func TestCreateUser_Duplicate(t *testing.T) {
	svc, _, _ := seedAdmin()

	_, err := svc.CreateUser("admin", "admin", "password123", "user")
	if !errors.Is(err, users.ErrDuplicateUsername) {
		t.Fatal("expected ErrDuplicateUsername, got:", err)
	}
}

func TestCreateUser_Validation(t *testing.T) {
	svc, _, _ := seedAdmin()

	tests := []struct {
		name     string
		username string
		password string
		role     string
		want     error
	}{
		{"empty username", "", "password123", "user", users.ErrEmptyUsername},
		{"empty password", "bob", "", "user", users.ErrEmptyPassword},
		{"short password", "bob", "short", "user", users.ErrPasswordTooShort},
		{"invalid role", "bob", "password123", "superadmin", users.ErrInvalidRole},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := svc.CreateUser("admin", tt.username, tt.password, tt.role)
			if !errors.Is(err, tt.want) {
				t.Fatalf("expected %v, got %v", tt.want, err)
			}
		})
	}

	t.Run("empty first name for user role", func(t *testing.T) {
		_, err := svc.CreateUserWithParams("admin", users.CreateUserParams{
			Username:  "alice",
			FirstName: "",
			LastName:  "Smith",
			Password:  "password123",
			Role:      "user",
		})
		if !errors.Is(err, users.ErrEmptyFirstName) {
			t.Fatalf("expected ErrEmptyFirstName, got %v", err)
		}
	})

	t.Run("empty last name for user role", func(t *testing.T) {
		_, err := svc.CreateUserWithParams("admin", users.CreateUserParams{
			Username:  "alice",
			FirstName: "Alice",
			LastName:  "",
			Password:  "password123",
			Role:      "user",
		})
		if !errors.Is(err, users.ErrEmptyLastName) {
			t.Fatalf("expected ErrEmptyLastName, got %v", err)
		}
	})

	t.Run("client role creates without first/last name", func(t *testing.T) {
		clientUser, err := svc.CreateUserWithParams("admin", users.CreateUserParams{
			Username:  "ghostnode",
			FirstName: "ShouldBeCleared",
			LastName:  "ShouldBeCleared",
			Password:  "password123",
			Role:      "client",
		})
		if err != nil {
			t.Fatalf("unexpected error creating client: %v", err)
		}
		if clientUser.FirstName != "" || clientUser.LastName != "" {
			t.Fatalf("expected empty first/last name for client, got '%s' '%s'", clientUser.FirstName, clientUser.LastName)
		}
	})
}

func TestUpdate(t *testing.T) {
	svc, _, _ := seedAdmin()

	list, _ := svc.List("admin")
	id := list[0].ID

	u, err := svc.Update("admin", id, "superadmin", "")
	if err != nil {
		t.Fatal(err)
	}
	if u.Username != "superadmin" {
		t.Fatalf("expected superadmin, got %s", u.Username)
	}
}

func TestUpdate_NotAdmin(t *testing.T) {
	svc, repo, _ := seedAdmin()

	hash, _ := auth.HashPassword("userpass")
	_ = repo.Create(&users.User{
		ID: "u2", Username: "user1", PasswordHash: hash, Role: users.RoleUser,
	})

	_, err := svc.Update("user1", "u2", "newname", "")
	if !errors.Is(err, users.ErrNotAdmin) {
		t.Fatal("expected ErrNotAdmin, got:", err)
	}
}

func TestUpdate_NotFound(t *testing.T) {
	svc, _, _ := seedAdmin()
	_, err := svc.Update("admin", "nonexistent", "newname", "")
	if !errors.Is(err, users.ErrUserNotFound) {
		t.Fatal("expected ErrUserNotFound, got:", err)
	}
}

func TestUpdate_NoFieldsToUpdate(t *testing.T) {
	svc, _, _ := seedAdmin()
	list, _ := svc.List("admin")
	_, err := svc.Update("admin", list[0].ID, "", "")
	if !errors.Is(err, users.ErrNoFieldsToUpdate) {
		t.Fatalf("expected ErrNoFieldsToUpdate, got: %v", err)
	}
}

func TestUpdate_CannotRemoveOwnAdminRole(t *testing.T) {
	svc, _, _ := seedAdmin()
	list, _ := svc.List("admin")
	_, err := svc.Update("admin", list[0].ID, "", "user")
	if !errors.Is(err, users.ErrCannotRemoveOwnAdminRole) {
		t.Fatalf("expected ErrCannotRemoveOwnAdminRole, got: %v", err)
	}
}

func TestDelete(t *testing.T) {
	svc, repo, _ := seedAdmin()

	hash, _ := auth.HashPassword("userpass")
	_ = repo.Create(&users.User{
		ID: "u2", Username: "user1", PasswordHash: hash, Role: users.RoleUser,
	})

	if err := svc.Delete("admin", "u2"); err != nil {
		t.Fatal(err)
	}

	_, err := svc.GetByID("u2")
	if !errors.Is(err, users.ErrUserNotFound) {
		t.Fatal("expected deleted user to be not found")
	}
}

func TestDelete_CannotDeleteAdmin(t *testing.T) {
	svc, _, _ := seedAdmin()
	list, _ := svc.List("admin")

	err := svc.Delete("admin", list[0].ID)
	if !errors.Is(err, users.ErrCannotDeleteAdmin) && !errors.Is(err, users.ErrCannotDeleteSelf) {
		t.Fatal("expected ErrCannotDeleteAdmin or ErrCannotDeleteSelf, got:", err)
	}
}

// ErrCannotDeleteLastAdmin is currently unreachable.
//
// Delete() first prevents self-deletion.
// Since only admins may delete users, once there is only one admin
// remaining there is no second admin capable of triggering the
// "last admin" code path.
//
// The guard remains in production code for future authorization
// models (super-admin, system actions, batch operations, etc.).

func TestDelete_NotAdmin(t *testing.T) {
	svc, repo, _ := seedAdmin()

	hash, _ := auth.HashPassword("userpass")
	_ = repo.Create(&users.User{
		ID: "u2", Username: "user1", PasswordHash: hash, Role: users.RoleUser,
	})

	// Create a readonly user
	_ = repo.Create(&users.User{
		ID: "u3", Username: "readonly1", PasswordHash: hash, Role: users.RoleReadonly,
	})

	err := svc.Delete("readonly1", "u2")
	if !errors.Is(err, users.ErrNotAdmin) {
		t.Fatal("expected ErrNotAdmin, got:", err)
	}
}

func TestChangePassword_Self(t *testing.T) {
	svc, _, _ := seedAdmin()

	list, _ := svc.List("admin")
	id := list[0].ID

	if err := svc.ChangePassword("admin", id, "newpass123"); err != nil {
		t.Fatal(err)
	}

	if err := svc.Authenticate("admin", "newpass123"); err != nil {
		t.Fatal("password change failed:", err)
	}
}

func TestChangePassword_AdminChangesOther(t *testing.T) {
	svc, repo, _ := seedAdmin()

	hash, _ := auth.HashPassword("userpass")
	_ = repo.Create(&users.User{
		ID: "u2", Username: "user1", PasswordHash: hash, Role: users.RoleUser,
	})

	if err := svc.ChangePassword("admin", "u2", "newerpass123"); err != nil {
		t.Fatal(err)
	}

	if err := svc.Authenticate("user1", "newerpass123"); err != nil {
		t.Fatal("password change failed:", err)
	}
}

func TestChangePassword_NonAdminCannotChangeOther(t *testing.T) {
	svc, repo, _ := seedAdmin()

	hash, _ := auth.HashPassword("userpass")
	_ = repo.Create(&users.User{
		ID: "u2", Username: "user1", PasswordHash: hash, Role: users.RoleUser,
	})
	_ = repo.Create(&users.User{
		ID: "u3", Username: "readonly1", PasswordHash: hash, Role: users.RoleReadonly,
	})

	err := svc.ChangePassword("readonly1", "u2", "newpass123")
	if !errors.Is(err, users.ErrNotAdmin) {
		t.Fatal("expected ErrNotAdmin, got:", err)
	}
}

func TestChangePassword_Validation(t *testing.T) {
	svc, _, _ := seedAdmin()
	list, _ := svc.List("admin")
	id := list[0].ID

	if err := svc.ChangePassword("admin", id, ""); !errors.Is(err, users.ErrEmptyPassword) {
		t.Fatal("expected ErrEmptyPassword, got:", err)
	}

	if err := svc.ChangePassword("admin", id, "short"); !errors.Is(err, users.ErrPasswordTooShort) {
		t.Fatal("expected ErrPasswordTooShort, got:", err)
	}
}

func TestList_AdminCanList(t *testing.T) {
	svc, repo, _ := seedAdmin()

	hash, _ := auth.HashPassword("userpass")
	_ = repo.Create(&users.User{
		ID: "u2", Username: "alice", PasswordHash: hash, Role: users.RoleUser,
	})
	_ = repo.Create(&users.User{
		ID: "u3", Username: "bob", PasswordHash: hash, Role: users.RoleReadonly,
	})

	list, err := svc.List("admin")
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 3 {
		t.Fatalf("expected 3 users, got %d", len(list))
	}
}

func TestList_NonAdminForbidden(t *testing.T) {
	svc, repo, _ := seedAdmin()

	hash, _ := auth.HashPassword("userpass")
	_ = repo.Create(&users.User{
		ID: "u2", Username: "alice", PasswordHash: hash, Role: users.RoleUser,
	})

	_, err := svc.List("alice")
	if !errors.Is(err, users.ErrNotAdmin) {
		t.Fatal("expected ErrNotAdmin, got:", err)
	}
}
