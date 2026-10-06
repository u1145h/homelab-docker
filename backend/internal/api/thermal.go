package api

import (
	"net/http"

	"github.com/ullashroy/poco-server/backend/internal/state"
)

func ThermalHandler(st *state.State) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		JSON(w, http.StatusOK, st.Thermal())
	}
}
