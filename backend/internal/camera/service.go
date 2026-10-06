package camera

import (
	"context"
	"net/http"
	"sync"
)

type Service struct {
	mu            sync.RWMutex
	streamManager *StreamManager
}

func NewService() *Service {
	return &Service{
		streamManager: NewStreamManager(),
	}
}

func (s *Service) ListDevices() []CameraDevice {
	return DiscoverDevices()
}

func (s *Service) StreamFeed(w http.ResponseWriter, r *http.Request, devicePath string, resolution string) {
	s.streamManager.ServeMJPEGStream(w, r, devicePath, resolution)
}

func (s *Service) StreamFeedWS(w http.ResponseWriter, r *http.Request, devicePath string, resolution string) {
	s.streamManager.ServeWebSocketStream(w, r, devicePath, resolution)
}

func (s *Service) TakeSnapshot(ctx context.Context, devicePath string) ([]byte, error) {
	return s.streamManager.GetSnapshot(ctx, devicePath)
}
