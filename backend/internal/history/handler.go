package history

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/ullashroy/poco-server/backend/internal/auth"
)

func LatestHandler(hs *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())

		sample, err := hs.GetLatest(r.Context(), actor.Username)
		if err != nil {
			if errors.Is(err, ErrNoSamples) {
				writeJSON(w, http.StatusOK, LatestResponse{Sample: nil})
				return
			}
			if errors.Is(err, ErrPermissionDenied) {
				http.Error(w, err.Error(), http.StatusForbidden)
				return
			}
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, LatestResponse{Sample: sample})
	}
}

func RangeHandler(hs *Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())

		q := r.URL.Query()

		start, end, err := parseTimeRange(q.Get("start"), q.Get("end"))
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		metric := MetricType(q.Get("metric"))
		if metric != "" && !ValidMetrics[metric] {
			http.Error(w, "invalid metric: "+q.Get("metric"), http.StatusBadRequest)
			return
		}

		resolution := 0
		if resStr := q.Get("resolution"); resStr != "" {
			resolution, err = strconv.Atoi(resStr)
			if err != nil {
				http.Error(w, "invalid resolution", http.StatusBadRequest)
				return
			}
		}

		limit, _ := strconv.Atoi(q.Get("limit"))
		offset, _ := strconv.Atoi(q.Get("offset"))

		samples, err := hs.QueryRange(r.Context(), actor.Username, start, end, metric, resolution, limit, offset)
		if err != nil {
			switch {
			case errors.Is(err, ErrInvalidTimeRange),
				errors.Is(err, ErrInvalidMetric),
				errors.Is(err, ErrInvalidResolution),
				errors.Is(err, ErrInvalidLimit),
				errors.Is(err, ErrInvalidOffset):
				http.Error(w, err.Error(), http.StatusBadRequest)
			case errors.Is(err, ErrPermissionDenied):
				http.Error(w, err.Error(), http.StatusForbidden)
			default:
				http.Error(w, "internal error", http.StatusInternalServerError)
			}
			return
		}

		writeJSON(w, http.StatusOK, RangeResponse{
			Samples:    samples,
			Resolution: resolution,
			Start:      start.Format(time.RFC3339),
			End:        end.Format(time.RFC3339),
		})
	}
}

func parseTimeRange(startStr, endStr string) (time.Time, time.Time, error) {
	var start, end time.Time
	var err error

	if startStr != "" {
		start, err = time.Parse(time.RFC3339, startStr)
		if err != nil {
			return start, end, errors.New("invalid start time: use RFC3339 format")
		}
	} else {
		start = time.Now().Add(-1 * time.Hour)
	}

	if endStr != "" {
		end, err = time.Parse(time.RFC3339, endStr)
		if err != nil {
			return start, end, errors.New("invalid end time: use RFC3339 format")
		}
	} else {
		end = time.Now()
	}

	return start, end, nil
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
