package packages

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

type ManagerType string

const (
	PMApk    ManagerType = "apk"
	PMApt    ManagerType = "apt"
	PMDnf    ManagerType = "dnf"
	PMPacman ManagerType = "pacman"
)

type Unit struct {
	Name         string `json:"name"`
	InstalledVer string `json:"installedVer"`
	AvailableVer string `json:"availableVer"`
	Status       string `json:"status"`
}

type Manager struct {
	pm ManagerType
}

func New() *Manager {
	pm := detect()
	return &Manager{pm: pm}
}

func (m *Manager) Type() ManagerType { return m.pm }

func detect() ManagerType {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	for _, pm := range []ManagerType{PMApk, PMApt, PMDnf, PMPacman} {
		path := "/usr/bin/" + string(pm)
		if err := exec.CommandContext(ctx, "test", "-x", path).Run(); err == nil {
			return pm
		}
		path = "/usr/sbin/" + string(pm)
		if err := exec.CommandContext(ctx, "test", "-x", path).Run(); err == nil {
			return pm
		}
	}
	return PMApt
}

func (m *Manager) Refresh() error {
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()
	switch m.pm {
	case PMApt:
		return exec.CommandContext(ctx, "apt", "update").Run()
	case PMDnf:
		return exec.CommandContext(ctx, "dnf", "check-update").Run()
	case PMPacman:
		return exec.CommandContext(ctx, "pacman", "-Sy").Run()
	case PMApk:
		return exec.CommandContext(ctx, "apk", "update").Run()
	}
	return nil
}

func (m *Manager) ListUpdates() ([]Unit, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	switch m.pm {
	case PMApt:
		out, err := exec.CommandContext(ctx, "apt", "list", "--upgradable").Output()
		if err != nil {
			return nil, fmt.Errorf("apt list --upgradable: %w", err)
		}
		return parseAptUpdates(string(out)), nil
	case PMDnf:
		out, err := exec.CommandContext(ctx, "dnf", "list", "updates").Output()
		if err != nil {
			return nil, fmt.Errorf("dnf list updates: %w", err)
		}
		return parseDnfUpdates(string(out)), nil
	case PMPacman:
		out, err := exec.CommandContext(ctx, "pacman", "-Qu").Output()
		if err != nil {
			return nil, fmt.Errorf("pacman -Qu: %w", err)
		}
		return parsePacmanUpdates(string(out)), nil
	case PMApk:
		out, err := exec.CommandContext(ctx, "apk", "list", "--upgradable").Output()
		if err != nil {
			return nil, fmt.Errorf("apk list --upgradable: %w", err)
		}
		return parseApkUpdates(string(out)), nil
	}
	return nil, nil
}

func (m *Manager) UpgradeAll() ([]Unit, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 300*time.Second)
	defer cancel()
	var out []byte
	var err error
	switch m.pm {
	case PMApt:
		out, err = exec.CommandContext(ctx, "apt", "upgrade", "-y").Output()
	case PMDnf:
		out, err = exec.CommandContext(ctx, "dnf", "upgrade", "-y").Output()
	case PMPacman:
		out, err = exec.CommandContext(ctx, "pacman", "-Su", "--noconfirm").Output()
	case PMApk:
		out, err = exec.CommandContext(ctx, "apk", "upgrade").Output()
	}
	if err != nil {
		return nil, fmt.Errorf("upgrade failed: %w: %s", err, string(out))
	}
	return m.ListUpdates()
}

func (m *Manager) Upgrade(names []string) ([]Unit, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 300*time.Second)
	defer cancel()
	args := []string{"install", "--only-upgrade", "-y"}
	args = append(args, names...)
	var out []byte
	var err error
	switch m.pm {
	case PMApt:
		out, err = exec.CommandContext(ctx, "apt", args...).Output()
	case PMDnf:
		out, err = exec.CommandContext(ctx, "dnf", "upgrade", "-y").Output()
		_ = out
	case PMPacman:
		out, err = exec.CommandContext(ctx, "pacman", "-S", "--noconfirm").Output()
		_ = out
	case PMApk:
		out, err = exec.CommandContext(ctx, "apk", "add", "--upgrade").Output()
		_ = out
	}
	if err != nil {
		return nil, fmt.Errorf("upgrade failed: %w", err)
	}
	return m.ListUpdates()
}

