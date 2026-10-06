package api

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/ullashroy/poco-server/backend/internal/auth"
	"github.com/ullashroy/poco-server/backend/internal/docker"
)

func ListContainersHandler(ds *docker.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		containers, err := ds.ListContainers(r.Context(), actor.Username)
		if err != nil {
			Error(w, http.StatusInternalServerError, err)
			return
		}
		resp := make([]ContainerResponse, 0, len(containers))
		for _, c := range containers {
			resp = append(resp, toContainerResponse(c))
		}
		JSON(w, http.StatusOK, resp)
	}
}

func GetContainerHandler(ds *docker.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		id := chi.URLParam(r, "id")
		detail, err := ds.GetContainer(r.Context(), actor.Username, id)
		if err != nil {
			switch {
			case errors.Is(err, docker.ErrContainerNotFound):
				Error(w, http.StatusNotFound, err)
			default:
				Error(w, http.StatusInternalServerError, err)
			}
			return
		}
		resp := toContainerDetailResponse(detail)

		// If running, fetch stats snapshot and populate live metric fields
		if detail.State.Running {
			if stats, err := ds.GetContainerStats(r.Context(), actor.Username, id); err == nil && stats != nil {
				resp.CPUPercent = stats.CPUPercent
				resp.MemUsed = stats.MemUsed
				resp.MemLimit = stats.MemLimit
				resp.NetRx = stats.NetRx
				resp.NetTx = stats.NetTx
				resp.BlockRead = stats.BlockRead
				resp.BlockWrite = stats.BlockWrite
				resp.PIDs = stats.PIDs
			}
		}

		JSON(w, http.StatusOK, resp)
	}
}

func GetContainerLogsHandler(ds *docker.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		id := chi.URLParam(r, "id")
		tail := 50
		if tStr := r.URL.Query().Get("tail"); tStr != "" {
			if t, err := strconv.Atoi(tStr); err == nil && t > 0 {
				tail = t
			}
		}
		logs, err := ds.GetContainerLogs(r.Context(), actor.Username, id, tail)
		if err != nil {
			switch {
			case errors.Is(err, docker.ErrContainerNotFound):
				Error(w, http.StatusNotFound, err)
			default:
				Error(w, http.StatusInternalServerError, err)
			}
			return
		}
		if logs == nil {
			logs = []docker.LogEntry{}
		}
		JSON(w, http.StatusOK, logs)
	}
}

func GetContainerStatsHandler(ds *docker.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		id := chi.URLParam(r, "id")
		stats, err := ds.GetContainerStats(r.Context(), actor.Username, id)
		if err != nil {
			switch {
			case errors.Is(err, docker.ErrContainerNotFound):
				Error(w, http.StatusNotFound, err)
			default:
				Error(w, http.StatusInternalServerError, err)
			}
			return
		}
		JSON(w, http.StatusOK, stats)
	}
}

func RemoveContainerHandler(ds *docker.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		id := chi.URLParam(r, "id")
		if err := ds.RemoveContainer(r.Context(), actor.Username, id); err != nil {
			switch {
			case errors.Is(err, docker.ErrPermissionDenied):
				Error(w, http.StatusForbidden, err)
			case errors.Is(err, docker.ErrContainerNotFound):
				Error(w, http.StatusNotFound, err)
			default:
				Error(w, http.StatusInternalServerError, err)
			}
			return
		}
		JSON(w, http.StatusOK, DockerActionResponse{Success: true, Message: "container removed"})
	}
}

func StartContainerHandler(ds *docker.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		id := chi.URLParam(r, "id")
		handleContainerAction(w, r, ds, actor.Username, id, ds.StartContainer, "container started")
	}
}

func StopContainerHandler(ds *docker.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		id := chi.URLParam(r, "id")
		handleContainerAction(w, r, ds, actor.Username, id, ds.StopContainer, "container stopped")
	}
}

func RestartContainerHandler(ds *docker.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		id := chi.URLParam(r, "id")
		handleContainerAction(w, r, ds, actor.Username, id, ds.RestartContainer, "container restarted")
	}
}

type containerActionFn func(ctx context.Context, actor, id string) error

func handleContainerAction(w http.ResponseWriter, r *http.Request, ds *docker.Service, actor, id string, fn containerActionFn, msg string) {
	if err := fn(r.Context(), actor, id); err != nil {
		switch {
		case errors.Is(err, docker.ErrPermissionDenied):
			Error(w, http.StatusForbidden, err)
		case errors.Is(err, docker.ErrContainerNotFound):
			Error(w, http.StatusNotFound, err)
		case errors.Is(err, docker.ErrIDRequired):
			Error(w, http.StatusBadRequest, err)
		default:
			Error(w, http.StatusInternalServerError, err)
		}
		return
	}
	JSON(w, http.StatusOK, DockerActionResponse{Success: true, Message: msg})
}
