package api

import (
	"net/http"
	"time"
)

type HealthResponse struct {
	Status    string    `json:"status"`
	Version   string    `json:"version"`
	Timestamp time.Time `json:"timestamp"`
}

func HealthHandler(w http.ResponseWriter, r *http.Request) {
	JSON(w, http.StatusOK, HealthResponse{
		Status:    "ok",
		Version:   "0.1.0",
		Timestamp: time.Now(),
	})
}
