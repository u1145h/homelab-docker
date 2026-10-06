package systemd

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

type UnitStatus string

const (
	UnitActive   UnitStatus = "active"
	UnitInactive UnitStatus = "inactive"
	UnitFailed   UnitStatus = "failed"
	UnitUnknown  UnitStatus = "unknown"
)

type Unit struct {
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Status      UnitStatus `json:"status"`
	ActiveState string     `json:"activeState"`
	SubState    string     `json:"subState"`
	Loaded      string     `json:"loaded"`
}

type JournalEntry struct {
	Timestamp time.Time `json:"timestamp"`
	Message   string    `json:"message"`
	Priority  int       `json:"priority"`
}

type Service struct{}

func New() *Service { return &Service{} }

func (s *Service) ListUnits() ([]Unit, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, "systemctl", "list-units", "--all", "--no-legend", "--no-pager").Output()
	if err != nil {
		return nil, fmt.Errorf("systemctl list-units: %w", err)
	}
	return parseUnits(string(out)), nil
}

func (s *Service) GetUnit(name string) (*Unit, error) {
	units, err := s.ListUnits()
	if err != nil {
		return nil, err
	}
	for _, u := range units {
		if u.Name == name {
			return &u, nil
		}
	}
	return nil, fmt.Errorf("unit not found: %s", name)
}

func (s *Service) StartUnit(name string) error { return runSystemctl("start", name) }
func (s *Service) StopUnit(name string) error  { return runSystemctl("stop", name) }
func (s *Service) RestartUnit(name string) error {
	if err := runSystemctl("restart", name); err != nil {
		return err
	}
	return nil
}
func (s *Service) ReloadUnit(name string) error  { return runSystemctl("reload", name) }
func (s *Service) EnableUnit(name string) error  { return runSystemctl("enable", name) }
func (s *Service) DisableUnit(name string) error { return runSystemctl("disable", name) }

func (s *Service) Journal(name string, lines int) ([]JournalEntry, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "journalctl", "-u", name, "-n", fmt.Sprintf("%d", lines), "--no-pager", "-o", "short-iso")
	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("journalctl: %w", err)
	}
	return parseJournal(string(out)), nil
}

func runSystemctl(action, unit string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	return exec.CommandContext(ctx, "systemctl", action, unit).Run()
}

func parseUnits(output string) []Unit {
	var units []Unit
	for _, line := range strings.Split(strings.TrimSpace(output), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 4 {
			continue
		}
		unit := Unit{
			Name:        fields[0],
			Loaded:      fields[1],
			ActiveState: fields[2],
			SubState:    fields[3],
		}
		if len(fields) > 4 {
			unit.Description = strings.Join(fields[4:], " ")
		}
		switch unit.ActiveState {
		case "active":
			unit.Status = UnitActive
		case "inactive", "dead":
			unit.Status = UnitInactive
		case "failed":
			unit.Status = UnitFailed
		default:
			unit.Status = UnitUnknown
		}
		units = append(units, unit)
	}
	return units
}

func parseJournal(output string) []JournalEntry {
	var entries []JournalEntry
	for _, line := range strings.Split(strings.TrimSpace(output), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		idx := strings.Index(line, " ")
		if idx < 0 {
			continue
		}
		ts, err := time.Parse("2006-01-02T15:04:05", line[:idx])
		if err != nil {
			continue
		}
		msg := strings.TrimSpace(line[idx:])
		entries = append(entries, JournalEntry{Timestamp: ts, Message: msg, Priority: 6})
	}
	return entries
}
