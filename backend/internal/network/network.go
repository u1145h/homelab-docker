package network

import (
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/ullashroy/poco-server/backend/internal/system"
)

type Interface struct {
	Name      string   `json:"name"`
	Up        bool     `json:"up"`
	MTU       int      `json:"mtu"`
	MAC       string   `json:"mac"`
	Addresses []string `json:"addresses"`
	RXBytes   uint64   `json:"rx_bytes"`
	TXBytes   uint64   `json:"tx_bytes"`
	SSID      string   `json:"ssid"`
}

type PublicIPInfo struct {
	IP       string `json:"ip"`
	Location string `json:"location"`
	ASN      string `json:"asn"`
}

type LinkQuality struct {
	Signal  float64 `json:"signal"`
	Latency float64 `json:"latency"`
	Jitter  float64 `json:"jitter"`
	Loss    float64 `json:"loss"`
}

type WifiDetails struct {
	SSID      string `json:"ssid"`
	Security  string `json:"security"`
	Band      string `json:"band"`
	Channel   int    `json:"channel"`
	LinkSpeed int    `json:"link_speed"`
	RSSI      int    `json:"rssi"`
}

type LogEvent struct {
	Time    string `json:"time"`
	Type    string `json:"type"`
	Iface   string `json:"iface"`
	Message string `json:"message"`
}

type SpeedTestResult struct {
	When   string  `json:"when"`
	Down   float64 `json:"down"`
	Up     float64 `json:"up"`
	Ping   float64 `json:"ping"`
	Server string  `json:"server"`
	Link   string  `json:"link"`
}

type Info struct {
	Interfaces []Interface       `json:"interfaces"`
	PublicIP   PublicIPInfo      `json:"public_ip"`
	Gateway    string            `json:"gateway"`
	Wifi       WifiDetails       `json:"wifi_details"`
	Quality    LinkQuality       `json:"link_quality"`
	Logs       []LogEvent        `json:"logs"`
	SpeedTest  []SpeedTestResult `json:"speed_test_history"`
}

var (
	mu            sync.RWMutex
	publicIPCache PublicIPInfo
	pingCache     LinkQuality
	logsCache     []LogEvent
)

func init() {
	initSpeedTest()
	go pollPublicIP()
	go pollPing()
	go generateMockLogs()
}

func pollPublicIP() {
	for {
		resp, err := http.Get("https://ipinfo.io/json")
		if err == nil {
			defer resp.Body.Close()
			body, _ := io.ReadAll(resp.Body)
			var result map[string]interface{}
			if err := json.Unmarshal(body, &result); err == nil {
				mu.Lock()
				if ip, ok := result["ip"].(string); ok {
					publicIPCache.IP = ip
				}
				if city, ok := result["city"].(string); ok {
					publicIPCache.Location = city
				}
				if org, ok := result["org"].(string); ok {
					publicIPCache.ASN = org
				}
				mu.Unlock()
			}
		}
		time.Sleep(1 * time.Hour)
	}
}

func pollPing() {
	for {
		out, err := exec.Command("ping", "-c", "1", "-W", "1", "1.1.1.1").Output()
		var latency float64
		var loss float64 = 100
		if err == nil {
			loss = 0
			lines := strings.Split(string(out), "\n")
			for _, line := range lines {
				if strings.Contains(line, "time=") {
					parts := strings.Split(line, "time=")
					if len(parts) > 1 {
						timeStr := strings.Fields(parts[1])[0]
						latency, _ = strconv.ParseFloat(timeStr, 64)
					}
				}
			}
		}

		mu.Lock()
		pingCache.Latency = latency
		pingCache.Loss = loss
		// Mock jitter and signal for UI
		if loss == 0 {
			pingCache.Jitter = 2.1 + (rand.Float64() * 2)
			pingCache.Signal = 78 + (rand.Float64() * 5)
		} else {
			pingCache.Jitter = 0
			pingCache.Signal = 0
		}
		mu.Unlock()

		time.Sleep(2 * time.Second)
	}
}

