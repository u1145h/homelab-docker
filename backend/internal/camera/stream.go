package camera

import (
	"bytes"
	"context"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	"io"
	"log"
	"math"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

type StreamManager struct {
	mu            sync.Mutex
	activeStreams map[string]context.CancelFunc
}

func NewStreamManager() *StreamManager {
	return &StreamManager{
		activeStreams: make(map[string]context.CancelFunc),
	}
}

// findBinary resolves the absolute path of a binary.
func findBinary(name string) string {
	if p, err := exec.LookPath(name); err == nil {
		return p
	}
	for _, dir := range []string{"/usr/bin", "/usr/local/bin", "/bin", "/opt/bin"} {
		p := dir + "/" + name
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return ""
}

// sendMJPEGFrame writes a single JPEG frame to the HTTP response writer using multipart standard.
func sendMJPEGFrame(w http.ResponseWriter, flusher http.Flusher, frame []byte) bool {
	header := fmt.Sprintf("--frame\r\nContent-Type: image/jpeg\r\nContent-Length: %d\r\n\r\n", len(frame))
	if _, err := io.WriteString(w, header); err != nil {
		return false
	}
	if _, err := w.Write(frame); err != nil {
		return false
	}
	if _, err := io.WriteString(w, "\r\n"); err != nil {
		return false
	}
	flusher.Flush()
	return true
}

func (sm *StreamManager) ServeMJPEGStream(w http.ResponseWriter, r *http.Request, devicePath string, resolution string) {
	ctx := r.Context()

	w.Header().Set("Content-Type", "multipart/x-mixed-replace; boundary=frame")
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Header().Set("Connection", "close")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	if resolution == "" {
		resolution = "1280x720"
	}

	gstPath := findBinary("gst-launch-1.0")
	ffmpegPath := findBinary("ffmpeg")
	libcamerifyPath := findBinary("libcamerify")

	log.Printf("[Camera] Available capture binaries: gst=%q ffmpeg=%q libcamerify=%q", gstPath, ffmpegPath, libcamerifyPath)
	log.Printf("[Camera] Target stream request: device=%s resolution=%s", devicePath, resolution)

	// Primary low-latency backend: GStreamer native libcamerasrc
	if gstPath != "" {
		cleanStaleLocks(devicePath)
		sm.streamViaGStreamerLibcamera(ctx, w, flusher, devicePath, resolution, gstPath)
		return
	}

	// Fallback to ffmpeg
	if ffmpegPath != "" && strings.HasPrefix(devicePath, "/dev/video") {
		cleanStaleLocks(devicePath)
		sm.streamViaHardwareProcess(ctx, w, flusher, devicePath, resolution, libcamerifyPath, ffmpegPath)
		return
	}

	// Fallback to animated simulated feed
	sm.streamSimulatedFeed(ctx, w, flusher, devicePath, resolution)
}

func (sm *StreamManager) streamViaGStreamerLibcamera(
	ctx context.Context, w http.ResponseWriter, flusher http.Flusher,
	devicePath, resolution, gstPath string,
) {
	log.Printf("[Camera] Launching zero-latency GStreamer libcamerasrc pipeline for %s (%s)", devicePath, resolution)

	// Target dimensions
	width, height := 1280, 720
	if strings.Contains(resolution, "640") {
		width, height = 640, 480
	} else if strings.Contains(resolution, "1920") {
		width, height = 1920, 1080
	}

	// Cap at 15 fps to keep CPU/thermal load manageable on the SoC.
	// The hardware ISP on Qualcomm CamSS can deliver much higher rates but
	// 15 fps is plenty for a monitoring stream and halves encoding work vs 30 fps.
	capsStr := fmt.Sprintf("video/x-raw,width=%d,height=%d,framerate=15/1", width, height)

	// Prefer the Qualcomm hardware JPEG encoder (v4l2jpegenc) if available;
	// fall back to software jpegenc so the CPU ISP stays cold.
	jpegEncoder := "v4l2jpegenc"
	// Quick probe: if v4l2jpegenc is not in the gst registry, use software
	probe := exec.Command(gstPath, "inspect", "v4l2jpegenc")
	if probe.Run() != nil {
		jpegEncoder = "jpegenc quality=60"
	}

	log.Printf("[Camera] Using JPEG encoder: %s", jpegEncoder)

	// Low-latency GStreamer pipeline for Qualcomm CamSS / libcamera:
	// - Back Camera (/dev/video2): libcamerasrc (Camera 0)
	// - Front Camera (/dev/video6): libcamerasrc camera-name=1 (Camera 1)
	// - USB Webcams: v4l2src device=/dev/videoX
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

	var stderrBuf bytes.Buffer
	cmd.Stderr = &stderrBuf

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		log.Printf("[Camera] GStreamer StdoutPipe error: %v", err)
		sm.streamSimulatedFeed(ctx, w, flusher, devicePath, resolution)
		return
	}

	if err := cmd.Start(); err != nil {
		log.Printf("[Camera] GStreamer cmd.Start() error: %v", err)
		sm.streamSimulatedFeed(ctx, w, flusher, devicePath, resolution)
		return
	}
	log.Printf("[Camera] GStreamer libcamerasrc process started PID=%d", cmd.Process.Pid)

	defer func() {
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
		_ = cmd.Wait()
		if s := stderrBuf.String(); s != "" {
			log.Printf("[Camera] GStreamer stderr: %s", strings.TrimSpace(s))
		}
		log.Printf("[Camera] GStreamer stream stopped for %s", devicePath)
	}()

	// Single-frame channel to prevent buffering queue buildup (always keeps only the LATEST frame)
	frameCh := make(chan []byte, 1)
	go func() {
		defer close(frameCh)
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

					// Push frame into buffer, discarding stale frame if consumer hasn't read it yet
					select {
					case frameCh <- frame:
					default:
						// Drain old frame and insert newest live frame
						select {
						case <-frameCh:
						default:
						}
						select {
						case frameCh <- frame:
						default:
						}
					}

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
	}()

	// Instant status frame placeholder
	placeholderFrame := generateStatusFrame(640, 360, devicePath, "INITIALIZING CAMERA SENSOR...")
	if !sendMJPEGFrame(w, flusher, placeholderFrame) {
		return
	}

	keepalive := time.NewTicker(600 * time.Millisecond)
	defer keepalive.Stop()

	firstRealFrame := true
	startTime := time.Now()
	for {
		select {
		case <-ctx.Done():
			log.Printf("[Camera] Client disconnected from %s", devicePath)
			return
		case frame, ok := <-frameCh:
			if !ok {
				log.Printf("[Camera] GStreamer pipeline ended for %s", devicePath)
				return
			}
			if firstRealFrame {
				firstRealFrame = false
				log.Printf("[Camera] ✓ SUCCESS: First real frame received from hardware (%d bytes)", len(frame))
			}
			if !sendMJPEGFrame(w, flusher, frame) {
				return
			}
		case <-keepalive.C:
			if firstRealFrame {
				if time.Since(startTime) > 3*time.Second {
					offlineFrame := generateStatusFrame(640, 360, devicePath, fmt.Sprintf("%s: SENSOR OFFLINE / BUSY", strings.ToUpper(filepath.Base(devicePath))))
					if !sendMJPEGFrame(w, flusher, offlineFrame) {
						return
					}
				} else {
					if !sendMJPEGFrame(w, flusher, placeholderFrame) {
						return
					}
				}
			}
		}
	}
}

func (sm *StreamManager) streamViaHardwareProcess(
	ctx context.Context, w http.ResponseWriter, flusher http.Flusher,
	devicePath, resolution, libcamerifyPath, ffmpegPath string,
) {
	var cmd *exec.Cmd
	ffmpegArgs := []string{
		"-hide_banner", "-loglevel", "warning",
		"-f", "v4l2", "-input_format", "uyvy422",
		"-i", devicePath,
		"-f", "mjpeg", "-q:v", "5", "pipe:1",
	}

	if libcamerifyPath != "" {
		args := append([]string{ffmpegPath}, ffmpegArgs...)
		cmd = exec.CommandContext(ctx, libcamerifyPath, args...)
	} else {
		cmd = exec.CommandContext(ctx, ffmpegPath, ffmpegArgs...)
	}

	var stderrBuf bytes.Buffer
	cmd.Stderr = &stderrBuf

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		sm.streamSimulatedFeed(ctx, w, flusher, devicePath, resolution)
		return
	}

	if err := cmd.Start(); err != nil {
		sm.streamSimulatedFeed(ctx, w, flusher, devicePath, resolution)
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
					frame := data[soi : eoi+2]
					if !sendMJPEGFrame(w, flusher, frame) {
						return
					}
					remaining := data[eoi+2:]
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

func (sm *StreamManager) streamSimulatedFeed(ctx context.Context, w http.ResponseWriter, flusher http.Flusher, devicePath string, resolution string) {
	// 4 FPS for the simulated feed — enough to show liveness without
	// burning CPU cycles on a device that already runs hot.
	ticker := time.NewTicker(250 * time.Millisecond) // ~4 FPS
	defer ticker.Stop()

	frameIdx := 0
	width, height := 640, 480
	if strings.Contains(resolution, "1280") {
		width, height = 1280, 720
	} else if strings.Contains(resolution, "1920") {
		width, height = 1920, 1080
	}

	camLabel := "MAIN BACK CAMERA (Sony IMX363)"
	if strings.Contains(devicePath, "video3") || strings.Contains(devicePath, "front") {
		camLabel = "FRONT CAMERA"
	}

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			frameIdx++
			img := generateSimulatedFrame(width, height, camLabel, devicePath, frameIdx)
			var buf bytes.Buffer
			_ = jpeg.Encode(&buf, img, &jpeg.Options{Quality: 75})
			if !sendMJPEGFrame(w, flusher, buf.Bytes()) {
				return
			}
		}
	}
}

