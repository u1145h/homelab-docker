package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/ullashroy/poco-server/backend/internal/auth"
	"github.com/ullashroy/poco-server/backend/internal/kuro"
	"github.com/ullashroy/poco-server/backend/internal/kuro/storage"
	"github.com/ullashroy/poco-server/backend/internal/users"
)

type CreateUserRequest struct {
	Username  string `json:"username"`
	FirstName string `json:"first_name,omitempty"`
	LastName  string `json:"last_name,omitempty"`
	Password  string `json:"password"`
	Role      string `json:"role"`
}

type UpdateUserRequest struct {
	Username  string `json:"username,omitempty"`
	FirstName string `json:"first_name,omitempty"`
	LastName  string `json:"last_name,omitempty"`
	Role      string `json:"role,omitempty"`
	Password  string `json:"password,omitempty"`
}

type ChangePasswordRequest struct {
	Password string `json:"password"`
}

type UserResponse struct {
	ID               string     `json:"id"`
	Username         string     `json:"username"`
	FirstName        string     `json:"first_name,omitempty"`
	LastName         string     `json:"last_name,omitempty"`
	Role             string     `json:"role"`
	TwoFactorEnabled bool       `json:"two_factor_enabled"`
	LastLoginAt      *time.Time `json:"last_login_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

func toUserResponse(u *users.User) UserResponse {
	return UserResponse{
		ID:               u.ID,
		Username:         u.Username,
		FirstName:        u.FirstName,
		LastName:         u.LastName,
		Role:             string(u.Role),
		TwoFactorEnabled: u.TwoFactorEnabled,
		LastLoginAt:      u.LastLoginAt,
		CreatedAt:        u.CreatedAt,
		UpdatedAt:        u.UpdatedAt,
	}
}

func ListUsersHandler(us *users.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		userList, err := us.List(actor.Username)
		if err != nil {
			if errors.Is(err, users.ErrNotAdmin) {
				Error(w, http.StatusForbidden, err)
				return
			}
			Error(w, http.StatusInternalServerError, err)
			return
		}

		resp := make([]UserResponse, len(userList))
		for i := range userList {
			resp[i] = toUserResponse(&userList[i])
		}

		JSON(w, http.StatusOK, resp)
	}
}

func GetUserHandler(us *users.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")

		user, err := us.GetByID(id)
		if err != nil {
			if errors.Is(err, users.ErrUserNotFound) {
				Error(w, http.StatusNotFound, err)
				return
			}
			Error(w, http.StatusInternalServerError, err)
			return
		}

		JSON(w, http.StatusOK, toUserResponse(user))
	}
}

func CreateUserHandler(us *users.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())

		var req CreateUserRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request", http.StatusBadRequest)
			return
		}

		user, err := us.CreateUserWithParams(actor.Username, users.CreateUserParams{
			Username:  req.Username,
			FirstName: req.FirstName,
			LastName:  req.LastName,
			Password:  req.Password,
			Role:      req.Role,
		})
		if err != nil {
			switch {
			case errors.Is(err, users.ErrNotAdmin):
				Error(w, http.StatusForbidden, err)
			case errors.Is(err, users.ErrEmptyUsername),
				errors.Is(err, users.ErrEmptyPassword),
				errors.Is(err, users.ErrPasswordTooShort),
				errors.Is(err, users.ErrInvalidRole):
				Error(w, http.StatusBadRequest, err)
			case errors.Is(err, users.ErrDuplicateUsername):
				Error(w, http.StatusConflict, err)
			default:
				Error(w, http.StatusInternalServerError, err)
			}
			return
		}

		JSON(w, http.StatusCreated, toUserResponse(user))
	}
}

func UpdateUserHandler(us *users.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		id := chi.URLParam(r, "id")

		var req UpdateUserRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request", http.StatusBadRequest)
			return
		}

		user, err := us.UpdateWithParams(actor.Username, users.UpdateUserParams{
			ID:        id,
			Username:  req.Username,
			FirstName: req.FirstName,
			LastName:  req.LastName,
			Role:      req.Role,
			Password:  req.Password,
		})
		if err != nil {
			switch {
			case errors.Is(err, users.ErrNotAdmin):
				Error(w, http.StatusForbidden, err)
			case errors.Is(err, users.ErrUserNotFound):
				Error(w, http.StatusNotFound, err)
			case errors.Is(err, users.ErrDuplicateUsername),
				errors.Is(err, users.ErrInvalidRole),
				errors.Is(err, users.ErrNoFieldsToUpdate),
				errors.Is(err, users.ErrCannotRemoveOwnAdminRole):
				Error(w, http.StatusBadRequest, err)
			default:
				Error(w, http.StatusInternalServerError, err)
			}
			return
		}

		JSON(w, http.StatusOK, toUserResponse(user))
	}
}

func DeleteUserHandler(us *users.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		id := chi.URLParam(r, "id")

		err := us.Delete(actor.Username, id)
		if err != nil {
			switch {
			case errors.Is(err, users.ErrNotAdmin):
				Error(w, http.StatusForbidden, err)
			case errors.Is(err, users.ErrUserNotFound):
				Error(w, http.StatusNotFound, err)
			case errors.Is(err, users.ErrCannotDeleteSelf),
				errors.Is(err, users.ErrCannotDeleteLastAdmin):
				Error(w, http.StatusBadRequest, err)
			default:
				Error(w, http.StatusInternalServerError, err)
			}
			return
		}

		JSON(w, http.StatusOK, map[string]bool{"success": true})
	}
}

func ChangePasswordHandler(us *users.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		id := chi.URLParam(r, "id")

		var req ChangePasswordRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request", http.StatusBadRequest)
			return
		}

		err := us.ChangePassword(actor.Username, id, req.Password)
		if err != nil {
			switch {
			case errors.Is(err, users.ErrEmptyPassword),
				errors.Is(err, users.ErrPasswordTooShort):
				Error(w, http.StatusBadRequest, err)
			case errors.Is(err, users.ErrNotAdmin):
				Error(w, http.StatusForbidden, err)
			case errors.Is(err, users.ErrUserNotFound):
				Error(w, http.StatusNotFound, err)
			default:
				Error(w, http.StatusInternalServerError, err)
			}
			return
		}

		JSON(w, http.StatusOK, map[string]bool{"success": true})
	}
}

func RevokeSessionsHandler(us *users.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		id := chi.URLParam(r, "id")

		if err := us.RevokeAllSessions(actor.Username, id); err != nil {
			if errors.Is(err, users.ErrNotAdmin) {
				Error(w, http.StatusForbidden, err)
				return
			}
			Error(w, http.StatusInternalServerError, err)
			return
		}

		JSON(w, http.StatusOK, map[string]any{"success": true, "message": "All active sessions revoked."})
	}
}

func AdminSetup2FAHandler(us *users.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		id := chi.URLParam(r, "id")

		secret, uri, recoveryCodes, err := us.Setup2FAForUser(actor.Username, id)
		if err != nil {
			if errors.Is(err, users.ErrNotAdmin) {
				Error(w, http.StatusForbidden, err)
				return
			}
			if errors.Is(err, users.ErrUserNotFound) {
				Error(w, http.StatusNotFound, err)
				return
			}
			Error(w, http.StatusInternalServerError, err)
			return
		}

		JSON(w, http.StatusOK, map[string]any{
			"secret":         secret,
			"uri":            uri,
			"recovery_codes": recoveryCodes,
		})
	}
}

func AdminVerify2FAHandler(us *users.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		id := chi.URLParam(r, "id")

		var req struct {
			Code string `json:"code"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Code == "" {
			http.Error(w, "invalid verification code", http.StatusBadRequest)
			return
		}

		if err := us.VerifyAndEnable2FAForUser(actor.Username, id, req.Code); err != nil {
			if errors.Is(err, users.ErrNotAdmin) {
				Error(w, http.StatusForbidden, err)
				return
			}
			Error(w, http.StatusBadRequest, err)
			return
		}

		JSON(w, http.StatusOK, map[string]any{
			"success": true,
			"message": "Two-factor authentication enabled successfully.",
		})
	}
}

