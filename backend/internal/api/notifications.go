package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/ullashroy/poco-server/backend/internal/notifications"
)

func ListNotificationsHandler(store *notifications.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()

		var filter notifications.Filter

		if startStr := q.Get("start_date"); startStr != "" {
			if t, err := parseFlexTime(startStr); err == nil {
				filter.StartDate = &t
			}
		}

		if endStr := q.Get("end_date"); endStr != "" {
			if t, err := parseFlexTime(endStr); err == nil {
				// If date only (e.g. YYYY-MM-DD), set to end of day
				if len(endStr) <= 10 {
					t = t.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
				}
				filter.EndDate = &t
			}
		}

		if sev := q.Get("severity"); sev != "" {
			filter.Severity = notifications.Severity(sev)
		}

		if cat := q.Get("category"); cat != "" {
			filter.Category = notifications.Category(cat)
		}

		if unread := q.Get("unread_only"); unread == "true" || unread == "1" {
			filter.UnreadOnly = true
		}

		filter.Search = q.Get("search")

		if limitStr := q.Get("limit"); limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil {
				filter.Limit = l
			}
		}
		if offsetStr := q.Get("offset"); offsetStr != "" {
			if o, err := strconv.Atoi(offsetStr); err == nil {
				filter.Offset = o
			}
		}

		items, total, unreadCount := store.List(filter)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"items":        items,
			"total":        total,
			"unread_count": unreadCount,
		})
	}
}

func SummaryNotificationsHandler(store *notifications.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit := 10
		if lStr := r.URL.Query().Get("limit"); lStr != "" {
			if l, err := strconv.Atoi(lStr); err == nil && l > 0 {
				limit = l
			}
		}

		summary := store.GetSummary(limit)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(summary)
	}
}

func MarkNotificationReadHandler(store *notifications.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		if id == "" {
			http.Error(w, "missing notification id", http.StatusBadRequest)
			return
		}

		ok := store.MarkRead(id)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]bool{"success": ok})
	}
}

func MarkAllNotificationsReadHandler(store *notifications.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		count := store.MarkAllRead()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"updated": count,
		})
	}
}

func DeleteNotificationHandler(store *notifications.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		if id == "" {
			http.Error(w, "missing notification id", http.StatusBadRequest)
			return
		}

		ok := store.Delete(id)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]bool{"success": ok})
	}
}

func ClearNotificationsHandler(store *notifications.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		store.Clear()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}
}

func TestNotificationHandler(store *notifications.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Severity notifications.Severity `json:"severity"`
			Category notifications.Category `json:"category"`
			Title    string                 `json:"title"`
			Message  string                 `json:"message"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			req.Severity = notifications.SevInfo
			req.Category = notifications.CatSystem
			req.Title = "Test Alert"
			req.Message = "This is a live test notification from Kuro Dashboard."
		}

		if req.Severity == "" {
			req.Severity = notifications.SevInfo
		}
		if req.Category == "" {
			req.Category = notifications.CatSystem
		}
		if req.Title == "" {
			req.Title = "Test Alert"
		}
		if req.Message == "" {
			req.Message = "Test notification triggered at " + time.Now().Format("15:04:05")
		}

		n := store.Add(req.Severity, req.Category, req.Title, req.Message, "/notifications")

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(n)
	}
}

func parseFlexTime(s string) (time.Time, error) {
	layouts := []string{
		time.RFC3339,
		"2006-01-02T15:04:05",
		"2006-01-02",
	}
	for _, l := range layouts {
		if t, err := time.Parse(l, s); err == nil {
			return t, nil
		}
	}
	return time.Parse(time.RFC3339, s)
}
