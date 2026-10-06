package api

import (
	"encoding/json"
	"net/http"

	"github.com/ullashroy/poco-server/backend/internal/audit"
	"github.com/ullashroy/poco-server/backend/internal/auth"
	"github.com/ullashroy/poco-server/backend/internal/system"
	"github.com/ullashroy/poco-server/backend/internal/users"
)

type PowerRequest struct {
	Password string `json:"password"`
}

func PowerRebootHandler(us *users.Service, as *audit.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity := auth.CurrentUser(r.Context())
		if identity.Role != string(users.RoleAdmin) {
			http.Error(w, "forbidden: admin privileges required", http.StatusForbidden)
			return
		}

		var req PowerRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Password == "" {
			http.Error(w, "password is required", http.StatusBadRequest)
			return
		}

		// 1. Fetch current admin user
		user, err := us.GetByUsername(identity.Username)
		if err != nil {
			http.Error(w, "user not found", http.StatusInternalServerError)
			return
		}

		// 2. Validate password against user hash OR system root/sudo password
		validUserPassword := auth.CheckPassword(user.PasswordHash, req.Password) == nil
		validRootPassword := system.VerifyRootOrSudoPassword(req.Password)

		if !validUserPassword && !validRootPassword {
			if as != nil {
				as.Log(audit.LogRequest{
					Action:  audit.ActionSystemReboot,
					Actor:   identity.Username,
					Status:  audit.StatusFailure,
					Message: "invalid root or administrative password",
				})
			}
			http.Error(w, "invalid root or administrative password", http.StatusUnauthorized)
			return
		}

		// 3. Log audit action
		if as != nil {
			as.Log(audit.LogRequest{
				Action:  audit.ActionSystemReboot,
				Actor:   identity.Username,
				Status:  audit.StatusSuccess,
				Message: "system reboot initiated",
			})
		}

		// 4. Trigger safe background reboot execution passing the validated password
		if err := system.ExecuteReboot(req.Password); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		JSON(w, http.StatusOK, map[string]any{
			"success": true,
			"message": "system reboot initiated successfully",
		})
	}
}
