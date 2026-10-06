package users

import (
	"crypto/rand"
	"fmt"
	"strings"
	"time"

	"github.com/ullashroy/poco-server/backend/internal/audit"
	"github.com/ullashroy/poco-server/backend/internal/auth"
)

type Service struct {
	repo  Repository
	audit *audit.Service
}

func NewService(repo Repository, audit *audit.Service) *Service {
	return &Service{
		repo:  repo,
		audit: audit,
	}
}

func (s *Service) Authenticate(username, password string) error {
	user, err := s.repo.GetByUsername(username)
	if err != nil {
		s.auditLog(audit.LogRequest{
			Action:  audit.ActionUserLogin,
			Actor:   username,
			Status:  audit.StatusFailure,
			Message: "user not found",
		})
		return ErrInvalidCredentials
	}

	if err := auth.CheckPassword(user.PasswordHash, password); err != nil {
		s.auditLog(audit.LogRequest{
			Action:  audit.ActionUserLogin,
			Actor:   username,
			Status:  audit.StatusFailure,
			Message: "invalid password",
		})
		return ErrInvalidCredentials
	}

	now := time.Now()
	user.LastLoginAt = &now
	_ = s.repo.Update(user)

	s.auditLog(audit.LogRequest{
		Action: audit.ActionUserLogin,
		Actor:  username,
		Status: audit.StatusSuccess,
	})
	return nil
}

func (s *Service) BootstrapAdmin(username, passwordHash string) error {
	users, err := s.repo.List()
	if err != nil {
		return err
	}

	if len(users) > 0 {
		return nil
	}

	id, err := generateID()
	if err != nil {
		return fmt.Errorf("failed to generate user id: %w", err)
	}

	user := &User{
		ID:           id,
		Username:     username,
		PasswordHash: passwordHash,
		Role:         RoleAdmin,
		TokenVersion: 1,
	}

	return s.repo.Create(user)
}

func (s *Service) BootstrapClient(username, plainPassword string) error {
	existing, _ := s.repo.GetByUsername(username)
	if existing != nil {
		return nil
	}

	hash, err := auth.HashPassword(plainPassword)
	if err != nil {
		return fmt.Errorf("failed to hash password for %s: %w", username, err)
	}

	id, err := generateID()
	if err != nil {
		return fmt.Errorf("failed to generate user id: %w", err)
	}

	user := &User{
		ID:           id,
		Username:     username,
		PasswordHash: hash,
		Role:         RoleClient,
		TokenVersion: 1,
	}

	return s.repo.Create(user)
}

func (s *Service) auditLog(req audit.LogRequest) {
	if s.audit != nil {
		s.audit.Log(req)
	}
}

func (s *Service) GetByUsername(username string) (*User, error) {
	return s.repo.GetByUsername(username)
}

func (s *Service) GetByID(id string) (*User, error) {
	return s.repo.GetByID(id)
}

func (s *Service) requireAdmin(username string) (*User, error) {
	user, err := s.repo.GetByUsername(username)
	if err != nil {
		return nil, ErrNotAdmin
	}
	if user.Role != RoleAdmin {
		return nil, ErrNotAdmin
	}
	return user, nil
}

func (s *Service) currentActor(username string) (*User, error) {
	user, err := s.repo.GetByUsername(username)
	if err != nil {
		return nil, ErrNotAdmin
	}
	return user, nil
}

func (s *Service) List(actorUsername string) ([]User, error) {
	if _, err := s.requireAdmin(actorUsername); err != nil {
		return nil, err
	}
	return s.repo.List()
}

type CreateUserParams struct {
	Username  string
	Password  string
	Role      string
	FirstName string
	LastName  string
}

