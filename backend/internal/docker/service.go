package docker

import (
	"context"
	"errors"
	"fmt"

	"github.com/ullashroy/poco-server/backend/internal/audit"
)

type Service struct {
	lister     ContainerLister
	inspector  ContainerInspector
	lifecycler ContainerLifecycler
	logger     ContainerLogger
	statter    ContainerStatter
	remover    ContainerRemover
	audit      *audit.Service
	authorizer Authorizer
}

func NewService(
	lister ContainerLister,
	inspector ContainerInspector,
	lifecycler ContainerLifecycler,
	logger ContainerLogger,
	statter ContainerStatter,
	remover ContainerRemover,
	audit *audit.Service,
	authorizer Authorizer,
) *Service {
	return &Service{
		lister:     lister,
		inspector:  inspector,
		lifecycler: lifecycler,
		logger:     logger,
		statter:    statter,
		remover:    remover,
		audit:      audit,
		authorizer: authorizer,
	}
}

func (s *Service) ListContainers(ctx context.Context, actor string) ([]ContainerSummary, error) {
	if err := s.authorizer.Authorize(ctx, actor, OpContainerList); err != nil {
		return nil, err
	}
	return s.lister.ListContainers(ctx)
}

func (s *Service) GetContainer(ctx context.Context, actor, id string) (*ContainerDetail, error) {
	if err := s.authorizer.Authorize(ctx, actor, OpContainerInspect); err != nil {
		return nil, err
	}
	if id == "" {
		return nil, ErrIDRequired
	}
	detail, err := s.inspector.InspectContainer(ctx, id)
	if err != nil {
		return nil, mapClientError(err)
	}
	return detail, nil
}

func (s *Service) GetContainerLogs(ctx context.Context, actor, id string, tail int) ([]LogEntry, error) {
	if err := s.authorizer.Authorize(ctx, actor, OpContainerLogs); err != nil {
		return nil, err
	}
	if id == "" {
		return nil, ErrIDRequired
	}
	entries, err := s.logger.GetContainerLogs(ctx, id, tail)
	if err != nil {
		return nil, mapClientError(err)
	}
	return entries, nil
}

func (s *Service) GetContainerStats(ctx context.Context, actor, id string) (*ContainerStatsResult, error) {
	if err := s.authorizer.Authorize(ctx, actor, OpContainerStats); err != nil {
		return nil, err
	}
	if id == "" {
		return nil, ErrIDRequired
	}
	stats, err := s.statter.GetContainerStats(ctx, id)
	if err != nil {
		return nil, mapClientError(err)
	}
	return stats, nil
}

func (s *Service) RemoveContainer(ctx context.Context, actor, id string) error {
	if err := s.authorizer.Authorize(ctx, actor, OpContainerRemove); err != nil {
		return err
	}
	if id == "" {
		return ErrIDRequired
	}
	if err := s.remover.RemoveContainer(ctx, id); err != nil {
		s.auditLog(audit.LogRequest{
			Action:  audit.ActionContainerStop,
			Actor:   actor,
			Target:  id,
			Status:  audit.StatusFailure,
			Message: err.Error(),
		})
		return mapClientError(err)
	}
	s.auditLog(audit.LogRequest{
		Action:   audit.ActionContainerStop,
		Actor:    actor,
		Target:   id,
		Status:   audit.StatusSuccess,
		Metadata: map[string]any{"container_id": id, "action": "remove"},
	})
	return nil
}

func (s *Service) StartContainer(ctx context.Context, actor, id string) error {
	return s.containerAction(ctx, actor, id, OpContainerStart, audit.ActionContainerStart, s.lifecycler.StartContainer)
}

func (s *Service) StopContainer(ctx context.Context, actor, id string) error {
	return s.containerAction(ctx, actor, id, OpContainerStop, audit.ActionContainerStop, s.lifecycler.StopContainer)
}

func (s *Service) RestartContainer(ctx context.Context, actor, id string) error {
	return s.containerAction(ctx, actor, id, OpContainerRestart, audit.ActionContainerRestart, s.lifecycler.RestartContainer)
}

type actionFunc func(context.Context, string) error

func (s *Service) containerAction(ctx context.Context, actor, id string, op Operation, auditAction audit.Action, fn actionFunc) error {
	if err := s.authorizer.Authorize(ctx, actor, op); err != nil {
		return err
	}
	if id == "" {
		return ErrIDRequired
	}
	if err := fn(ctx, id); err != nil {
		s.auditLog(audit.LogRequest{
			Action:  auditAction,
			Actor:   actor,
			Target:  id,
			Status:  audit.StatusFailure,
			Message: err.Error(),
		})
		return mapClientError(err)
	}
	meta := map[string]any{"container_id": id}
	detail, detailErr := s.inspector.InspectContainer(ctx, id)
	if detailErr == nil {
		meta["container_name"] = detail.Name
		meta["image"] = detail.Image
		meta["project"] = detail.Labels["com.docker.compose.project"]
	}
	s.auditLog(audit.LogRequest{
		Action:   auditAction,
		Actor:    actor,
		Target:   id,
		Status:   audit.StatusSuccess,
		Metadata: meta,
	})
	return nil
}

