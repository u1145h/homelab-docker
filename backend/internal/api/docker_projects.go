package api

import (
	"context"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/ullashroy/poco-server/backend/internal/auth"
	"github.com/ullashroy/poco-server/backend/internal/docker"
)

func ListProjectsHandler(ds *docker.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		projects, err := ds.ListProjects(r.Context(), actor.Username)
		if err != nil {
			Error(w, http.StatusInternalServerError, err)
			return
		}
		resp := make([]ProjectResponse, 0, len(projects))
		for _, p := range projects {
			resp = append(resp, toProjectResponse(p))
		}
		JSON(w, http.StatusOK, resp)
	}
}

func GetProjectHandler(ds *docker.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		name := chi.URLParam(r, "project")
		project, err := ds.GetProject(r.Context(), actor.Username, name)
		if err != nil {
			switch {
			case errors.Is(err, docker.ErrProjectNotFound):
				Error(w, http.StatusNotFound, err)
			default:
				Error(w, http.StatusInternalServerError, err)
			}
			return
		}
		JSON(w, http.StatusOK, toProjectResponse(*project))
	}
}

func StartProjectHandler(ds *docker.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		name := chi.URLParam(r, "project")
		handleProjectAction(w, r, ds, actor.Username, name, ds.StartProject)
	}
}

func StopProjectHandler(ds *docker.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		name := chi.URLParam(r, "project")
		handleProjectAction(w, r, ds, actor.Username, name, ds.StopProject)
	}
}

func RestartProjectHandler(ds *docker.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		name := chi.URLParam(r, "project")
		handleProjectAction(w, r, ds, actor.Username, name, ds.RestartProject)
	}
}

type projectActionFn func(ctx context.Context, actor, name string) (*docker.ProjectOperationResult, error)

func handleProjectAction(w http.ResponseWriter, r *http.Request, ds *docker.Service, actor, name string, fn projectActionFn) {
	result, err := fn(r.Context(), actor, name)
	if err != nil {
		switch {
		case errors.Is(err, docker.ErrPermissionDenied):
			Error(w, http.StatusForbidden, err)
		case errors.Is(err, docker.ErrProjectNotFound):
			Error(w, http.StatusNotFound, err)
		case errors.Is(err, docker.ErrNameRequired):
			Error(w, http.StatusBadRequest, err)
		default:
			Error(w, http.StatusInternalServerError, err)
		}
		return
	}
	JSON(w, http.StatusOK, toProjectOperationResponse(result))
}