func (s *Service) CreateUserWithParams(actorUsername string, params CreateUserParams) (*User, error) {
	if _, err := s.requireAdmin(actorUsername); err != nil {
		return nil, err
	}

	if params.Username == "" {
		return nil, ErrEmptyUsername
	}
	if params.Password == "" {
		return nil, ErrEmptyPassword
	}
	if len(params.Password) < 8 {
		return nil, ErrPasswordTooShort
	}
	if params.Role != string(RoleAdmin) && params.Role != string(RoleUser) && params.Role != string(RoleReadonly) && params.Role != string(RoleClient) {
		return nil, ErrInvalidRole
	}
	if err := auth.ValidatePasswordStrength(params.Password); err != nil {
		return nil, ErrPasswordTooShort
	}

	if params.Role != string(RoleClient) {
		if strings.TrimSpace(params.FirstName) == "" {
			return nil, ErrEmptyFirstName
		}
		if strings.TrimSpace(params.LastName) == "" {
			return nil, ErrEmptyLastName
		}
	} else {
		params.FirstName = ""
		params.LastName = ""
	}

	if params.Role == string(RoleAdmin) {
		existing, err := s.repo.List()
		if err != nil {
			return nil, err
		}
		for _, u := range existing {
			if u.Role == RoleAdmin {
				return nil, ErrCannotCreateAdmin
			}
		}
	}

	hash, err := auth.HashPassword(params.Password)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	id, err := generateID()
	if err != nil {
		return nil, fmt.Errorf("failed to generate user id: %w", err)
	}

	user := &User{
		ID:           id,
		Username:     params.Username,
		FirstName:    params.FirstName,
		LastName:     params.LastName,
		PasswordHash: hash,
		Role:         Role(params.Role),
		TokenVersion: 1,
	}

	if err := s.repo.Create(user); err != nil {
		return nil, err
	}

	s.auditLog(audit.LogRequest{
		Action: audit.ActionUserCreate,
		Actor:  actorUsername,
		Target: user.Username,
		Status: audit.StatusSuccess,
	})

	return user, nil
}

func (s *Service) CreateUser(actorUsername, username, password, role string) (*User, error) {
	return s.CreateUserWithParams(actorUsername, CreateUserParams{
		Username:  username,
		FirstName: "Test",
		LastName:  "User",
		Password:  password,
		Role:      role,
	})
}

type UpdateUserParams struct {
	ID        string
	Username  string
	Role      string
	FirstName string
	LastName  string
	Password  string
}

func (s *Service) UpdateWithParams(actorUsername string, params UpdateUserParams) (*User, error) {
	actor, err := s.requireAdmin(actorUsername)
	if err != nil {
		return nil, err
	}

	if params.Username == "" && params.Role == "" && params.FirstName == "" && params.LastName == "" && params.Password == "" {
		return nil, ErrNoFieldsToUpdate
	}

	existing, err := s.repo.GetByID(params.ID)
	if err != nil {
		return nil, err
	}

	if existing.ID == actor.ID && params.Role != "" && existing.Role == RoleAdmin && Role(params.Role) != RoleAdmin {
		return nil, ErrCannotRemoveOwnAdminRole
	}

	if params.Username != "" {
		if dup, _ := s.repo.GetByUsername(params.Username); dup != nil && dup.ID != params.ID {
			return nil, ErrDuplicateUsername
		}
		existing.Username = params.Username
	}

	if params.Role != "" {
		if params.Role != string(RoleAdmin) && params.Role != string(RoleUser) && params.Role != string(RoleReadonly) && params.Role != string(RoleClient) {
			return nil, ErrInvalidRole
		}
		existing.Role = Role(params.Role)
	}

	if existing.Role == RoleClient {
		existing.FirstName = ""
		existing.LastName = ""
	} else {
		if params.FirstName != "" {
			existing.FirstName = params.FirstName
		}
		if params.LastName != "" {
			existing.LastName = params.LastName
		}
	}

	if params.Password != "" {
		if err := auth.ValidatePasswordStrength(params.Password); err != nil {
			return nil, ErrPasswordTooShort
		}
		hash, err := auth.HashPassword(params.Password)
		if err != nil {
			return nil, fmt.Errorf("failed to hash password: %w", err)
		}
		existing.PasswordHash = hash
		existing.TokenVersion++
	}

	if err := s.repo.Update(existing); err != nil {
		return nil, err
	}

	metadata := map[string]any{}
	if params.Username != "" {
		metadata["new_username"] = params.Username
	}
	if params.Role != "" {
		metadata["new_role"] = params.Role
	}

	s.auditLog(audit.LogRequest{
		Action:   audit.ActionUserUpdate,
		Actor:    actorUsername,
		Target:   existing.Username,
		Status:   audit.StatusSuccess,
		Metadata: metadata,
	})

	return existing, nil
}

func (s *Service) Update(actorUsername, id, newUsername, newRole string) (*User, error) {
	return s.UpdateWithParams(actorUsername, UpdateUserParams{
		ID:       id,
		Username: newUsername,
		Role:     newRole,
	})
}

func (s *Service) Delete(actorUsername, id string) error {
	actor, err := s.requireAdmin(actorUsername)
	if err != nil {
		return err
	}

	target, err := s.repo.GetByID(id)
	if err != nil {
		return err
	}

	if target.Username == "admin" || target.Role == RoleAdmin {
		return ErrCannotDeleteAdmin
	}

	if target.ID == actor.ID {
		return ErrCannotDeleteSelf
	}

	if err := s.repo.Delete(id); err != nil {
		return err
	}

	s.auditLog(audit.LogRequest{
		Action: audit.ActionUserDelete,
		Actor:  actorUsername,
		Target: target.Username,
		Status: audit.StatusSuccess,
	})

	return nil
}