func generateMockLogs() {
	endpoints := []struct {
		IP    string
		Host  string
		Port  string
		Iface string
	}{
		{"198.145.29.83", "kernel.org:443", "443", "wlan0"},
		{"1.1.1.1", "cloudflare-dns.com:53", "53", "wlan0"},
		{"140.82.121.4", "api.github.com:443", "443", "eth0"},
		{"192.168.1.1", "gateway.local:80", "80", "wlan0"},
		{"104.26.12.31", "cdn.cloudflare.com:443", "443", "eth0"},
	}

	initialLogs := []LogEvent{
		{Time: time.Now().Add(-1 * time.Minute).Format("15:04:05"), Type: "CONNECT", Iface: "wlan0", Message: "Associated with SSID 'Poco-Home 5G' (Channel 44, RSSI -52 dBm)"},
		{Time: time.Now().Add(-55 * time.Second).Format("15:04:05"), Type: "DHCP", Iface: "wlan0", Message: "DHCP ACK lease 192.168.1.50/24 acquired from Gateway 192.168.1.1"},
		{Time: time.Now().Add(-45 * time.Second).Format("15:04:05"), Type: "DNS", Iface: "wlan0", Message: "Resolved 'api.github.com' -> 140.82.121.4 (RTT 1.8ms)"},
		{Time: time.Now().Add(-30 * time.Second).Format("15:04:05"), Type: "DOWNLOAD", Iface: "wlan0", Message: "Received 3.4 MB from 198.145.29.83:443 (Kernel.org HTTPS) - 14.2 MB/s"},
		{Time: time.Now().Add(-20 * time.Second).Format("15:04:05"), Type: "UPLOAD", Iface: "wlan0", Message: "Transmitted 512 KB to 1.1.1.1:53 (Cloudflare DNS) - 1.1 MB/s"},
		{Time: time.Now().Add(-10 * time.Second).Format("15:04:05"), Type: "CONNECT", Iface: "eth0", Message: "TCP 3-way handshake established with 192.168.1.100:8080"},
	}

	mu.Lock()
	logsCache = initialLogs
	mu.Unlock()

	go func() {
		for {
			time.Sleep(3 * time.Second)
			ep := endpoints[rand.Intn(len(endpoints))]
			nowStr := time.Now().Format("15:04:05")

			var newLog LogEvent
			roll := rand.Intn(100)
			if roll < 45 {
				rxMB := fmt.Sprintf("%.1f", 0.5+rand.Float64()*12.0)
				speedMB := fmt.Sprintf("%.1f", 1.0+rand.Float64()*25.0)
				newLog = LogEvent{
					Time:    nowStr,
					Type:    "DOWNLOAD",
					Iface:   ep.Iface,
					Message: fmt.Sprintf("Received %s MB from %s (%s) - %s MB/s", rxMB, ep.IP, ep.Host, speedMB),
				}
			} else if roll < 80 {
				txKB := fmt.Sprintf("%.0f", 50+rand.Float64()*950)
				speedMB := fmt.Sprintf("%.1f", 0.2+rand.Float64()*5.0)
				newLog = LogEvent{
					Time:    nowStr,
					Type:    "UPLOAD",
					Iface:   ep.Iface,
					Message: fmt.Sprintf("Transmitted %s KB to %s (%s) - %s MB/s", txKB, ep.IP, ep.Host, speedMB),
				}
			} else if roll < 90 {
				ms := fmt.Sprintf("%.1f", 0.8+rand.Float64()*4.0)
				newLog = LogEvent{
					Time:    nowStr,
					Type:    "DNS",
					Iface:   ep.Iface,
					Message: fmt.Sprintf("DNS query '%s' resolved to %s in %sms", ep.Host, ep.IP, ms),
				}
			} else {
				newLog = LogEvent{
					Time:    nowStr,
					Type:    "CONNECT",
					Iface:   ep.Iface,
					Message: fmt.Sprintf("Established active socket connection with %s:%s", ep.IP, ep.Port),
				}
			}

			mu.Lock()
			logsCache = append([]LogEvent{newLog}, logsCache...)
			if len(logsCache) > 100 {
				logsCache = logsCache[:100]
			}
			mu.Unlock()
		}
	}()
}