func (m *Manager) InstalledVersion(name string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	switch m.pm {
	case PMApt:
		out, err := exec.CommandContext(ctx, "dpkg-query", "-W", "-f=${Version}", name).Output()
		if err != nil {
			return "", nil
		}
		return strings.TrimSpace(string(out)), nil
	case PMDnf:
		out, err := exec.CommandContext(ctx, "rpm", "-q", name, "--queryformat", "%{VERSION}").Output()
		if err != nil {
			return "", nil
		}
		return strings.TrimSpace(string(out)), nil
	case PMPacman:
		out, err := exec.CommandContext(ctx, "pacman", "-Qi", name).Output()
		if err != nil {
			return "", nil
		}
		for _, line := range strings.Split(string(out), "\n") {
			if strings.HasPrefix(line, "Version ") {
				return strings.TrimSpace(strings.SplitN(line, ":", 2)[1]), nil
			}
		}
	case PMApk:
		out, err := exec.CommandContext(ctx, "apk", "list", "-I", name).Output()
		if err != nil {
			return "", nil
		}
		return parseApkVersion(string(out)), nil
	}
	return "", nil
}

func (m *Manager) AvailableVersion(name string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	switch m.pm {
	case PMApt:
		out, err := exec.CommandContext(ctx, "apt-cache", "policy", name).Output()
		if err != nil {
			return "", nil
		}
		for _, line := range strings.Split(string(out), "\n") {
			if strings.HasPrefix(line, "  Candidate:") {
				return strings.TrimSpace(strings.SplitN(line, ":", 2)[1]), nil
			}
		}
	case PMDnf:
		out, err := exec.CommandContext(ctx, "dnf", "list", "available", name).Output()
		if err != nil {
			return "", nil
		}
		for _, line := range strings.Split(string(out), "\n") {
			fields := strings.Fields(line)
			if len(fields) >= 2 && fields[0] == name {
				return fields[1], nil
			}
		}
	case PMPacman:
		out, err := exec.CommandContext(ctx, "pacman", "-Si", name).Output()
		if err != nil {
			return "", nil
		}
		for _, line := range strings.Split(string(out), "\n") {
			if strings.HasPrefix(line, "Version ") {
				return strings.TrimSpace(strings.SplitN(line, ":", 2)[1]), nil
			}
		}
	case PMApk:
		out, err := exec.CommandContext(ctx, "apk", "list", "-a", name).Output()
		if err != nil {
			return "", nil
		}
		return parseApkVersion(string(out)), nil
	}
	return "", nil
}

func parseAptUpdates(output string) []Unit {
	var pkgs []Unit
	for _, line := range strings.Split(strings.TrimSpace(output), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "Listing") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		name := strings.Split(fields[0], "/")[0]
		ver := strings.TrimRight(fields[1], ",")
		pkgs = append(pkgs, Unit{Name: name, InstalledVer: "", AvailableVer: ver, Status: "upgradable"})
	}
	return pkgs
}

func parseApkUpdates(output string) []Unit {
	var pkgs []Unit
	for _, line := range strings.Split(strings.TrimSpace(output), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 1 {
			continue
		}
		name := strings.Split(fields[0], "-")[0]
		pkgs = append(pkgs, Unit{Name: name, Status: "upgradable"})
	}
	return pkgs
}

func parseDnfUpdates(output string) []Unit {
	var pkgs []Unit
	for _, line := range strings.Split(strings.TrimSpace(output), "\n") {
		fields := strings.Fields(line)
		if len(fields) >= 3 {
			pkgs = append(pkgs, Unit{Name: fields[0], AvailableVer: fields[1], Status: "upgradable"})
		}
	}
	return pkgs
}

func parsePacmanUpdates(output string) []Unit {
	var pkgs []Unit
	for _, line := range strings.Split(strings.TrimSpace(output), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) >= 1 {
			pkgs = append(pkgs, Unit{Name: fields[0], Status: "upgradable"})
		}
	}
	return pkgs
}

func parseApkVersion(output string) string {
	fields := strings.Fields(strings.TrimSpace(output))
	if len(fields) >= 1 {
		parts := strings.Split(fields[0], "-")
		if len(parts) >= 2 {
			return parts[len(parts)-1]
		}
	}
	return ""
}
