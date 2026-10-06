package api

import (
	"net/http"
	"strconv"

	"github.com/ullashroy/poco-server/backend/internal/activities"
)

type listActivitiesResponse struct {
	Events []activities.Event `json:"events"`
	Total  int                `json:"total"`
}

func ListActivitiesHandler(as *activities.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()

		offset, _ := strconv.Atoi(q.Get("offset"))
		limit, _ := strconv.Atoi(q.Get("limit"))

		events, total := as.Query(offset, limit)
		JSON(w, http.StatusOK, listActivitiesResponse{
			Events: events,
			Total:  total,
		})
	}
}
