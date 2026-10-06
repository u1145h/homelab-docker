package api

import (
	"net/http"

	"github.com/ullashroy/poco-server/backend/internal/auth"
	"github.com/ullashroy/poco-server/backend/internal/kuro"
)

func LogoutHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		if actor.SessionID != "" && ks != nil {
			if ks.Store != nil {
				_ = ks.Store.RevokeSession(actor.SessionID, actor.Username)
			}
			if ks.DB != nil {
				_ = ks.DB.RevokeUserSession(actor.SessionID, actor.Username)
			}
			if ks.Nodes != nil {
				ks.Nodes.DisconnectAndLogoutSession(actor.SessionID, actor.Username)
			}
		}

		http.SetCookie(w, &http.Cookie{
			Name:     "poco_session",
			Value:    "",
			Path:     "/",
			MaxAge:   -1,
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
		})

		JSON(w, http.StatusOK, map[string]bool{
			"success": true,
		})
	}
}
