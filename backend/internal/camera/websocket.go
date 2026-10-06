package camera

import (
	"bytes"
	"context"
	"fmt"
	"image/jpeg"
	"log"
	"net/http"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// cameraWSUpgrader accepts connections from any origin — auth is validated
// upstream by the JWT Bearer token middleware.
var cameraWSUpgrader = websocket.Upgrader{
	// Large write buffer: JPEG frames at 720p can be 40 KB each.
	ReadBufferSize:  1024,
	WriteBufferSize: 65536,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

// ServeWebSocketStream upgrades the HTTP connection to a WebSocket and pushes
// each JPEG frame as a binary message. This bypasses Cloudflare's HTTP
// response buffering — Cloudflare proxies WebSocket frames immediately without
// batching them, unlike MJPEG multipart which it buffers aggressively.
//
// Protocol (server → client): binary messages, each one is a complete JPEG.
// Protocol (client → server): any message is silently ignored; close frame
// causes the stream to shut down.
func (sm *StreamManager) ServeWebSocketStream(
	w http.ResponseWriter, r *http.Request,
	devicePath string, resolution string,
) {
	conn, err := cameraWSUpgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[CameraWS] WebSocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	log.Printf("[CameraWS] Client connected: device=%s res=%s remote=%s",
		devicePath, resolution, r.RemoteAddr)

	if resolution == "" {
		resolution = "1280x720"
	}

	// Derive a cancellable context so the capture goroutine stops the moment
	// the WebSocket client disconnects.
	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	// Single-slot frame channel — only the LATEST frame is buffered so slow
	// network paths never accumulate stale frames.
	frameCh := make(chan []byte, 1)

	go func() {
		defer close(frameCh)
		sm.captureFrames(ctx, devicePath, resolution, frameCh)
	}()

	// Read pump: detect client disconnect (WS close frame or error) and
	// immediately cancel the capture context.
	go func() {
		conn.SetReadDeadline(time.Time{})
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				cancel()
				return
			}
		}
	}()

	var mu sync.Mutex
	for {
		select {
		case <-ctx.Done():
			log.Printf("[CameraWS] Stream stopped: %s", r.RemoteAddr)
			return
		case frame, ok := <-frameCh:
			if !ok {
				log.Printf("[CameraWS] Frame pipeline ended for %s", devicePath)
				return
			}
			mu.Lock()
			_ = conn.SetWriteDeadline(time.Now().Add(2 * time.Second))
			err := conn.WriteMessage(websocket.BinaryMessage, frame)
			mu.Unlock()
			if err != nil {
				log.Printf("[CameraWS] Write error (client gone): %v", err)
				return
			}
		}
	}
}

// captureFrames selects the best available capture backend and pushes complete
// JPEG frames into frameCh. This is shared between the MJPEG and WebSocket
// code paths so both benefit from the same hardware encoder selection.
func (sm *StreamManager) captureFrames(
	ctx context.Context, devicePath, resolution string,
	frameCh chan []byte,
) {
	gstPath := findBinary("gst-launch-1.0")
	ffmpegPath := findBinary("ffmpeg")
	libcamerifyPath := findBinary("libcamerify")

	if gstPath != "" {
		cleanStaleLocks(devicePath)
		sm.captureViaGStreamer(ctx, devicePath, resolution, gstPath, frameCh)
		return
	}
	if ffmpegPath != "" {
		cleanStaleLocks(devicePath)
		sm.captureViaFFmpeg(ctx, devicePath, ffmpegPath, libcamerifyPath, frameCh)
		return
	}
	sm.captureSimulatedFrames(ctx, devicePath, resolution, frameCh)
}

// pushFrame inserts frame into the single-slot channel, evicting any stale
// frame already waiting so the consumer always gets the NEWEST frame.
func pushFrame(ch chan []byte, frame []byte) {
	select {
	case ch <- frame:
	default:
		select {
		case <-ch:
		default:
		}
		select {
		case ch <- frame:
		default:
		}
	}
}

