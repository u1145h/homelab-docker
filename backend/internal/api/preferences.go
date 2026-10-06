package api

import (
	"encoding/json"
	"net/http"

	"github.com/ullashroy/poco-server/backend/internal/auth"
	"github.com/ullashroy/poco-server/backend/internal/preferences"
)

// GetPreferencesHandler returns the current user's preferences.
func GetPreferencesHandler(store *preferences.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity := auth.CurrentUser(r.Context())
		if identity.Username == "" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		p, err := store.Load(identity.Username)
		if err != nil {
			http.Error(w, "failed to load preferences", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(p)
	}
}

// PutPreferencesHandler saves the current user's preferences.
// Theme is treated as device-local: the value sent by the client is accepted
// and stored, but when another device subsequently saves, its theme value is
// discarded and the previously stored theme is restored. This ensures theme
// changes never cross-contaminate other sessions while every other preference
// propagates to all sessions of the same user.
func PutPreferencesHandler(store *preferences.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity := auth.CurrentUser(r.Context())
		if identity.Username == "" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		// Load existing preferences to preserve device-local fields.
		existing, err := store.Load(identity.Username)
		if err != nil {
			http.Error(w, "failed to load preferences", http.StatusInternalServerError)
			return
		}

		var incoming preferences.UserPreferences
		if err := json.NewDecoder(r.Body).Decode(&incoming); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		// Theme and amoled are intentionally device-local (per-session).
		// Restore the server-stored values so they are never overwritten by
		// a save coming from a different device.
		incoming.Theme = existing.Theme
		incoming.Amoled = existing.Amoled

		if err := store.Save(identity.Username, incoming); err != nil {
			http.Error(w, "failed to save preferences", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}