func AdminDisable2FAHandler(us *users.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		id := chi.URLParam(r, "id")

		if err := us.Disable2FA(actor.Username, id); err != nil {
			if errors.Is(err, users.ErrNotAdmin) {
				Error(w, http.StatusForbidden, err)
				return
			}
			if errors.Is(err, users.ErrUserNotFound) {
				Error(w, http.StatusNotFound, err)
				return
			}
			Error(w, http.StatusInternalServerError, err)
			return
		}

		JSON(w, http.StatusOK, map[string]any{
			"success": true,
			"message": "Two-factor authentication disabled.",
		})
	}
}

// UserSessionsResponse is the JSON response structure for user session queries.
type UserSessionsResponse struct {
	TotalCount  int                     `json:"total_count"`
	ActiveCount int                     `json:"active_count"`
	Sessions    []storage.UserSessionItem `json:"sessions"`
}

// GetUserSessionsHandler returns active and historical session records for a user.
func GetUserSessionsHandler(us *users.Service, ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		id := chi.URLParam(r, "id")

		user, err := us.GetByID(id)
		if err != nil {
			var err2 error
			user, err2 = us.GetByUsername(id)
			if err2 != nil {
				Error(w, http.StatusNotFound, errors.New("user not found"))
				return
			}
		}

		if actor.Role != "admin" && actor.Username != user.Username {
			Error(w, http.StatusForbidden, errors.New("forbidden"))
			return
		}

		if ks == nil {
			JSON(w, http.StatusOK, UserSessionsResponse{TotalCount: 0, ActiveCount: 0, Sessions: []storage.UserSessionItem{}})
			return
		}

		isOnlineFn := func(sessionID, username, clientType string) bool {
			if ks.Nodes != nil {
				return ks.Nodes.IsSessionConnected(sessionID, username, clientType)
			}
			return false
		}

		var sessions []storage.UserSessionItem
		var total, active int

		if ks.Store != nil {
			sessions, total, active, err = ks.Store.GetSessionsByUsername(user.Username, actor.SessionID, isOnlineFn)
		}
		if (err != nil || len(sessions) == 0) && ks.DB != nil {
			// Fallback / sync with SQLite
			dbSessions, dbTotal, dbActive, dbErr := ks.DB.GetUserSessions(user.Username, actor.SessionID)
			if dbErr == nil && len(dbSessions) > 0 {
				total = dbTotal
				active = dbActive
				sessions = make([]storage.UserSessionItem, 0, len(dbSessions))
				for _, s := range dbSessions {
					isWsOnline := isOnlineFn(s.ID, s.Username, s.ClientType)
					isOnline := isWsOnline || s.IsCurrent || time.Since(s.LastActiveAt) < 90*time.Second
					status := "offline"
					if !s.IsActive || s.RevokedAt != nil {
						status = "revoked"
						isOnline = false
					} else if isOnline {
						status = "online"
					}

					var revokedAtStr string
					if s.RevokedAt != nil {
						revokedAtStr = s.RevokedAt.UTC().Format(time.RFC3339)
					}

					item := storage.UserSessionItem{
						ID:           s.ID,
						UserID:       s.UserID,
						Username:     s.Username,
						TokenVersion: s.TokenVersion,
						ClientType:   s.ClientType,
						DeviceName:   s.DeviceName,
						OS:           s.OS,
						Browser:      s.Browser,
						IPAddress:    s.IPAddress,
						UserAgent:    s.UserAgent,
						IsActive:     s.IsActive,
						IsCurrent:    s.IsCurrent,
						IsOnline:     isOnline,
						Status:       status,
						LastActiveAt: s.LastActiveAt.UTC().Format(time.RFC3339),
						CreatedAt:    s.CreatedAt.UTC().Format(time.RFC3339),
						RevokedAt:    revokedAtStr,
					}
					sessions = append(sessions, item)
					if ks.Store != nil {
						_ = ks.Store.SaveSession(item)
					}
				}
			}
		}

		if sessions == nil {
			sessions = []storage.UserSessionItem{}
		}

		JSON(w, http.StatusOK, UserSessionsResponse{
			TotalCount:  total,
			ActiveCount: active,
			Sessions:    sessions,
		})
	}
}