func (s *Service) ListProjects(ctx context.Context, actor string) ([]Project, error) {
	if err := s.authorizer.Authorize(ctx, actor, OpProjectList); err != nil {
		return nil, err
	}
	containers, err := s.lister.ListContainers(ctx)
	if err != nil {
		return nil, err
	}
	pm := make(map[string]*Project)
	for _, c := range containers {
		pn := c.Project
		if pn == "" {
			pn = "standalone"
		}
		p, ok := pm[pn]
		if !ok {
			p = &Project{
				Name:       pn,
				WorkingDir: c.WorkingDir,
				Running:    true,
				Healthy:    true,
			}
			pm[pn] = p
		}
		p.Containers = append(p.Containers, c)
		p.ContainerCount++
		if c.State != "running" {
			p.Running = false
		}
	}
	result := make([]Project, 0, len(pm))
	for _, p := range pm {
		result = append(result, *p)
	}
	return result, nil
}

func (s *Service) GetProject(ctx context.Context, actor, name string) (*Project, error) {
	if err := s.authorizer.Authorize(ctx, actor, OpProjectInspect); err != nil {
		return nil, err
	}
	if name == "" {
		return nil, ErrNameRequired
	}
	projects, err := s.ListProjects(ctx, actor)
	if err != nil {
		return nil, err
	}
	for _, p := range projects {
		if p.Name == name {
			return &p, nil
		}
	}
	return nil, ErrProjectNotFound
}

func (s *Service) StartProject(ctx context.Context, actor, name string) (*ProjectOperationResult, error) {
	return s.projectAction(ctx, actor, name, OpProjectUp, audit.ActionProjectUp, "up", s.lifecycler.StartContainer)
}

func (s *Service) StopProject(ctx context.Context, actor, name string) (*ProjectOperationResult, error) {
	return s.projectAction(ctx, actor, name, OpProjectDown, audit.ActionProjectDown, "down", s.lifecycler.StopContainer)
}

func (s *Service) RestartProject(ctx context.Context, actor, name string) (*ProjectOperationResult, error) {
	return s.projectAction(ctx, actor, name, OpProjectRestart, audit.ActionProjectRestart, "restart", s.lifecycler.RestartContainer)
}

func (s *Service) projectAction(ctx context.Context, actor, name string, op Operation, auditAction audit.Action, actionLabel string, fn actionFunc) (*ProjectOperationResult, error) {
	if err := s.authorizer.Authorize(ctx, actor, op); err != nil {
		return nil, err
	}
	if name == "" {
		return nil, ErrNameRequired
	}
	project, err := s.GetProject(ctx, actor, name)
	if err != nil {
		return nil, err
	}
	result := ProjectOperationResult{
		ProjectName: name,
		Action:      actionLabel,
	}
	for _, c := range project.Containers {
		car := ContainerActionResult{
			ContainerID:   c.ID,
			ContainerName: c.Name,
			Action:        actionLabel,
		}
		if err := fn(ctx, c.ID); err != nil {
			car.Success = false
			car.Error = err.Error()
			result.Failed++
		} else {
			car.Success = true
			result.Succeeded++
		}
		result.Results = append(result.Results, car)
		auditTarget := c.ID
		if c.Name != "" {
			auditTarget = c.Name
		}
		status := audit.StatusSuccess
		msg := ""
		if !car.Success {
			status = audit.StatusFailure
			msg = car.Error
		}
		s.auditLog(audit.LogRequest{
			Action:  auditAction,
			Actor:   actor,
			Target:  auditTarget,
			Status:  status,
			Message: msg,
			Metadata: map[string]any{
				"project":        name,
				"container_id":   c.ID,
				"container_name": c.Name,
				"image":          c.Image,
			},
		})
	}
	return &result, nil
}

func (s *Service) auditLog(req audit.LogRequest) {
	if s.audit != nil {
		s.audit.Log(req)
	}
}

func mapClientError(err error) error {
	if err == nil {
		return nil
	}
	var apiErr *DockerAPIError
	if errors.As(err, &apiErr) {
		switch apiErr.StatusCode {
		case 404:
			return ErrContainerNotFound
		case 0:
			return ErrDockerUnavailable
		default:
			return fmt.Errorf("docker operation failed: %w", err)
		}
	}
	return err
}
