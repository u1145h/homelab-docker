package api

import (
	"net/http"

	"github.com/ullashroy/poco-server/backend/internal/state"
)

func DockerHandler(st *state.State) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		info := st.Docker()
		containers := make([]ContainerResponse, 0, len(info.Containers))
		for _, c := range info.Containers {
			containers = append(containers, toContainerResponse(c))
		}
		JSON(w, http.StatusOK, map[string]any{"containers": containers})
	}
}