func (sm *StreamManager) captureViaGStreamer(
	ctx context.Context, devicePath, resolution, gstPath string,
	frameCh chan []byte,
) {
	width, height := 1280, 720
	if len(resolution) >= 3 && resolution[:3] == "640" {
		width, height = 640, 480
	} else if len(resolution) >= 4 && resolution[:4] == "1920" {
		width, height = 1920, 1080
	}

	capsStr := fmt.Sprintf("video/x-raw,width=%d,height=%d,framerate=15/1", width, height)

	jpegEncoder := "v4l2jpegenc"
	probe := exec.Command(gstPath, "inspect", "v4l2jpegenc")
	if probe.Run() != nil {
		jpegEncoder = "software"
	}

	var pipelineArgs []string
	if strings.Contains(devicePath, "video6") || strings.Contains(devicePath, "front") {
		pipelineArgs = append(pipelineArgs,
			"libcamerasrc", "camera-name=1", "!",
			"videoconvert", "!",
			"videoscale", "!",
			capsStr, "!",
		)
	} else if strings.HasPrefix(devicePath, "/dev/video") && !strings.Contains(devicePath, "video2") {
		pipelineArgs = append(pipelineArgs,
			"v4l2src", fmt.Sprintf("device=%s", devicePath), "!",
			"videoconvert", "!",
			"videoscale", "!",
			capsStr, "!",
		)
	} else {
		pipelineArgs = append(pipelineArgs,
			"libcamerasrc", "!",
			"videoconvert", "!",
			"videoscale", "!",
			capsStr, "!",
		)
	}
	if jpegEncoder == "v4l2jpegenc" {
		pipelineArgs = append(pipelineArgs, "v4l2jpegenc", "!")
	} else {
		pipelineArgs = append(pipelineArgs, "jpegenc", "quality=60", "!")
	}
	pipelineArgs = append(pipelineArgs,
		"multipartmux", "boundary=frame", "!",
		"fdsink", "fd=1", "sync=false", "async=false",
	)

	cmd := exec.CommandContext(ctx, gstPath, pipelineArgs...)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		sm.captureSimulatedFrames(ctx, devicePath, resolution, frameCh)
		return
	}
	if err := cmd.Start(); err != nil {
		sm.captureSimulatedFrames(ctx, devicePath, resolution, frameCh)
		return
	}
	defer func() {
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
		_ = cmd.Wait()
	}()

	buf := make([]byte, 65536)
	accumulated := bytes.NewBuffer(make([]byte, 0, 2*1024*1024))
	for {
		n, readErr := stdout.Read(buf)
		if n > 0 {
			accumulated.Write(buf[:n])
			data := accumulated.Bytes()
			for {
				soi := bytes.Index(data, []byte{0xFF, 0xD8})
				if soi == -1 {
					accumulated.Reset()
					break
				}
				eoi := bytes.Index(data[soi:], []byte{0xFF, 0xD9})
				if eoi == -1 {
					if soi > 0 {
						remaining := make([]byte, len(data)-soi)
						copy(remaining, data[soi:])
						accumulated.Reset()
						accumulated.Write(remaining)
					}
					break
				}
				frame := make([]byte, eoi+2)
				copy(frame, data[soi:soi+eoi+2])
				pushFrame(frameCh, frame)

				after := soi + eoi + 2
				remaining := make([]byte, len(data)-after)
				copy(remaining, data[after:])
				accumulated.Reset()
				accumulated.Write(remaining)
				data = accumulated.Bytes()
			}
		}
		if readErr != nil {
			return
		}
	}
}

func (sm *StreamManager) captureViaFFmpeg(
	ctx context.Context, devicePath, ffmpegPath, libcamerifyPath string,
	frameCh chan []byte,
) {
	ffmpegArgs := []string{
		"-hide_banner", "-loglevel", "warning",
		"-f", "v4l2", "-input_format", "uyvy422",
		"-i", devicePath,
		"-f", "mjpeg", "-q:v", "5", "pipe:1",
	}
	var cmd *exec.Cmd
	if libcamerifyPath != "" {
		args := append([]string{ffmpegPath}, ffmpegArgs...)
		cmd = exec.CommandContext(ctx, libcamerifyPath, args...)
	} else {
		cmd = exec.CommandContext(ctx, ffmpegPath, ffmpegArgs...)
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil || cmd.Start() != nil {
		sm.captureSimulatedFrames(ctx, devicePath, "1280x720", frameCh)
		return
	}
	defer func() {
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
		_ = cmd.Wait()
	}()

	buf := make([]byte, 65536)
	accumulated := bytes.NewBuffer(make([]byte, 0, 2*1024*1024))
	for {
		select {
		case <-ctx.Done():
			return
		default:
			n, err := stdout.Read(buf)
			if n > 0 {
				accumulated.Write(buf[:n])
				data := accumulated.Bytes()
				soi := bytes.Index(data, []byte{0xFF, 0xD8})
				eoi := bytes.Index(data, []byte{0xFF, 0xD9})
				if soi != -1 && eoi != -1 && eoi > soi {
					frame := make([]byte, eoi+2-soi)
					copy(frame, data[soi:eoi+2])
					pushFrame(frameCh, frame)
					remaining := make([]byte, len(data)-(eoi+2))
					copy(remaining, data[eoi+2:])
					accumulated.Reset()
					accumulated.Write(remaining)
				}
			}
			if err != nil {
				return
			}
		}
	}
}

func (sm *StreamManager) captureSimulatedFrames(
	ctx context.Context, devicePath, resolution string,
	frameCh chan []byte,
) {
	ticker := time.NewTicker(250 * time.Millisecond) // 4 fps — minimal CPU
	defer ticker.Stop()

	width, height := 640, 480
	if len(resolution) >= 4 && resolution[:4] == "1280" {
		width, height = 1280, 720
	} else if len(resolution) >= 4 && resolution[:4] == "1920" {
		width, height = 1920, 1080
	}

	frameIdx := 0
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			frameIdx++
			img := generateSimulatedFrame(width, height, "SIMULATED FEED", devicePath, frameIdx)
			var buf bytes.Buffer
			_ = jpeg.Encode(&buf, img, &jpeg.Options{Quality: 60})
			pushFrame(frameCh, buf.Bytes())
		}
	}
}
