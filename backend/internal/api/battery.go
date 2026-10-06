package api

import (
	"net/http"

	"github.com/ullashroy/poco-server/backend/internal/state"
)

func BatteryHandler(st *state.State) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		JSON(w, http.StatusOK, st.Battery())
	}
}