func readUint(path string) uint64 {
	data, err := os.ReadFile(path)
	if err != nil {
		return 0
	}
	value, err := strconv.ParseUint(strings.TrimSpace(string(data)), 10, 64)
	if err != nil {
		return 0
	}
	return value
}

func getSSID(iface string) string {
	if runtime.GOOS == "windows" {
		out, err := exec.Command("netsh", "wlan", "show", "interfaces").Output()
		if err == nil && !strings.Contains(string(out), "There is no wireless interface") {
			lines := strings.Split(string(out), "\n")
			for _, line := range lines {
				line = strings.TrimSpace(line)
				if strings.HasPrefix(line, "SSID") && !strings.HasPrefix(line, "BSSID") && !strings.HasPrefix(line, "SSID name") {
					parts := strings.SplitN(line, ":", 2)
					if len(parts) == 2 && len(strings.TrimSpace(parts[1])) > 0 {
						return strings.TrimSpace(parts[1])
					}
				}
			}
		}
	}

	out, err := exec.Command("iwgetid", iface, "-r").Output()
	if err == nil && len(strings.TrimSpace(string(out))) > 0 {
		return strings.TrimSpace(string(out))
	}
	out, err = exec.Command("iw", "dev", iface, "link").Output()
	if err == nil {
		lines := strings.Split(string(out), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "SSID:") {
				parts := strings.SplitN(line, ":", 2)
				if len(parts) == 2 && len(strings.TrimSpace(parts[1])) > 0 {
					return strings.TrimSpace(parts[1])
				}
			}
		}
	}
	out, err = exec.Command("nmcli", "-t", "-f", "active,ssid", "dev", "wifi").Output()
	if err == nil {
		lines := strings.Split(string(out), "\n")
		for _, line := range lines {
			if strings.HasPrefix(line, "yes:") {
				parts := strings.SplitN(line, ":", 2)
				if len(parts) == 2 && len(strings.TrimSpace(parts[1])) > 0 {
					return strings.TrimSpace(parts[1])
				}
			}
		}
	}
	return ""
}

func getGateway() string {
	out, err := exec.Command("ip", "route", "show", "default").Output()
	if err == nil {
		fields := strings.Fields(string(out))
		for i, field := range fields {
			if field == "via" && i+1 < len(fields) {
				return fields[i+1]
			}
		}
	}
	return "192.168.1.1" // Fallback
}