// RevokeUserSessionHandler revokes a specific user session and disconnects its active WebSocket immediately.
func RevokeUserSessionHandler(us *users.Service, ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		id := chi.URLParam(r, "id")
		sessionID := chi.URLParam(r, "session_id")

		user, err := us.GetByID(id)
		if err != nil {
			var err2 error
			user, err2 = us.GetByUsername(id)
			if err2 != nil {
				Error(w, http.StatusNotFound, errors.New("user not found"))
				return
			}
		}

		if actor.Role != "admin" && actor.Username != user.Username {
			Error(w, http.StatusForbidden, errors.New("forbidden"))
			return
		}

		if ks != nil && sessionID != "" {
			if ks.Store != nil {
				_ = ks.Store.RevokeSession(sessionID, user.Username)
			}
			if ks.DB != nil {
				_ = ks.DB.RevokeUserSession(sessionID, user.Username)
			}
			if ks.Nodes != nil {
				ks.Nodes.DisconnectAndLogoutSession(sessionID, user.Username)
			}
		}

		JSON(w, http.StatusOK, map[string]any{
			"success": true,
			"message": "Session revoked successfully.",
		})
	}
}

// RevokeAllUserSessionsHandler revokes all active sessions for a user, disconnects all nodes, and bumps token version.
func RevokeAllUserSessionsHandler(us *users.Service, ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		id := chi.URLParam(r, "id")

		user, err := us.GetByID(id)
		if err != nil {
			var err2 error
			user, err2 = us.GetByUsername(id)
			if err2 != nil {
				Error(w, http.StatusNotFound, errors.New("user not found"))
				return
			}
		}

		if actor.Role != "admin" && actor.Username != user.Username {
			Error(w, http.StatusForbidden, errors.New("forbidden"))
			return
		}

		if ks != nil {
			if ks.Store != nil {
				_ = ks.Store.RevokeAllSessions(user.Username)
			}
			if ks.DB != nil {
				_ = ks.DB.RevokeAllUserSessions(user.Username)
			}
			if ks.Nodes != nil {
				ks.Nodes.DisconnectAndLogoutSession("", user.Username)
			}
		}

		// Also increment token version on user to immediately invalidate active JWT tokens
		_ = us.RevokeAllSessions(actor.Username, user.ID)

		JSON(w, http.StatusOK, map[string]any{
			"success": true,
			"message": "All sessions revoked successfully.",
		})
	}
}

