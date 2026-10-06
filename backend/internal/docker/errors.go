package docker

import "errors"

var (
	ErrContainerNotFound = errors.New("container not found")
	ErrProjectNotFound   = errors.New("project not found")
	ErrIDRequired        = errors.New("container id is required")
	ErrNameRequired      = errors.New("project name is required")
	ErrPermissionDenied  = errors.New("permission denied")
	ErrDockerUnavailable = errors.New("docker daemon is not available")
)

type DockerAPIError struct {
	StatusCode int
	Message    string
}

func (e *DockerAPIError) Error() string {
	return e.Message
}
