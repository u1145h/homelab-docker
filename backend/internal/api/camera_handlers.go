package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/ullashroy/poco-server/backend/internal/camera"
)

func ListCameraDevicesHandler(cs *camera.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		devices := cs.ListDevices()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"devices": devices,
			"count":   len(devices),
		})
	}
}

func CameraStreamHandler(cs *camera.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		devicePath := r.URL.Query().Get("device")
		resolution := r.URL.Query().Get("res")

		if devicePath == "" {
			devices := cs.ListDevices()
			if len(devices) > 0 {
				devicePath = devices[0].Path
			} else {
				devicePath = "/dev/video0"
			}
		}

		cs.StreamFeed(w, r, devicePath, resolution)
	}
}

// CameraWSStreamHandler upgrades the connection to WebSocket and streams JPEG
// frames as binary messages. This avoids Cloudflare HTTP response buffering
// which is the main source of MJPEG latency on tunnelled connections.
func CameraWSStreamHandler(cs *camera.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		devicePath := r.URL.Query().Get("device")
		resolution := r.URL.Query().Get("res")

		if devicePath == "" {
			devices := cs.ListDevices()
			if len(devices) > 0 {
				devicePath = devices[0].Path
			} else {
				devicePath = "/dev/video0"
			}
		}

		cs.StreamFeedWS(w, r, devicePath, resolution)
	}
}

func CameraSnapshotHandler(cs *camera.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		devicePath := r.URL.Query().Get("device")
		if devicePath == "" {
			devices := cs.ListDevices()
			if len(devices) > 0 {
				devicePath = devices[0].Path
			} else {
				devicePath = "/dev/video0"
			}
		}

		data, err := cs.TakeSnapshot(r.Context(), devicePath)
		if err != nil {
			http.Error(w, "Failed to capture snapshot", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "image/jpeg")
		w.Header().Set("Content-Disposition", "attachment; filename=\"camera-snapshot.jpg\"")
		w.Header().Set("Content-Length", strconv.Itoa(len(data)))
		_, _ = w.Write(data)
	}
}