func (sm *StreamManager) GetSnapshot(ctx context.Context, devicePath string) ([]byte, error) {
	gstPath := findBinary("gst-launch-1.0")

	// Try GStreamer single frame capture targeting specific device
	if gstPath != "" {
		var pipelineArgs []string
		if strings.Contains(devicePath, "video6") || strings.Contains(devicePath, "front") {
			pipelineArgs = []string{
				"libcamerasrc", "camera-name=1", "num-buffers=1", "!",
				"videoconvert", "!",
				"jpegenc", "quality=90", "!",
				"fdsink", "fd=1",
			}
		} else if strings.HasPrefix(devicePath, "/dev/video") && !strings.Contains(devicePath, "video2") {
			pipelineArgs = []string{
				"v4l2src", fmt.Sprintf("device=%s", devicePath), "num-buffers=1", "!",
				"videoconvert", "!",
				"jpegenc", "quality=90", "!",
				"fdsink", "fd=1",
			}
		} else {
			pipelineArgs = []string{
				"libcamerasrc", "num-buffers=1", "!",
				"videoconvert", "!",
				"jpegenc", "quality=90", "!",
				"fdsink", "fd=1",
			}
		}
		cmd := exec.CommandContext(ctx, gstPath, pipelineArgs...)
		var outBuf bytes.Buffer
		cmd.Stdout = &outBuf
		if err := cmd.Run(); err == nil && outBuf.Len() > 0 {
			return outBuf.Bytes(), nil
		}
	}

	// Try FFmpeg v4l2 single frame capture
	if ffmpegPath := findBinary("ffmpeg"); ffmpegPath != "" && strings.HasPrefix(devicePath, "/dev/video") {
		cmd := exec.CommandContext(ctx, ffmpegPath, "-y", "-f", "v4l2", "-i", devicePath, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "mjpeg", "-")
		var outBuf bytes.Buffer
		cmd.Stdout = &outBuf
		if err := cmd.Run(); err == nil && outBuf.Len() > 0 {
			return outBuf.Bytes(), nil
		}
	}

	// Try fswebcam single frame capture
	if fswebcamPath := findBinary("fswebcam"); fswebcamPath != "" && strings.HasPrefix(devicePath, "/dev/video") {
		tmpFile := filepath.Join(os.TempDir(), fmt.Sprintf("snap_%d.jpg", time.Now().UnixNano()))
		cmd := exec.CommandContext(ctx, fswebcamPath, "-d", devicePath, "-r", "1280x720", "--jpeg", "85", "-F", "1", tmpFile)
		if err := cmd.Run(); err == nil {
			data, rErr := os.ReadFile(tmpFile)
			_ = os.Remove(tmpFile)
			if rErr == nil && len(data) > 0 {
				return data, nil
			}
		}
	}

	img := generateSimulatedFrame(640, 480, "CAMERA SNAPSHOT", devicePath, 99)
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 85}); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func cleanStaleLocks(devicePath string) {
	if runtime.GOOS == "linux" {
		_ = exec.Command("pkill", "-9", "-f", "gst-launch-1.0").Run()
		_ = exec.Command("pkill", "-9", "-f", "ffmpeg").Run()
		log.Printf("[Camera] Cleared background capture locks")
	}
}

