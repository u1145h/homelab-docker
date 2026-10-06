package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/ullashroy/poco-server/backend/internal/auth"
	"github.com/ullashroy/poco-server/backend/internal/users"
)

func AuthHandler(us *users.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tokenStr := ""
		if cookie, err := r.Cookie("poco_session"); err == nil && cookie.Value != "" {
			tokenStr = cookie.Value
		} else if authHeader := r.Header.Get("Authorization"); strings.HasPrefix(authHeader, "Bearer ") {
			tokenStr = strings.TrimPrefix(authHeader, "Bearer ")
		}

		if tokenStr == "" {
			JSON(w, http.StatusOK, map[string]any{"authenticated": false})
			return
		}

		token, err := auth.ValidateToken(tokenStr)
		if err != nil || !token.Valid {
			JSON(w, http.StatusOK, map[string]any{"authenticated": false})
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			JSON(w, http.StatusOK, map[string]any{"authenticated": false})
			return
		}

		username, _ := claims["username"].(string)
		role, _ := claims["role"].(string)

		if username == "" {
			JSON(w, http.StatusOK, map[string]any{"authenticated": false})
			return
		}

		firstName := ""
		lastName := ""
		twoFactorEnabled := false
		if us != nil {
			if u, err := us.GetByUsername(username); err == nil && u != nil {
				firstName = u.FirstName
				lastName = u.LastName
				twoFactorEnabled = u.TwoFactorEnabled
			}
		}

		JSON(w, http.StatusOK, map[string]any{
			"authenticated":      true,
			"username":           username,
			"role":               role,
			"first_name":         firstName,
			"last_name":          lastName,
			"two_factor_enabled": twoFactorEnabled,
		})
	}
}

// Setup2FAHandler generates a new TOTP secret and QR code URI for the current user
func Setup2FAHandler(us *users.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		if actor.Username == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		secret, uri, recoveryCodes, err := us.Setup2FA(actor.Username)
		if err != nil {
			JSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		JSON(w, http.StatusOK, map[string]any{
			"secret":         secret,
			"uri":            uri,
			"recovery_codes": recoveryCodes,
		})
	}
}

type Verify2FARequest struct {
	Code string `json:"code"`
}

// Verify2FAHandler verifies the TOTP code and activates 2FA on the account
func Verify2FAHandler(us *users.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		if actor.Username == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		var req Verify2FARequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Code) == "" {
			JSON(w, http.StatusBadRequest, map[string]string{"error": "Verification code is required."})
			return
		}

		if err := us.VerifyAndEnable2FA(actor.Username, strings.TrimSpace(req.Code)); err != nil {
			JSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		JSON(w, http.StatusOK, map[string]any{
			"success": true,
			"message": "Two-factor authentication enabled successfully.",
		})
	}
}

// Disable2FAHandler turns off 2FA for a user account
func Disable2FAHandler(us *users.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		if actor.Username == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		user, err := us.GetByUsername(actor.Username)
		if err != nil {
			JSON(w, http.StatusNotFound, map[string]string{"error": "User not found."})
			return
		}

		if err := us.Disable2FA(actor.Username, user.ID); err != nil {
			JSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		JSON(w, http.StatusOK, map[string]any{
			"success": true,
			"message": "Two-factor authentication disabled.",
		})
	}
}
