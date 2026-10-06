package api

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/ullashroy/poco-server/backend/internal/audit"
	"github.com/ullashroy/poco-server/backend/internal/auth"
	"github.com/ullashroy/poco-server/backend/internal/users"
)

func ListAuditHandler(as *audit.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())

		q := r.URL.Query()
		filter := audit.AuditFilter{
			Limit: audit.DefaultPageSize,
		}

		actionStr := q.Get("action")
		if actionStr != "" {
			a := audit.Action(actionStr)
			if !audit.IsValidAction(a) {
				http.Error(w, "invalid action: "+actionStr, http.StatusBadRequest)
				return
			}
			filter.Action = a
		}

		if offset, err := strconv.Atoi(q.Get("offset")); err == nil && offset >= 0 {
			filter.Offset = offset
		}
		if limit, err := strconv.Atoi(q.Get("limit")); err == nil && limit > 0 {
			filter.Limit = limit
		}

		entries, err := as.List(actor.Username, filter)
		if err != nil {
			if errors.Is(err, users.ErrNotAdmin) {
				Error(w, http.StatusForbidden, err)
				return
			}
			Error(w, http.StatusInternalServerError, err)
			return
		}

		JSON(w, http.StatusOK, entries)
	}
}

func GetAuditHandler(as *audit.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		id := chi.URLParam(r, "id")

		entry, err := as.GetByID(actor.Username, id)
		if err != nil {
			if errors.Is(err, audit.ErrNotFound) {
				Error(w, http.StatusNotFound, err)
				return
			}
			if errors.Is(err, users.ErrNotAdmin) {
				Error(w, http.StatusForbidden, err)
				return
			}
			Error(w, http.StatusInternalServerError, err)
			return
		}

		JSON(w, http.StatusOK, entry)
	}
}

func GetAuditConfigHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		config := audit.AuditConfig{
			RetentionDays:  30,
			StorageBackend: "local · encrypted",
			StreamTargets:  "journald + kuro",
		}
		JSON(w, http.StatusOK, config)
	}
}