func generateStatusFrame(w, h int, devicePath, message string) []byte {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	bgColor := color.RGBA{10, 13, 17, 255}
	draw.Draw(img, img.Bounds(), &image.Uniform{bgColor}, image.ZP, draw.Src)

	cx, cy := w/2, h/2
	dotColors := []color.RGBA{
		{169, 182, 101, 255},
		{125, 174, 163, 255},
		{216, 166, 87, 255},
	}
	for i, dc := range dotColors {
		dx := (i - 1) * 28
		for px := cx + dx - 6; px <= cx+dx+6; px++ {
			for py := cy - 6; py <= cy+6; py++ {
				ddx := px - (cx + dx)
				ddy := py - cy
				if ddx*ddx+ddy*ddy <= 36 && px >= 0 && px < w && py >= 0 && py < h {
					img.Set(px, py, dc)
				}
			}
		}
	}

	var buf bytes.Buffer
	_ = jpeg.Encode(&buf, img, &jpeg.Options{Quality: 70})
	return buf.Bytes()
}

func generateSimulatedFrame(w, h int, label, devicePath string, frameIdx int) image.Image {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	bgColor := color.RGBA{15, 18, 22, 255}
	draw.Draw(img, img.Bounds(), &image.Uniform{bgColor}, image.ZP, draw.Src)

	gridColor := color.RGBA{35, 45, 55, 255}
	for x := 0; x < w; x += 40 {
		for y := 0; y < h; y++ {
			img.Set(x, y, gridColor)
		}
	}
	for y := 0; y < h; y += 40 {
		for x := 0; x < w; x++ {
			img.Set(x, y, gridColor)
		}
	}

	cx, cy := w/2, h/2
	r := 50 + int(10*math.Sin(float64(frameIdx)*0.2))
	reticleColor := color.RGBA{169, 182, 101, 255}
	for angle := 0; angle < 360; angle += 2 {
		rad := float64(angle) * math.Pi / 180.0
		rx := cx + int(float64(r)*math.Cos(rad))
		ry := cy + int(float64(r)*math.Sin(rad))
		if rx >= 0 && rx < w && ry >= 0 && ry < h {
			img.Set(rx, ry, reticleColor)
		}
	}
	for i := cx - 70; i <= cx+70; i++ {
		if i >= 0 && i < w {
			img.Set(i, cy, reticleColor)
		}
	}
	for j := cy - 70; j <= cy+70; j++ {
		if j >= 0 && j < h {
			img.Set(cx, j, reticleColor)
		}
	}

	dotColor := color.RGBA{234, 105, 98, 255}
	if (frameIdx/5)%2 == 0 {
		dotColor = color.RGBA{169, 182, 101, 255}
	}
	for dx := -6; dx <= 6; dx++ {
		for dy := -6; dy <= 6; dy++ {
			if dx*dx+dy*dy <= 36 {
				img.Set(30+dx, 30+dy, dotColor)
			}
		}
	}
	return img
}
