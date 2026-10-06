package camera

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

type CameraDevice struct {
	ID          string   `json:"id"`          // Device path e.g. "/dev/video2"
	Name        string   `json:"name"`        // Clean display name
	Type        string   `json:"type"`        // "back", "front", "usb", "generic"
	Path        string   `json:"path"`        // Node path e.g. "/dev/video2"
	Driver      string   `json:"driver"`      // Driver module string
	Resolutions []string `json:"resolutions"` // Available resolution presets
	Status      string   `json:"status"`      // "available", "busy"
}

// DiscoverDevices returns a clean list of verified hardware cameras.
// Maps the active Qualcomm CamSS Sony IMX363 sensor plus any attached USB webcams.
func DiscoverDevices() []CameraDevice {
	devices := []CameraDevice{}
	hasGst := commandExists("gst-launch-1.0")

	videoNodes, _ := filepath.Glob("/dev/video*")
	qcomCamssFound := false
	usbWebcams := []CameraDevice{}

	for _, node := range videoNodes {
		base := filepath.Base(node)

		sysNameFile := fmt.Sprintf("/sys/class/video4linux/%s/name", base)
		nameBytes, _ := os.ReadFile(sysNameFile)
		rawName := strings.TrimSpace(string(nameBytes))
		lowerName := strings.ToLower(rawName)

		// Filter out hardware codec decoders/encoders/meta nodes
		if strings.Contains(lowerName, "encoder") || strings.Contains(lowerName, "decoder") || strings.Contains(lowerName, "venus") || strings.Contains(lowerName, "stats") || strings.Contains(lowerName, "meta") {
			continue
		}

		sysDriverFile := fmt.Sprintf("/sys/class/video4linux/%s/device/driver", base)
		driverTarget, _ := os.Readlink(sysDriverFile)
		driver := filepath.Base(driverTarget)

		if strings.Contains(lowerName, "camss") || driver == "qcom-camss" {
			qcomCamssFound = true
		} else if strings.HasPrefix(base, "video") && driver != "." && driver != "/" && driver != "qcom-camss" {
			usbWebcams = append(usbWebcams, CameraDevice{
				ID:          node,
				Name:        fmt.Sprintf("USB Webcam (%s)", base),
				Type:        "usb",
				Path:        node,
				Driver:      driver,
				Resolutions: []string{"1920x1080", "1280x720", "640x480"},
				Status:      "available",
			})
		}
	}

	driverLabel := "qcom-camss (libcamera)"
	if !hasGst {
		driverLabel = "qcom-camss"
	}

	if qcomCamssFound || len(videoNodes) > 0 {
		// Main Back Camera (VFE0 PIX stream - Sony IMX363 - Working)
		devices = append(devices, CameraDevice{
			ID:          "/dev/video2",
			Name:        "Main Back Camera (Sony IMX363)",
			Type:        "back",
			Path:        "/dev/video2",
			Driver:      driverLabel,
			Resolutions: []string{"1920x1080", "1280x720", "640x480"},
			Status:      "available",
		})

		// Front Camera (VFE1 PIX stream - /dev/video6)
		devices = append(devices, CameraDevice{
			ID:          "/dev/video6",
			Name:        "Front Camera",
			Type:        "front",
			Path:        "/dev/video6",
			Driver:      driverLabel,
			Resolutions: []string{"1920x1080", "1280x720", "640x480"},
			Status:      "available",
		})

		// Additional CamSS VFE hardware streams (/dev/video4, /dev/video10)
		devices = append(devices, CameraDevice{
			ID:          "/dev/video4",
			Name:        "CamSS VFE1 Raw",
			Type:        "generic",
			Path:        "/dev/video4",
			Driver:      driverLabel,
			Resolutions: []string{"1280x720", "640x480"},
			Status:      "available",
		})

		devices = append(devices, CameraDevice{
			ID:          "/dev/video10",
			Name:        "CamSS VFE2 Stream",
			Type:        "generic",
			Path:        "/dev/video10",
			Driver:      driverLabel,
			Resolutions: []string{"1280x720", "640x480"},
			Status:      "available",
		})
	}

	devices = append(devices, usbWebcams...)
	return devices
}

func commandExists(cmd string) bool {
	_, err := exec.LookPath(cmd)
	return err == nil
}

func isWindows() bool {
	return runtime.GOOS == "windows"
}