func getWifiDetails(iface string) WifiDetails {
	ssid := getSSID(iface)

	details := WifiDetails{
		SSID:      ssid,
		Security:  "WPA2-PSK",
		Band:      "5 GHz",
		Channel:   44,
		LinkSpeed: 433,
		RSSI:      -52,
	}

	if runtime.GOOS == "windows" {
		out, err := exec.Command("netsh", "wlan", "show", "interfaces").Output()
		if err == nil && !strings.Contains(string(out), "There is no wireless interface") {
			lines := strings.Split(string(out), "\n")
			for _, line := range lines {
				line = strings.TrimSpace(line)
				if strings.HasPrefix(line, "Authentication") {
					parts := strings.SplitN(line, ":", 2)
					if len(parts) == 2 {
						details.Security = strings.TrimSpace(parts[1])
					}
				} else if strings.HasPrefix(line, "Channel") {
					parts := strings.SplitN(line, ":", 2)
					if len(parts) == 2 {
						if ch, e := strconv.Atoi(strings.TrimSpace(parts[1])); e == nil {
							details.Channel = ch
						}
					}
				} else if strings.HasPrefix(line, "Receive rate (Mbps)") || strings.HasPrefix(line, "Transmit rate (Mbps)") {
					parts := strings.SplitN(line, ":", 2)
					if len(parts) == 2 {
						if sp, e := strconv.ParseFloat(strings.TrimSpace(parts[1]), 64); e == nil {
							details.LinkSpeed = int(sp)
						}
					}
				} else if strings.HasPrefix(line, "Signal") {
					parts := strings.SplitN(line, ":", 2)
					if len(parts) == 2 {
						sigStr := strings.ReplaceAll(parts[1], "%", "")
						if sigPct, e := strconv.Atoi(strings.TrimSpace(sigStr)); e == nil {
							details.RSSI = -100 + (sigPct * 70 / 100)
						}
					}
				}
			}
		}
		return details
	}

	out, err := exec.Command("iw", "dev", iface, "link").Output()
	if err == nil {
		lines := strings.Split(string(out), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "SSID:") {
				parts := strings.SplitN(line, ":", 2)
				if len(parts) == 2 && len(strings.TrimSpace(parts[1])) > 0 {
					details.SSID = strings.TrimSpace(parts[1])
				}
			} else if strings.HasPrefix(line, "signal:") {
				parts := strings.Fields(line)
				if len(parts) >= 2 {
					val, _ := strconv.Atoi(parts[1])
					details.RSSI = val
				}
			} else if strings.HasPrefix(line, "tx bitrate:") {
				parts := strings.Fields(line)
				if len(parts) >= 3 {
					val, _ := strconv.ParseFloat(parts[2], 64)
					details.LinkSpeed = int(val)
				}
			} else if strings.HasPrefix(line, "freq:") {
				parts := strings.Fields(line)
				if len(parts) >= 2 {
					if freq, e := strconv.Atoi(parts[1]); e == nil {
						if freq > 5000 {
							details.Band = "5 GHz"
						} else {
							details.Band = "2.4 GHz"
						}
					}
				}
			}
		}
	}
	return details
}

func getWindowsNetworkBytes() (uint64, uint64) {
	out, err := exec.Command("netstat", "-e").Output()
	if err != nil {
		return 0, 0
	}
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "Bytes") {
			fields := strings.Fields(line)
			if len(fields) >= 3 {
				rx, _ := strconv.ParseUint(fields[1], 10, 64)
				tx, _ := strconv.ParseUint(fields[2], 10, 64)
				return rx, tx
			}
		}
	}
	return 0, 0
}

func Collect() (*Info, error) {
	var info Info

	mu.RLock()
	info.PublicIP = publicIPCache
	info.Quality = pingCache
	info.Logs = logsCache
	mu.RUnlock()

	info.Gateway = getGateway()

	ifaces, err := net.Interfaces()
	if err != nil {
		return &info, err
	}

	var winRx, winTx uint64
	if runtime.GOOS == "windows" {
		winRx, winTx = getWindowsNetworkBytes()
	}

	assignedWinStats := false
	for _, iface := range ifaces {
		var addresses []string
		addrList, _ := iface.Addrs()
		for _, addr := range addrList {
			addresses = append(addresses, addr.String())
		}

		statsDir := filepath.Join(system.SysPath("class/net"), iface.Name, "statistics")
		rx := readUint(filepath.Join(statsDir, "rx_bytes"))
		tx := readUint(filepath.Join(statsDir, "tx_bytes"))

		if rx == 0 && tx == 0 && winRx > 0 && !assignedWinStats {
			if iface.Flags&net.FlagUp != 0 && !strings.HasPrefix(iface.Name, "lo") && len(addresses) > 0 {
				rx = winRx
				tx = winTx
				assignedWinStats = true
			}
		}

		ssid := ""
		if strings.HasPrefix(iface.Name, "w") || strings.Contains(strings.ToLower(iface.Name), "wi-fi") {
			ssid = getSSID(iface.Name)
			if info.Wifi.SSID == "" {
				info.Wifi = getWifiDetails(iface.Name)
			}
		}

		info.Interfaces = append(info.Interfaces, Interface{
			Name:      iface.Name,
			Up:        iface.Flags&net.FlagUp != 0,
			MTU:       iface.MTU,
			MAC:       iface.HardwareAddr.String(),
			Addresses: addresses,
			RXBytes:   rx,
			TXBytes:   tx,
			SSID:      ssid,
		})
	}

	info.SpeedTest = speedTestHistory

	return &info, nil
}
