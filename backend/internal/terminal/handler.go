package terminal

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/ullashroy/poco-server/backend/internal/auth"
)

func CreateSessionHandler(ts *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())

		var req CreateSessionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		session, err := ts.CreateSession(r.Context(), actor.Username, req)
		if err != nil {
			switch {
			case errors.Is(err, ErrPermissionDenied):
				http.Error(w, err.Error(), http.StatusForbidden)
			case errors.Is(err, ErrTooManySessions):
				http.Error(w, err.Error(), http.StatusTooManyRequests)
			case errors.Is(err, ErrInvalidSize):
				http.Error(w, err.Error(), http.StatusBadRequest)
			case errors.Is(err, ErrShellUnavailable):
				http.Error(w, err.Error(), http.StatusServiceUnavailable)
			case errors.Is(err, ErrTerminalUnavailable):
				http.Error(w, err.Error(), http.StatusServiceUnavailable)
			default:
				http.Error(w, "internal error", http.StatusInternalServerError)
			}
			return
		}

		writeJSON(w, http.StatusCreated, session)
	}
}

func ListSessionsHandler(ts *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())

		sessions, err := ts.ListSessions(r.Context(), actor.Username)
		if err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, ListSessionsResponse{Sessions: sessions})
	}
}

func GetSessionHandler(ts *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		id := chi.URLParam(r, "id")

		session, err := ts.GetSession(r.Context(), actor.Username, id)
		if err != nil {
			switch {
			case errors.Is(err, ErrSessionNotFound):
				http.Error(w, err.Error(), http.StatusNotFound)
			case errors.Is(err, ErrSessionNotOwned):
				http.Error(w, err.Error(), http.StatusForbidden)
			default:
				http.Error(w, "internal error", http.StatusInternalServerError)
			}
			return
		}

		writeJSON(w, http.StatusOK, session)
	}
}

func CloseSessionHandler(ts *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		id := chi.URLParam(r, "id")

		if err := ts.CloseSession(r.Context(), actor.Username, id); err != nil {
			switch {
			case errors.Is(err, ErrSessionNotFound):
				http.Error(w, err.Error(), http.StatusNotFound)
			case errors.Is(err, ErrSessionClosed):
				http.Error(w, err.Error(), http.StatusConflict)
			case errors.Is(err, ErrPermissionDenied), errors.Is(err, ErrSessionNotOwned):
				http.Error(w, err.Error(), http.StatusForbidden)
			default:
				http.Error(w, "internal error", http.StatusInternalServerError)
			}
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func ResizeSessionHandler(ts *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		id := chi.URLParam(r, "id")

		var req ResizeRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		if err := ts.ResizeSession(r.Context(), actor.Username, id, req.Rows, req.Cols); err != nil {
			switch {
			case errors.Is(err, ErrSessionNotFound):
				http.Error(w, err.Error(), http.StatusNotFound)
			case errors.Is(err, ErrSessionClosed):
				http.Error(w, err.Error(), http.StatusConflict)
			case errors.Is(err, ErrInvalidSize):
				http.Error(w, err.Error(), http.StatusBadRequest)
			case errors.Is(err, ErrPermissionDenied), errors.Is(err, ErrSessionNotOwned):
				http.Error(w, err.Error(), http.StatusForbidden)
			default:
				http.Error(w, "internal error", http.StatusInternalServerError)
			}
			return
		}

		w.WriteHeader(http.StatusOK)
	}
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