func (s *Service) ChangePassword(actorUsername, id, password string) error {
	if password == "" {
		return ErrEmptyPassword
	}
	if err := auth.ValidatePasswordStrength(password); err != nil {
		return ErrPasswordTooShort
	}

	actor, err := s.currentActor(actorUsername)
	if err != nil {
		return err
	}

	target, err := s.repo.GetByID(id)
	if err != nil {
		return err
	}

	if actor.ID != target.ID && actor.Role != RoleAdmin {
		return ErrNotAdmin
	}

	hash, err := auth.HashPassword(password)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	target.PasswordHash = hash
	target.TokenVersion++ // Invalidate all prior sessions

	if err := s.repo.Update(target); err != nil {
		return err
	}

	s.auditLog(audit.LogRequest{
		Action: audit.ActionUserPassword,
		Actor:  actorUsername,
		Target: target.Username,
		Status: audit.StatusSuccess,
	})

	return nil
}

func (s *Service) RevokeAllSessions(actorUsername, id string) error {
	actor, err := s.currentActor(actorUsername)
	if err != nil {
		return err
	}

	target, err := s.repo.GetByID(id)
	if err != nil {
		return err
	}

	if actor.ID != target.ID && actor.Role != RoleAdmin {
		return ErrNotAdmin
	}

	target.TokenVersion++
	return s.repo.Update(target)
}

func (s *Service) Setup2FA(username string) (secret string, uri string, recoveryCodes []string, err error) {
	target, err := s.repo.GetByUsername(username)
	if err != nil {
		return "", "", nil, err
	}

	secret, err = auth.GenerateTOTPSecret()
	if err != nil {
		return "", "", nil, err
	}

	recoveryCodes, err = auth.GenerateRecoveryCodes(8)
	if err != nil {
		return "", "", nil, err
	}

	uri = auth.GenerateTOTPURI("HomeLab", target.Username, secret)

	target.TwoFactorSecret = secret
	target.TwoFactorRecovery = recoveryCodes
	// Not enabled until verified
	target.TwoFactorEnabled = false

	if err := s.repo.Update(target); err != nil {
		return "", "", nil, err
	}

	return secret, uri, recoveryCodes, nil
}

func (s *Service) VerifyAndEnable2FA(username, code string) error {
	target, err := s.repo.GetByUsername(username)
	if err != nil {
		return err
	}

	if target.TwoFactorSecret == "" {
		return fmt.Errorf("2FA setup not initiated")
	}

	if !auth.ValidateTOTP(target.TwoFactorSecret, code) {
		return fmt.Errorf("invalid 2FA verification code")
	}

	target.TwoFactorEnabled = true
	target.TokenVersion++

	return s.repo.Update(target)
}

func (s *Service) Setup2FAForUser(actorUsername, id string) (secret string, uri string, recoveryCodes []string, err error) {
	actor, err := s.currentActor(actorUsername)
	if err != nil {
		return "", "", nil, err
	}

	target, err := s.repo.GetByID(id)
	if err != nil {
		return "", "", nil, err
	}

	if actor.ID != target.ID && actor.Role != RoleAdmin {
		return "", "", nil, ErrNotAdmin
	}

	if target.Role == RoleClient {
		return "", "", nil, fmt.Errorf("two-factor authentication is not supported for client companion accounts")
	}

	return s.Setup2FA(target.Username)
}

func (s *Service) VerifyAndEnable2FAForUser(actorUsername, id, code string) error {
	actor, err := s.currentActor(actorUsername)
	if err != nil {
		return err
	}

	target, err := s.repo.GetByID(id)
	if err != nil {
		return err
	}

	if actor.ID != target.ID && actor.Role != RoleAdmin {
		return ErrNotAdmin
	}

	return s.VerifyAndEnable2FA(target.Username, code)
}

func (s *Service) Disable2FA(actorUsername, id string) error {
	actor, err := s.currentActor(actorUsername)
	if err != nil {
		return err
	}

	target, err := s.repo.GetByID(id)
	if err != nil {
		return err
	}

	if actor.ID != target.ID && actor.Role != RoleAdmin {
		return ErrNotAdmin
	}

	target.TwoFactorEnabled = false
	target.TwoFactorSecret = ""
	target.TwoFactorRecovery = nil
	target.TokenVersion++

	return s.repo.Update(target)
}

func generateID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return fmt.Sprintf("%x", b), nil
}
