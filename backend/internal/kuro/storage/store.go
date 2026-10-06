package storage

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

// ─────────────────────────────────────────────────────────────────────────────
// Data Structures for 100% Local JSON Storage
// ─────────────────────────────────────────────────────────────────────────────

type DeviceInfo struct {
	NodeID              string         `json:"node_id"`
	DisplayName         string         `json:"display_name"`
	Platform            string         `json:"platform"`
	DeviceUUID          string         `json:"device_uuid,omitempty"`
	Hostname            string         `json:"hostname,omitempty"`
	LastSeenAt          string         `json:"last_seen_at"`
	IsOnline            bool           `json:"is_online"`
	SyncIntervalSeconds int            `json:"sync_interval_seconds,omitempty"`
	LatestSnapshot      map[string]any `json:"latest_snapshot,omitempty"`
	LatestLocation      *LocationItem  `json:"latest_location,omitempty"`
}

type CallItem struct {
	ID          string `json:"id"`
	NodeID      string `json:"node_id"`
	DeviceName  string `json:"device_name,omitempty"`
	CallerName  string `json:"caller_name"`
	PhoneNumber string `json:"phone_number"`
	CallType    string `json:"call_type"` // incoming | outgoing | missed | rejected
	Duration    int    `json:"duration"`
	Timestamp   string `json:"timestamp"`
	CreatedAt   string `json:"created_at"`
}

type MessageItem struct {
	ID          string `json:"id"`
	NodeID      string `json:"node_id"`
	DeviceName  string `json:"device_name,omitempty"`
	SenderName  string `json:"sender_name"`
	PhoneNumber string `json:"phone_number"`
	MessageBody string `json:"message_body"`
	IsRead      bool   `json:"is_read"`
	MessageType string `json:"message_type,omitempty"` // "inbox" | "sent" | "draft" | "outbox"
	IsSent      bool   `json:"is_sent,omitempty"`
	Timestamp   string `json:"timestamp"`
	CreatedAt   string `json:"created_at"`
}

type LocationItem struct {
	ID         string  `json:"id"`
	NodeID     string  `json:"node_id"`
	DeviceName string  `json:"device_name,omitempty"`
	Latitude   float64 `json:"latitude"`
	Longitude  float64 `json:"longitude"`
	Accuracy   float64 `json:"accuracy"`
	Address    string  `json:"address,omitempty"`
	WifiSSID   string  `json:"wifi_ssid,omitempty"`
	Timestamp  string  `json:"timestamp"`
	CreatedAt  string  `json:"created_at"`
}

type ContactItem struct {
	ID           string   `json:"id"`
	NodeID       string   `json:"node_id"`
	DeviceName   string   `json:"device_name,omitempty"`
	Name         string   `json:"name"`
	PhoneNumbers []string `json:"phone_numbers"`
	Email        string   `json:"email,omitempty"`
	IsStarred    bool     `json:"is_starred,omitempty"`
	LastContact  string   `json:"last_contact,omitempty"`
	CreatedAt    string   `json:"created_at"`
	UpdatedAt    string   `json:"updated_at"`
}

type NotificationItem struct {
	ID              string `json:"id"`
	NodeID          string `json:"node_id"`
	DeviceName      string `json:"device_name,omitempty"`
	PackageName     string `json:"package_name"`
	AppLabel        string `json:"app_label"`
	Title           string `json:"title,omitempty"`
	Text            string `json:"text,omitempty"`
	SubText         string `json:"sub_text,omitempty"`
	Timestamp       string `json:"timestamp"`
	IsCleared       bool   `json:"is_cleared"`
	MediaPreviewB64 string `json:"media_preview_b64,omitempty"`
	CreatedAt       string `json:"created_at"`
}

type InstalledAppItem struct {
	ID           string `json:"id"`
	NodeID       string `json:"node_id"`
	DeviceName   string `json:"device_name,omitempty"`
	PackageName  string `json:"package_name"`
	AppName      string `json:"app_name"`
	VersionName  string `json:"version_name,omitempty"`
	VersionCode  int64  `json:"version_code,omitempty"`
	InstalledAt  string `json:"installed_at,omitempty"`
	LastUpdated  string `json:"last_updated,omitempty"`
	IsSystemApp  bool   `json:"is_system_app"`
	APKSizeBytes int64  `json:"apk_size_bytes,omitempty"`
	IconB64      string `json:"icon_b64,omitempty"`
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
}

type DeviceTelemetryStore struct {
	Devices       map[string]DeviceInfo `json:"devices"`
	Calls         []CallItem            `json:"calls"`
	Messages      []MessageItem         `json:"messages"`
	Locations     []LocationItem        `json:"locations"`
	Contacts      []ContactItem         `json:"contacts"`
	Notifications []NotificationItem    `json:"notifications"`
	InstalledApps []InstalledAppItem    `json:"installed_apps"`
}

type MemoryItem struct {
	ID                   string `json:"id"`
	Username             string `json:"username"`
	Content              string `json:"content"`
	Category             string `json:"category"`
	Importance           int    `json:"importance"`
	SourceConversationID string `json:"source_conversation_id,omitempty"`
	CreatedAt            string `json:"created_at"`
	LastAccessedAt       string `json:"last_accessed_at,omitempty"`
	AccessCount          int    `json:"access_count"`
}

type IntegrationConfig struct {
	ServiceName string         `json:"service_name"`
	Enabled     bool           `json:"enabled"`
	Config      map[string]any `json:"config"`
	UpdatedAt   string         `json:"updated_at"`
}

type UserSessionItem struct {
	ID           string `json:"id"`
	UserID       string `json:"user_id"`
	Username     string `json:"username"`
	TokenVersion int    `json:"token_version"`
	ClientType   string `json:"client_type"`
	DeviceName   string `json:"device_name"`
	OS           string `json:"os"`
	Browser      string `json:"browser"`
	IPAddress    string `json:"ip_address"`
	UserAgent    string `json:"user_agent"`
	IsActive     bool   `json:"is_active"`
	IsCurrent    bool   `json:"is_current,omitempty"`
	IsOnline     bool   `json:"is_online"`
	Status       string `json:"status"` // "online" | "offline" | "revoked"
	LastActiveAt string `json:"last_active_at"`
	CreatedAt    string `json:"created_at"`
	RevokedAt    string `json:"revoked_at,omitempty"`
}

type UserSessionsStore struct {
	Sessions []UserSessionItem `json:"sessions"`
}

// ─────────────────────────────────────────────────────────────────────────────
// JSONStore Manager
// ─────────────────────────────────────────────────────────────────────────────

type JSONStore struct {
	mu           sync.RWMutex
	baseDir      string
	telemetry    DeviceTelemetryStore
	memories     []MemoryItem
	integrations map[string]IntegrationConfig
	sessions     []UserSessionItem
}

// NewJSONStore initializes the local JSON persistence directory and loads state.
func NewJSONStore(dataDir string) (*JSONStore, error) {
	kuroDir := filepath.Join(dataDir, "kuro")
	if err := os.MkdirAll(kuroDir, 0755); err != nil {
		return nil, fmt.Errorf("creating local kuro json directory %s: %w", kuroDir, err)
	}

	js := &JSONStore{
		baseDir: kuroDir,
		telemetry: DeviceTelemetryStore{
			Devices:       make(map[string]DeviceInfo),
			Calls:         []CallItem{},
			Messages:      []MessageItem{},
			Locations:     []LocationItem{},
			Contacts:      []ContactItem{},
			Notifications: []NotificationItem{},
			InstalledApps: []InstalledAppItem{},
		},
		memories:     []MemoryItem{},
		integrations: make(map[string]IntegrationConfig),
		sessions:     []UserSessionItem{},
	}

	if err := js.loadAll(); err != nil {
		slog.Warn("initializing local json store with default files", "error", err)
		_ = js.saveAll()
	}

	slog.Info("local json storage ready (100% device-only)", "path", kuroDir)
	return js, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal File I/O (Atomic Write with temporary files)
// ─────────────────────────────────────────────────────────────────────────────

func (s *JSONStore) clientDir(nodeID string) string {
	cleanID := strings.TrimSpace(nodeID)
	return filepath.Join(s.baseDir, "clients", fmt.Sprintf("client-%s", cleanID))
}

func (s *JSONStore) telemetryPath() string {
	return filepath.Join(s.baseDir, "device_telemetry.json")
}

func (s *JSONStore) memoriesPath() string {
	return filepath.Join(s.baseDir, "memories.json")
}

func (s *JSONStore) integrationsPath() string {
	return filepath.Join(s.baseDir, "integrations.json")
}

func (s *JSONStore) sessionsPath() string {
	return filepath.Join(s.baseDir, "sessions.json")
}

func (s *JSONStore) loadAll() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 1. Telemetry (Calls, SMS, GPS, Devices)
	if data, err := os.ReadFile(s.telemetryPath()); err == nil && len(data) > 0 {
		var t DeviceTelemetryStore
		if err := json.Unmarshal(data, &t); err == nil {
			if t.Devices == nil {
				t.Devices = make(map[string]DeviceInfo)
			}
			if t.Notifications == nil {
				t.Notifications = []NotificationItem{}
			}
			if t.InstalledApps == nil {
				t.InstalledApps = []InstalledAppItem{}
			}
			s.telemetry = t
		}
	}

	// 1b. Per-client directory loader
	clientsBase := filepath.Join(s.baseDir, "clients")
	if entries, err := os.ReadDir(clientsBase); err == nil {
		for _, entry := range entries {
			if !entry.IsDir() || !strings.HasPrefix(entry.Name(), "client-") {
				continue
			}
			nodeID := strings.TrimPrefix(entry.Name(), "client-")
			if nodeID == "" {
				continue
			}
			cDir := filepath.Join(clientsBase, entry.Name())

			// Read device.json
			if devData, err := os.ReadFile(filepath.Join(cDir, "device.json")); err == nil && len(devData) > 0 {
				var dev DeviceInfo
				if err := json.Unmarshal(devData, &dev); err == nil && dev.NodeID != "" {
					s.telemetry.Devices[dev.NodeID] = dev
				}
			}

			// Read calllog.json
			if callData, err := os.ReadFile(filepath.Join(cDir, "calllog.json")); err == nil && len(callData) > 0 {
				var calls []CallItem
				if err := json.Unmarshal(callData, &calls); err == nil {
					s.mergeCallsLocked(calls)
				}
			}

			// Read sms.json
			if smsData, err := os.ReadFile(filepath.Join(cDir, "sms.json")); err == nil && len(smsData) > 0 {
				var msgs []MessageItem
				if err := json.Unmarshal(smsData, &msgs); err == nil {
					s.mergeMsgsLocked(msgs)
				}
			}

			// Read notification.json
			if notifData, err := os.ReadFile(filepath.Join(cDir, "notification.json")); err == nil && len(notifData) > 0 {
				var notifs []NotificationItem
				if err := json.Unmarshal(notifData, &notifs); err == nil {
					s.mergeNotifsLocked(notifs)
				}
			}

			// Read location.json
			if locData, err := os.ReadFile(filepath.Join(cDir, "location.json")); err == nil && len(locData) > 0 {
				var locs []LocationItem
				if err := json.Unmarshal(locData, &locs); err == nil {
					s.mergeLocationsLocked(locs)
				}
			}

			// Read installed-apps.json
			if appData, err := os.ReadFile(filepath.Join(cDir, "installed-apps.json")); err == nil && len(appData) > 0 {
				var apps []InstalledAppItem
				if err := json.Unmarshal(appData, &apps); err == nil {
					s.mergeAppsLocked(apps)
				}
			}

			// Read contacts.json
			if contactData, err := os.ReadFile(filepath.Join(cDir, "contacts.json")); err == nil && len(contactData) > 0 {
				var contacts []ContactItem
				if err := json.Unmarshal(contactData, &contacts); err == nil {
					s.mergeContactsLocked(contacts)
				}
			}
		}
	}

	// Clean up any duplicates in loaded notifications
	s.telemetry.Notifications = deduplicateNotifsSlice(s.telemetry.Notifications)

	// 2. Memories
	if data, err := os.ReadFile(s.memoriesPath()); err == nil && len(data) > 0 {
		var mems []MemoryItem
		if err := json.Unmarshal(data, &mems); err == nil {
			s.memories = mems
		}
	}

	// 3. Integrations
	if data, err := os.ReadFile(s.integrationsPath()); err == nil && len(data) > 0 {
		var ints map[string]IntegrationConfig
		if err := json.Unmarshal(data, &ints); err == nil {
			s.integrations = ints
		}
	}

	// 4. User Sessions
	if data, err := os.ReadFile(s.sessionsPath()); err == nil && len(data) > 0 {
		var sessStore UserSessionsStore
		if err := json.Unmarshal(data, &sessStore); err == nil {
			s.sessions = sessStore.Sessions
		}
	}

	return nil
}

func notifDedupeKey(n NotificationItem) string {
	pkg := strings.ToLower(strings.TrimSpace(n.PackageName))
	title := strings.ToLower(strings.TrimSpace(n.Title))
	text := strings.ToLower(strings.TrimSpace(n.Text))
	subText := strings.ToLower(strings.TrimSpace(n.SubText))
	nodeID := strings.TrimSpace(n.NodeID)

	// Normalize timestamp to minute granularity to prevent 1-second drift duplicates
	ts := strings.TrimSpace(n.Timestamp)
	if len(ts) >= 16 {
		ts = ts[:16]
	}

	return fmt.Sprintf("%s|%s|%s|%s|%s|%s", nodeID, pkg, title, text, subText, ts)
}

func deduplicateNotifsSlice(items []NotificationItem) []NotificationItem {
	if len(items) <= 1 {
		return items
	}
	var out []NotificationItem
	seen := make(map[string]int)

	for _, item := range items {
		if item.PackageName == "" && item.Title == "" && item.Text == "" {
			continue
		}
		key := notifDedupeKey(item)
		if idx, found := seen[key]; found {
			existing := &out[idx]
			if item.AppLabel != "" && existing.AppLabel == "" {
				existing.AppLabel = item.AppLabel
			}
			if item.MediaPreviewB64 != "" && existing.MediaPreviewB64 == "" {
				existing.MediaPreviewB64 = item.MediaPreviewB64
			}
			if item.IsCleared {
				existing.IsCleared = true
			}
			if item.Timestamp != "" && item.Timestamp > existing.Timestamp {
				existing.Timestamp = item.Timestamp
			}
		} else {
			if item.ID == "" {
				item.ID = generateID()
			}
			out = append(out, item)
			seen[key] = len(out) - 1
		}
	}
	return out
}

func (s *JSONStore) mergeCallsLocked(items []CallItem) {
	keyMap := make(map[string]bool, len(s.telemetry.Calls))
	for _, c := range s.telemetry.Calls {
		keyMap[fmt.Sprintf("%s|%s|%s|%s", c.NodeID, c.PhoneNumber, c.Timestamp, c.CallType)] = true
	}
	for _, item := range items {
		key := fmt.Sprintf("%s|%s|%s|%s", item.NodeID, item.PhoneNumber, item.Timestamp, item.CallType)
		if !keyMap[key] {
			keyMap[key] = true
			s.telemetry.Calls = append(s.telemetry.Calls, item)
		}
	}
}

func (s *JSONStore) mergeMsgsLocked(items []MessageItem) {
	keyMap := make(map[string]bool, len(s.telemetry.Messages))
	for _, m := range s.telemetry.Messages {
		keyMap[fmt.Sprintf("%s|%s|%s|%s|%t", m.NodeID, m.PhoneNumber, m.Timestamp, m.MessageBody, m.IsSent)] = true
	}
	for _, item := range items {
		key := fmt.Sprintf("%s|%s|%s|%s|%t", item.NodeID, item.PhoneNumber, item.Timestamp, item.MessageBody, item.IsSent)
		if !keyMap[key] {
			keyMap[key] = true
			s.telemetry.Messages = append(s.telemetry.Messages, item)
		}
	}
}

func (s *JSONStore) mergeNotifsLocked(items []NotificationItem) {
	keyMap := make(map[string]bool, len(s.telemetry.Notifications))
	for _, n := range s.telemetry.Notifications {
		keyMap[fmt.Sprintf("%s|%s|%s|%s|%s", n.NodeID, n.PackageName, n.Timestamp, n.Title, n.Text)] = true
	}
	for _, item := range items {
		key := fmt.Sprintf("%s|%s|%s|%s|%s", item.NodeID, item.PackageName, item.Timestamp, item.Title, item.Text)
		if !keyMap[key] {
			keyMap[key] = true
			s.telemetry.Notifications = append(s.telemetry.Notifications, item)
		}
	}
}

func (s *JSONStore) mergeLocationsLocked(items []LocationItem) {
	keyMap := make(map[string]bool, len(s.telemetry.Locations))
	for _, l := range s.telemetry.Locations {
		keyMap[fmt.Sprintf("%s|%f|%f|%s", l.NodeID, l.Latitude, l.Longitude, l.Timestamp)] = true
	}
	for _, item := range items {
		key := fmt.Sprintf("%s|%f|%f|%s", item.NodeID, item.Latitude, item.Longitude, item.Timestamp)
		if !keyMap[key] {
			keyMap[key] = true
			s.telemetry.Locations = append(s.telemetry.Locations, item)
		}
	}
}

func (s *JSONStore) mergeAppsLocked(items []InstalledAppItem) {
	keyMap := make(map[string]int, len(s.telemetry.InstalledApps))
	for idx, a := range s.telemetry.InstalledApps {
		keyMap[fmt.Sprintf("%s|%s", a.NodeID, a.PackageName)] = idx
	}
	for _, item := range items {
		key := fmt.Sprintf("%s|%s", item.NodeID, item.PackageName)
		if idx, found := keyMap[key]; found {
			if item.IconB64 == "" {
				item.IconB64 = s.telemetry.InstalledApps[idx].IconB64
			}
			s.telemetry.InstalledApps[idx] = item
		} else {
			keyMap[key] = len(s.telemetry.InstalledApps)
			s.telemetry.InstalledApps = append(s.telemetry.InstalledApps, item)
		}
	}
}

func (s *JSONStore) mergeContactsLocked(items []ContactItem) {
	keyMap := make(map[string]bool, len(s.telemetry.Contacts))
	for _, c := range s.telemetry.Contacts {
		keyMap[fmt.Sprintf("%s|%s|%s", c.NodeID, strings.ToLower(c.Name), strings.Join(c.PhoneNumbers, ","))] = true
	}
	for _, item := range items {
		key := fmt.Sprintf("%s|%s|%s", item.NodeID, strings.ToLower(item.Name), strings.Join(item.PhoneNumbers, ","))
		if !keyMap[key] {
			keyMap[key] = true
			s.telemetry.Contacts = append(s.telemetry.Contacts, item)
		}
	}
}

func (s *JSONStore) saveAll() error {
	if err := s.saveTelemetryLocked(); err != nil {
		return err
	}
	if err := s.saveMemoriesLocked(); err != nil {
		return err
	}
	if err := s.saveIntegrationsLocked(); err != nil {
		return err
	}
	return s.saveSessionsLocked()
}

func (s *JSONStore) saveSessionsLocked() error {
	return atomicWriteJSON(s.sessionsPath(), UserSessionsStore{Sessions: s.sessions})
}

func atomicWriteJSON(path string, v any) error {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal json: %w", err)
	}

	tmpPath := fmt.Sprintf("%s.tmp.%d", path, time.Now().UnixNano())
	if err := os.WriteFile(tmpPath, data, 0644); err != nil {
		return fmt.Errorf("write tmp json %s: %w", tmpPath, err)
	}

	// Atomic replace
	if err := os.Rename(tmpPath, path); err != nil {
		// Fallback for Windows if destination exists
		_ = os.Remove(path)
		if err2 := os.Rename(tmpPath, path); err2 != nil {
			_ = os.Remove(tmpPath)
			return fmt.Errorf("rename tmp json to %s: %w", path, err2)
		}
	}
	return nil
}

func (s *JSONStore) saveTelemetryLocked() error {
	// 1. Global backup/legacy file
	if err := atomicWriteJSON(s.telemetryPath(), s.telemetry); err != nil {
		slog.Warn("Failed to save global telemetry file", "err", err)
	}

	// 2. Per-client storage under backend/data/kuro/clients/client-{nodeID}/
	nodeSet := make(map[string]bool)
	for id := range s.telemetry.Devices {
		if id != "" {
			nodeSet[id] = true
		}
	}
	for _, c := range s.telemetry.Calls {
		if c.NodeID != "" {
			nodeSet[c.NodeID] = true
		}
	}
	for _, m := range s.telemetry.Messages {
		if m.NodeID != "" {
			nodeSet[m.NodeID] = true
		}
	}
	for _, l := range s.telemetry.Locations {
		if l.NodeID != "" {
			nodeSet[l.NodeID] = true
		}
	}
	for _, ct := range s.telemetry.Contacts {
		if ct.NodeID != "" {
			nodeSet[ct.NodeID] = true
		}
	}
	for _, n := range s.telemetry.Notifications {
		if n.NodeID != "" {
			nodeSet[n.NodeID] = true
		}
	}
	for _, a := range s.telemetry.InstalledApps {
		if a.NodeID != "" {
			nodeSet[a.NodeID] = true
		}
	}

	for nodeID := range nodeSet {
		cDir := s.clientDir(nodeID)
		if err := os.MkdirAll(cDir, 0755); err != nil {
			continue
		}

		// device.json
		dev, hasDev := s.telemetry.Devices[nodeID]
		if !hasDev {
			dev = DeviceInfo{
				NodeID:      nodeID,
				DisplayName: "Device (" + nodeID + ")",
				Platform:    "android",
				LastSeenAt:  time.Now().UTC().Format(time.RFC3339),
			}
		}
		_ = atomicWriteJSON(filepath.Join(cDir, "device.json"), dev)

		// calllog.json
		var nodeCalls []CallItem
		for _, c := range s.telemetry.Calls {
			if c.NodeID == nodeID {
				nodeCalls = append(nodeCalls, c)
			}
		}
		if nodeCalls == nil {
			nodeCalls = []CallItem{}
		}
		_ = atomicWriteJSON(filepath.Join(cDir, "calllog.json"), nodeCalls)

		// sms.json
		var nodeMsgs []MessageItem
		for _, m := range s.telemetry.Messages {
			if m.NodeID == nodeID {
				nodeMsgs = append(nodeMsgs, m)
			}
		}
		if nodeMsgs == nil {
			nodeMsgs = []MessageItem{}
		}
		_ = atomicWriteJSON(filepath.Join(cDir, "sms.json"), nodeMsgs)

		// notification.json
		var nodeNotifs []NotificationItem
		for _, n := range s.telemetry.Notifications {
			if n.NodeID == nodeID {
				nodeNotifs = append(nodeNotifs, n)
			}
		}
		if nodeNotifs == nil {
			nodeNotifs = []NotificationItem{}
		}
		_ = atomicWriteJSON(filepath.Join(cDir, "notification.json"), nodeNotifs)

		// location.json
		var nodeLocs []LocationItem
		for _, l := range s.telemetry.Locations {
			if l.NodeID == nodeID {
				nodeLocs = append(nodeLocs, l)
			}
		}
		if nodeLocs == nil {
			nodeLocs = []LocationItem{}
		}
		_ = atomicWriteJSON(filepath.Join(cDir, "location.json"), nodeLocs)

		// installed-apps.json
		var nodeApps []InstalledAppItem
		for _, a := range s.telemetry.InstalledApps {
			if a.NodeID == nodeID {
				nodeApps = append(nodeApps, a)
			}
		}
		if nodeApps == nil {
			nodeApps = []InstalledAppItem{}
		}
		_ = atomicWriteJSON(filepath.Join(cDir, "installed-apps.json"), nodeApps)

		// contacts.json
		var nodeContacts []ContactItem
		for _, ct := range s.telemetry.Contacts {
			if ct.NodeID == nodeID {
				nodeContacts = append(nodeContacts, ct)
			}
		}
		if nodeContacts == nil {
			nodeContacts = []ContactItem{}
		}
		_ = atomicWriteJSON(filepath.Join(cDir, "contacts.json"), nodeContacts)
	}

	return nil
}

func (s *JSONStore) saveMemoriesLocked() error {
	return atomicWriteJSON(s.memoriesPath(), s.memories)
}

func (s *JSONStore) saveIntegrationsLocked() error {
	return atomicWriteJSON(s.integrationsPath(), s.integrations)
}

// ─────────────────────────────────────────────────────────────────────────────
// Device Telemetry, Calls, SMS, GPS, Contacts Operations
// ─────────────────────────────────────────────────────────────────────────────

type SyncPayload struct {
	NodeID        string
	DeviceName    string
	Platform      string
	DeviceUUID    string
	Battery       any
	Network       any
	Storage       any
	Hardware      any
	Context       any
	Media         any
	Metadata      any
	Cameras       any
	Microphones   any
	Location      *LocationItem
	Locations     []LocationItem
	Calls         []CallItem
	Messages      []MessageItem
	Contacts      []ContactItem
	Notifications []NotificationItem
	InstalledApps []InstalledAppItem
}

// IngestTelemetrySync performs atomic batch sync with deduplication and device registration.
func (s *JSONStore) IngestTelemetrySync(p SyncPayload) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	nowStr := time.Now().UTC().Format(time.RFC3339)

	// Deduplicate / Migrate device if DeviceUUID matches an existing registered device with a different NodeID
	if p.DeviceUUID != "" {
		for oldID, oldDev := range s.telemetry.Devices {
			if oldID != p.NodeID && oldDev.DeviceUUID == p.DeviceUUID {
				// If incoming NodeID is a generic fallback ("android-node", "device", "unknown", "windows-client")
				// and oldDev had a real hardware ID, keep the real oldID as canonical rather than mutating to the generic placeholder.
				if (p.NodeID == "android-node" || p.NodeID == "android" || p.NodeID == "device" || p.NodeID == "windows-client") &&
					oldID != "android-node" && oldID != "windows-client" {
					p.NodeID = oldID
					if oldDev.DisplayName != "" {
						p.DeviceName = oldDev.DisplayName
					}
					slog.Info("Canonicalized generic placeholder NodeID back to existing registered hardware ID", "placeholder", p.NodeID, "canonical_id", oldID)
					break
				}

				// Otherwise, migrate from oldID to p.NodeID:
				targetName := p.DeviceName
				if oldDev.DisplayName != "" && oldDev.DisplayName != oldDev.NodeID && oldDev.DisplayName != "android-node" && oldDev.DisplayName != "windows-client" {
					targetName = oldDev.DisplayName
				}

				// Re-key existing historical records from oldID to p.NodeID
				for i := range s.telemetry.Calls {
					if s.telemetry.Calls[i].NodeID == oldID {
						s.telemetry.Calls[i].NodeID = p.NodeID
						if targetName != "" {
							s.telemetry.Calls[i].DeviceName = targetName
						}
					}
				}
				for i := range s.telemetry.Messages {
					if s.telemetry.Messages[i].NodeID == oldID {
						s.telemetry.Messages[i].NodeID = p.NodeID
						if targetName != "" {
							s.telemetry.Messages[i].DeviceName = targetName
						}
					}
				}
				for i := range s.telemetry.Locations {
					if s.telemetry.Locations[i].NodeID == oldID {
						s.telemetry.Locations[i].NodeID = p.NodeID
						if targetName != "" {
							s.telemetry.Locations[i].DeviceName = targetName
						}
					}
				}
				for i := range s.telemetry.Contacts {
					if s.telemetry.Contacts[i].NodeID == oldID {
						s.telemetry.Contacts[i].NodeID = p.NodeID
						if targetName != "" {
							s.telemetry.Contacts[i].DeviceName = targetName
						}
					}
				}
				for i := range s.telemetry.Notifications {
					if s.telemetry.Notifications[i].NodeID == oldID {
						s.telemetry.Notifications[i].NodeID = p.NodeID
						if targetName != "" {
							s.telemetry.Notifications[i].DeviceName = targetName
						}
					}
				}
				for i := range s.telemetry.InstalledApps {
					if s.telemetry.InstalledApps[i].NodeID == oldID {
						s.telemetry.InstalledApps[i].NodeID = p.NodeID
						if targetName != "" {
							s.telemetry.InstalledApps[i].DeviceName = targetName
						}
					}
				}
				delete(s.telemetry.Devices, oldID)
				_ = os.RemoveAll(s.clientDir(oldID))
				slog.Info("Migrated device telemetry to new NodeID via device_uuid", "old_id", oldID, "new_id", p.NodeID, "device_uuid", p.DeviceUUID)
				break
			}
		}
	}

	// 1. Update device registry
	dev, exists := s.telemetry.Devices[p.NodeID]
	if !exists {
		dev = DeviceInfo{
			NodeID:      p.NodeID,
			DisplayName: p.DeviceName,
			Hostname:    p.DeviceName,
			Platform:    p.Platform,
			DeviceUUID:  p.DeviceUUID,
		}
	}
	if p.DeviceName != "" {
		dev.Hostname = p.DeviceName
		// Only set DisplayName from payload if it has never been customized or is empty/placeholder
		if dev.DisplayName == "" || dev.DisplayName == dev.NodeID || dev.DisplayName == "android-node" || dev.DisplayName == "windows-client" {
			dev.DisplayName = p.DeviceName
		}
	}
	if p.Platform != "" {
		dev.Platform = p.Platform
	}
	if p.DeviceUUID != "" {
		dev.DeviceUUID = p.DeviceUUID
	}
	dev.LastSeenAt = nowStr
	dev.IsOnline = true

	snapshotMap := make(map[string]any)
	if p.Battery != nil {
		snapshotMap["battery"] = p.Battery
	}
	if p.Network != nil {
		snapshotMap["network"] = p.Network
	}
	if p.Storage != nil {
		snapshotMap["storage"] = p.Storage
	}
	if p.Hardware != nil {
		snapshotMap["hardware"] = p.Hardware
	}
	if p.Context != nil {
		snapshotMap["context"] = p.Context
	}
	if p.Media != nil {
		snapshotMap["media"] = p.Media
	}
	if p.Metadata != nil {
		snapshotMap["metadata"] = p.Metadata
	}
	if p.Cameras != nil {
		snapshotMap["cameras"] = p.Cameras
	}
	if p.Microphones != nil {
		snapshotMap["microphones"] = p.Microphones
	}
	snapshotMap["timestamp"] = nowStr
	dev.LatestSnapshot = snapshotMap

	// Location timeline ingestion (supports both single Location snapshot and batch Locations history)
	var allIncomingLocs []LocationItem
	if p.Location != nil && (p.Location.Latitude != 0 || p.Location.Longitude != 0) {
		allIncomingLocs = append(allIncomingLocs, *p.Location)
	}
	for _, l := range p.Locations {
		if l.Latitude != 0 || l.Longitude != 0 {
			allIncomingLocs = append(allIncomingLocs, l)
		}
	}

	if len(allIncomingLocs) > 0 {
		locKeySet := make(map[string]bool, len(s.telemetry.Locations))
		for _, l := range s.telemetry.Locations {
			locKeySet[fmt.Sprintf("%s|%f|%f|%s", l.NodeID, l.Latitude, l.Longitude, l.Timestamp)] = true
		}

		var newestLoc *LocationItem
		for _, loc := range allIncomingLocs {
			loc.NodeID = p.NodeID
			loc.DeviceName = dev.DisplayName
			if loc.Timestamp == "" {
				loc.Timestamp = time.Now().Format("2006-01-02 15:04:05")
			}
			if loc.CreatedAt == "" {
				loc.CreatedAt = nowStr
			}
			if loc.ID == "" {
				loc.ID = generateID()
			}

			key := fmt.Sprintf("%s|%f|%f|%s", loc.NodeID, loc.Latitude, loc.Longitude, loc.Timestamp)
			if !locKeySet[key] {
				locKeySet[key] = true
				s.telemetry.Locations = append([]LocationItem{loc}, s.telemetry.Locations...)
			}
			if newestLoc == nil || loc.Timestamp >= newestLoc.Timestamp {
				newestCopy := loc
				newestLoc = &newestCopy
			}
		}
		if len(s.telemetry.Locations) > 500 {
			s.telemetry.Locations = s.telemetry.Locations[:500]
		}
		if newestLoc != nil {
			dev.LatestLocation = newestLoc
		}
	}

	s.telemetry.Devices[p.NodeID] = dev

	// 2. Ingest Call Logs (with natural deduplication)
	callKeySet := make(map[string]bool, len(s.telemetry.Calls))
	for _, c := range s.telemetry.Calls {
		key := fmt.Sprintf("%s|%s|%s|%s", c.NodeID, c.PhoneNumber, c.CallType, c.Timestamp)
		callKeySet[key] = true
	}

	var newCalls []CallItem
	for _, c := range p.Calls {
		if c.PhoneNumber == "" {
			continue
		}
		c.NodeID = p.NodeID
		c.DeviceName = dev.DisplayName
		if c.Timestamp == "" {
			c.Timestamp = time.Now().Format("2006-01-02 15:04:05")
		}
		key := fmt.Sprintf("%s|%s|%s|%s", c.NodeID, c.PhoneNumber, c.CallType, c.Timestamp)
		if !callKeySet[key] {
			callKeySet[key] = true
			if c.ID == "" {
				c.ID = generateID()
			}
			c.CreatedAt = nowStr
			newCalls = append(newCalls, c)
		}
	}
	if len(newCalls) > 0 {
		// Prepend new calls and keep sorted by timestamp descending
		s.telemetry.Calls = append(newCalls, s.telemetry.Calls...)
		sort.SliceStable(s.telemetry.Calls, func(i, j int) bool {
			return s.telemetry.Calls[i].Timestamp > s.telemetry.Calls[j].Timestamp
		})
	}

	// 3. Ingest SMS Messages (with natural deduplication)
	msgKeySet := make(map[string]bool, len(s.telemetry.Messages))
	for _, m := range s.telemetry.Messages {
		key := fmt.Sprintf("%s|%s|%s|%s|%t", m.NodeID, m.PhoneNumber, m.Timestamp, m.MessageBody, m.IsSent)
		msgKeySet[key] = true
	}

	var newMsgs []MessageItem
	for _, m := range p.Messages {
		if m.PhoneNumber == "" {
			continue
		}
		m.NodeID = p.NodeID
		m.DeviceName = dev.DisplayName
		if m.Timestamp == "" {
			m.Timestamp = time.Now().Format("2006-01-02 15:04:05")
		}
		key := fmt.Sprintf("%s|%s|%s|%s|%t", m.NodeID, m.PhoneNumber, m.Timestamp, m.MessageBody, m.IsSent)
		if !msgKeySet[key] {
			msgKeySet[key] = true
			if m.ID == "" {
				m.ID = generateID()
			}
			m.CreatedAt = nowStr
			newMsgs = append(newMsgs, m)
		}
	}
	if len(newMsgs) > 0 {
		s.telemetry.Messages = append(newMsgs, s.telemetry.Messages...)
		sort.SliceStable(s.telemetry.Messages, func(i, j int) bool {
			return s.telemetry.Messages[i].Timestamp > s.telemetry.Messages[j].Timestamp
		})
	}

	// 4. Ingest Contacts (with natural deduplication)
	contactKeySet := make(map[string]bool, len(s.telemetry.Contacts))
	for _, c := range s.telemetry.Contacts {
		key := fmt.Sprintf("%s|%s|%s", c.NodeID, strings.ToLower(c.Name), strings.Join(c.PhoneNumbers, ","))
		contactKeySet[key] = true
	}

	var newContacts []ContactItem
	for _, c := range p.Contacts {
		if c.Name == "" && len(c.PhoneNumbers) == 0 {
			continue
		}
		c.NodeID = p.NodeID
		c.DeviceName = dev.DisplayName
		c.UpdatedAt = nowStr
		key := fmt.Sprintf("%s|%s|%s", c.NodeID, strings.ToLower(c.Name), strings.Join(c.PhoneNumbers, ","))
		if !contactKeySet[key] {
			contactKeySet[key] = true
			if c.ID == "" {
				c.ID = generateID()
			}
			c.CreatedAt = nowStr
			newContacts = append(newContacts, c)
		}
	}
	if len(newContacts) > 0 {
		s.telemetry.Contacts = append(newContacts, s.telemetry.Contacts...)
		sort.SliceStable(s.telemetry.Contacts, func(i, j int) bool {
			return strings.ToLower(s.telemetry.Contacts[i].Name) < strings.ToLower(s.telemetry.Contacts[j].Name)
		})
	}

	// 5. Ingest Notifications (Smart Upsert & Deduplicate, keep latest 1000)
	if len(p.Notifications) > 0 {
		var notifItems []NotificationItem
		for _, n := range p.Notifications {
			if n.PackageName == "" && n.Text == "" && n.Title == "" {
				continue
			}
			n.NodeID = p.NodeID
			n.DeviceName = dev.DisplayName
			if n.Timestamp == "" {
				n.Timestamp = nowStr
			}
			if n.CreatedAt == "" {
				n.CreatedAt = nowStr
			}
			notifItems = append(notifItems, n)
		}
		if len(notifItems) > 0 {
			s.mergeNotifsLocked(notifItems)
			s.telemetry.Notifications = deduplicateNotifsSlice(s.telemetry.Notifications)
			sort.SliceStable(s.telemetry.Notifications, func(i, j int) bool {
				return s.telemetry.Notifications[i].Timestamp > s.telemetry.Notifications[j].Timestamp
			})
			if len(s.telemetry.Notifications) > 1000 {
				s.telemetry.Notifications = s.telemetry.Notifications[:1000]
			}
		}
	}

	// 6. Ingest Installed Apps (Upsert/Replace by PackageName for this NodeID)
	if len(p.InstalledApps) > 0 {
		appMap := make(map[string]int) // packageName -> index in s.telemetry.InstalledApps
		for idx, a := range s.telemetry.InstalledApps {
			if a.NodeID == p.NodeID {
				appMap[a.PackageName] = idx
			}
		}

		for _, a := range p.InstalledApps {
			if a.PackageName == "" {
				continue
			}
			a.NodeID = p.NodeID
			a.DeviceName = dev.DisplayName
			a.UpdatedAt = nowStr

			if existingIdx, found := appMap[a.PackageName]; found {
				a.ID = s.telemetry.InstalledApps[existingIdx].ID
				a.CreatedAt = s.telemetry.InstalledApps[existingIdx].CreatedAt
				if a.IconB64 == "" {
					a.IconB64 = s.telemetry.InstalledApps[existingIdx].IconB64
				}
				s.telemetry.InstalledApps[existingIdx] = a
			} else {
				if a.ID == "" {
					a.ID = generateID()
				}
				a.CreatedAt = nowStr
				s.telemetry.InstalledApps = append(s.telemetry.InstalledApps, a)
			}
		}
		sort.SliceStable(s.telemetry.InstalledApps, func(i, j int) bool {
			return strings.ToLower(s.telemetry.InstalledApps[i].AppName) < strings.ToLower(s.telemetry.InstalledApps[j].AppName)
		})
	}

	return s.saveTelemetryLocked()
}

// GetClientData retrieves calls, messages, locations, contacts, notifications, apps, devices, and snapshot.
func (s *JSONStore) GetClientData(nodeID string) (calls []CallItem, msgs []MessageItem, loc *LocationItem, locs []LocationItem, contacts []ContactItem, notifs []NotificationItem, apps []InstalledAppItem, snap any, devices []DeviceInfo) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// List all devices
	for _, d := range s.telemetry.Devices {
		devices = append(devices, d)
	}
	sort.SliceStable(devices, func(i, j int) bool {
		return devices[i].LastSeenAt > devices[j].LastSeenAt
	})

	if nodeID != "" {
		// Specific node filtering
		for _, c := range s.telemetry.Calls {
			if c.NodeID == nodeID {
				calls = append(calls, c)
			}
		}
		for _, m := range s.telemetry.Messages {
			if m.NodeID == nodeID {
				msgs = append(msgs, m)
			}
		}
		for _, l := range s.telemetry.Locations {
			if l.NodeID == nodeID {
				locs = append(locs, l)
			}
		}
		for _, ct := range s.telemetry.Contacts {
			if ct.NodeID == nodeID {
				contacts = append(contacts, ct)
			}
		}
		for _, n := range s.telemetry.Notifications {
			if n.NodeID == nodeID {
				notifs = append(notifs, n)
			}
		}
		for _, a := range s.telemetry.InstalledApps {
			if a.NodeID == nodeID {
				apps = append(apps, a)
			}
		}
		if d, ok := s.telemetry.Devices[nodeID]; ok {
			loc = d.LatestLocation
			snap = d.LatestSnapshot
		}
	} else {
		// All nodes aggregated
		calls = make([]CallItem, len(s.telemetry.Calls))
		copy(calls, s.telemetry.Calls)

		msgs = make([]MessageItem, len(s.telemetry.Messages))
		copy(msgs, s.telemetry.Messages)

		locs = make([]LocationItem, len(s.telemetry.Locations))
		copy(locs, s.telemetry.Locations)

		contacts = make([]ContactItem, len(s.telemetry.Contacts))
		copy(contacts, s.telemetry.Contacts)

		notifs = make([]NotificationItem, len(s.telemetry.Notifications))
		copy(notifs, s.telemetry.Notifications)

		apps = make([]InstalledAppItem, len(s.telemetry.InstalledApps))
		copy(apps, s.telemetry.InstalledApps)

		if len(s.telemetry.Locations) > 0 {
			loc = &s.telemetry.Locations[0]
		}
		if len(devices) > 0 && devices[0].LatestSnapshot != nil {
			snap = devices[0].LatestSnapshot
		}
	}

	if calls == nil {
		calls = []CallItem{}
	}
	if msgs == nil {
		msgs = []MessageItem{}
	}
	if locs == nil {
		locs = []LocationItem{}
	}
	if contacts == nil {
		contacts = []ContactItem{}
	}
	if notifs == nil {
		notifs = []NotificationItem{}
	} else {
		notifs = deduplicateNotifsSlice(notifs)
	}
	if apps == nil {
		apps = []InstalledAppItem{}
	}

	return calls, msgs, loc, locs, contacts, notifs, apps, snap, devices
}

// DeleteDevice removes a device from telemetry store and either merges or deletes its historical data.
func (s *JSONStore) DeleteDevice(nodeID string, deleteData bool, mergeTargetNodeID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	targetName := ""
	if mergeTargetNodeID != "" {
		if targetDev, ok := s.telemetry.Devices[mergeTargetNodeID]; ok {
			targetName = targetDev.DisplayName
		}
	}

	if mergeTargetNodeID != "" {
		// Merge: Reassign all calls, messages, locations, and contacts to target device
		for i := range s.telemetry.Calls {
			if s.telemetry.Calls[i].NodeID == nodeID {
				s.telemetry.Calls[i].NodeID = mergeTargetNodeID
				if targetName != "" {
					s.telemetry.Calls[i].DeviceName = targetName
				}
			}
		}
		for i := range s.telemetry.Messages {
			if s.telemetry.Messages[i].NodeID == nodeID {
				s.telemetry.Messages[i].NodeID = mergeTargetNodeID
				if targetName != "" {
					s.telemetry.Messages[i].DeviceName = targetName
				}
			}
		}
		for i := range s.telemetry.Locations {
			if s.telemetry.Locations[i].NodeID == nodeID {
				s.telemetry.Locations[i].NodeID = mergeTargetNodeID
				if targetName != "" {
					s.telemetry.Locations[i].DeviceName = targetName
				}
			}
		}
		for i := range s.telemetry.Contacts {
			if s.telemetry.Contacts[i].NodeID == nodeID {
				s.telemetry.Contacts[i].NodeID = mergeTargetNodeID
				if targetName != "" {
					s.telemetry.Contacts[i].DeviceName = targetName
				}
			}
		}
		for i := range s.telemetry.Notifications {
			if s.telemetry.Notifications[i].NodeID == nodeID {
				s.telemetry.Notifications[i].NodeID = mergeTargetNodeID
				if targetName != "" {
					s.telemetry.Notifications[i].DeviceName = targetName
				}
			}
		}
		for i := range s.telemetry.InstalledApps {
			if s.telemetry.InstalledApps[i].NodeID == nodeID {
				s.telemetry.InstalledApps[i].NodeID = mergeTargetNodeID
				if targetName != "" {
					s.telemetry.InstalledApps[i].DeviceName = targetName
				}
			}
		}
	} else if deleteData {
		// Delete Data: Filter out all logs for this device
		var filteredCalls []CallItem
		for _, c := range s.telemetry.Calls {
			if c.NodeID != nodeID {
				filteredCalls = append(filteredCalls, c)
			}
		}
		s.telemetry.Calls = filteredCalls

		var filteredMsgs []MessageItem
		for _, m := range s.telemetry.Messages {
			if m.NodeID != nodeID {
				filteredMsgs = append(filteredMsgs, m)
			}
		}
		s.telemetry.Messages = filteredMsgs

		var filteredLocs []LocationItem
		for _, l := range s.telemetry.Locations {
			if l.NodeID != nodeID {
				filteredLocs = append(filteredLocs, l)
			}
		}
		s.telemetry.Locations = filteredLocs

		var filteredContacts []ContactItem
		for _, ct := range s.telemetry.Contacts {
			if ct.NodeID != nodeID {
				filteredContacts = append(filteredContacts, ct)
			}
		}
		s.telemetry.Contacts = filteredContacts

		var filteredNotifs []NotificationItem
		for _, n := range s.telemetry.Notifications {
			if n.NodeID != nodeID {
				filteredNotifs = append(filteredNotifs, n)
			}
		}
		s.telemetry.Notifications = filteredNotifs

		var filteredApps []InstalledAppItem
		for _, a := range s.telemetry.InstalledApps {
			if a.NodeID != nodeID {
				filteredApps = append(filteredApps, a)
			}
		}
		s.telemetry.InstalledApps = filteredApps
	}

	delete(s.telemetry.Devices, nodeID)
	if err := s.saveTelemetryLocked(); err != nil {
		return err
	}

	// Purge or rename the per-client folder on disk.
	oldDir := s.clientDir(nodeID)
	if mergeTargetNodeID != "" {
		// Merge: move source folder contents into target, then remove source.
		// saveTelemetryLocked already wrote merged data to target dir;
		// just clean up the stale source folder.
		_ = os.RemoveAll(oldDir)
	} else if deleteData {
		// Hard delete: wipe entire client folder.
		if err := os.RemoveAll(oldDir); err != nil {
			slog.Warn("Failed to remove client directory", "path", oldDir, "err", err)
		}
	}
	return nil
}

// UpdateDeviceInfo updates the display alias and/or node ID for a registered device.
func (s *JSONStore) UpdateDeviceInfo(nodeID, newDisplayName, newNodeID string, syncIntervalSeconds int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	dev, exists := s.telemetry.Devices[nodeID]
	if !exists {
		dev = DeviceInfo{
			NodeID:              nodeID,
			DisplayName:         newDisplayName,
			Platform:            "android",
			LastSeenAt:          time.Now().UTC().Format(time.RFC3339),
			IsOnline:            true,
			SyncIntervalSeconds: 900,
		}
	}

	if newDisplayName != "" {
		dev.DisplayName = newDisplayName
	}
	if syncIntervalSeconds > 0 {
		dev.SyncIntervalSeconds = syncIntervalSeconds
	}

	targetNodeID := nodeID
	if newNodeID != "" && newNodeID != nodeID {
		targetNodeID = newNodeID
		dev.NodeID = newNodeID

		// Re-key device registry
		delete(s.telemetry.Devices, nodeID)

		// Update historical telemetry references
		for i := range s.telemetry.Calls {
			if s.telemetry.Calls[i].NodeID == nodeID {
				s.telemetry.Calls[i].NodeID = newNodeID
				if newDisplayName != "" {
					s.telemetry.Calls[i].DeviceName = newDisplayName
				}
			}
		}
		for i := range s.telemetry.Messages {
			if s.telemetry.Messages[i].NodeID == nodeID {
				s.telemetry.Messages[i].NodeID = newNodeID
				if newDisplayName != "" {
					s.telemetry.Messages[i].DeviceName = newDisplayName
				}
			}
		}
		for i := range s.telemetry.Locations {
			if s.telemetry.Locations[i].NodeID == nodeID {
				s.telemetry.Locations[i].NodeID = newNodeID
				if newDisplayName != "" {
					s.telemetry.Locations[i].DeviceName = newDisplayName
				}
			}
		}
		for i := range s.telemetry.Contacts {
			if s.telemetry.Contacts[i].NodeID == nodeID {
				s.telemetry.Contacts[i].NodeID = newNodeID
				if newDisplayName != "" {
					s.telemetry.Contacts[i].DeviceName = newDisplayName
				}
			}
		}
		for i := range s.telemetry.Notifications {
			if s.telemetry.Notifications[i].NodeID == nodeID {
				s.telemetry.Notifications[i].NodeID = newNodeID
				if newDisplayName != "" {
					s.telemetry.Notifications[i].DeviceName = newDisplayName
				}
			}
		}
		for i := range s.telemetry.InstalledApps {
			if s.telemetry.InstalledApps[i].NodeID == nodeID {
				s.telemetry.InstalledApps[i].NodeID = newNodeID
				if newDisplayName != "" {
					s.telemetry.InstalledApps[i].DeviceName = newDisplayName
				}
			}
		}
	} else if newDisplayName != "" {
		// Update historical display names
		for i := range s.telemetry.Calls {
			if s.telemetry.Calls[i].NodeID == nodeID {
				s.telemetry.Calls[i].DeviceName = newDisplayName
			}
		}
		for i := range s.telemetry.Messages {
			if s.telemetry.Messages[i].NodeID == nodeID {
				s.telemetry.Messages[i].DeviceName = newDisplayName
			}
		}
		for i := range s.telemetry.Locations {
			if s.telemetry.Locations[i].NodeID == nodeID {
				s.telemetry.Locations[i].DeviceName = newDisplayName
			}
		}
		for i := range s.telemetry.Contacts {
			if s.telemetry.Contacts[i].NodeID == nodeID {
				s.telemetry.Contacts[i].DeviceName = newDisplayName
			}
		}
		for i := range s.telemetry.Notifications {
			if s.telemetry.Notifications[i].NodeID == nodeID {
				s.telemetry.Notifications[i].DeviceName = newDisplayName
			}
		}
		for i := range s.telemetry.InstalledApps {
			if s.telemetry.InstalledApps[i].NodeID == nodeID {
				s.telemetry.InstalledApps[i].DeviceName = newDisplayName
			}
		}
	}

	s.telemetry.Devices[targetNodeID] = dev
	if err := s.saveTelemetryLocked(); err != nil {
		return err
	}

	// Rename per-client folder on disk when the NodeID changed.
	if targetNodeID != nodeID {
		oldDir := s.clientDir(nodeID)
		newDir := s.clientDir(targetNodeID)
		if _, err := os.Stat(oldDir); err == nil {
			if renameErr := os.Rename(oldDir, newDir); renameErr != nil {
				// Fallback: saveTelemetryLocked already wrote to newDir, so just remove old.
				_ = os.RemoveAll(oldDir)
			}
		}
	}
	return nil
}

// GetDevice retrieves a specific registered device by its Node ID, hostname, or substring match.
func (s *JSONStore) GetDevice(nodeID string) (DeviceInfo, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if dev, ok := s.telemetry.Devices[nodeID]; ok {
		return dev, true
	}
	cleanID := strings.TrimSpace(nodeID)
	for id, dev := range s.telemetry.Devices {
		if strings.EqualFold(id, cleanID) || strings.EqualFold(dev.Hostname, cleanID) || strings.EqualFold(dev.DisplayName, cleanID) {
			return dev, true
		}
		if len(cleanID) >= 4 && (strings.HasPrefix(strings.ToLower(id), strings.ToLower(cleanID)) || strings.HasPrefix(strings.ToLower(cleanID), strings.ToLower(id)) || strings.Contains(strings.ToLower(id), strings.ToLower(cleanID))) {
			return dev, true
		}
	}
	return DeviceInfo{}, false
}

// GetContacts retrieves stored contacts for a given node or all nodes.
func (s *JSONStore) GetContacts(nodeID string) []ContactItem {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if nodeID == "" {
		res := make([]ContactItem, len(s.telemetry.Contacts))
		copy(res, s.telemetry.Contacts)
		return res
	}
	var res []ContactItem
	for _, c := range s.telemetry.Contacts {
		if c.NodeID == nodeID {
			res = append(res, c)
		}
	}
	return res
}

// ─────────────────────────────────────────────────────────────────────────────
// Memories Operations
// ─────────────────────────────────────────────────────────────────────────────

func (s *JSONStore) ListMemories(username, category string) []MemoryItem {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []MemoryItem
	for _, m := range s.memories {
		if username != "" && m.Username != username {
			continue
		}
		if category != "" && m.Category != category {
			continue
		}
		result = append(result, m)
	}
	sort.SliceStable(result, func(i, j int) bool {
		return result[i].CreatedAt > result[j].CreatedAt
	})
	return result
}

func (s *JSONStore) SaveMemory(username, content, category string, importance int) (*MemoryItem, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if category == "" {
		category = "general"
	}
	if importance <= 0 {
		importance = 5
	}

	nowStr := time.Now().UTC().Format(time.RFC3339)
	mem := MemoryItem{
		ID:         generateID(),
		Username:   username,
		Content:    content,
		Category:   category,
		Importance: importance,
		CreatedAt:  nowStr,
	}

	s.memories = append([]MemoryItem{mem}, s.memories...)
	return &mem, s.saveMemoriesLocked()
}

func (s *JSONStore) DeleteMemory(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var updated []MemoryItem
	for _, m := range s.memories {
		if m.ID != id {
			updated = append(updated, m)
		}
	}
	s.memories = updated
	return s.saveMemoriesLocked()
}

// SearchMemories performs keyword / token matching across memories.
func (s *JSONStore) SearchMemories(query string, limit int) []MemoryItem {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if limit <= 0 {
		limit = 10
	}
	q := strings.ToLower(strings.TrimSpace(query))
	tokens := strings.Fields(q)

	type scored struct {
		mem   MemoryItem
		score int
	}
	var matches []scored

	for _, m := range s.memories {
		contentLower := strings.ToLower(m.Content)
		categoryLower := strings.ToLower(m.Category)

		score := 0
		if strings.Contains(contentLower, q) {
			score += 10
		}
		for _, tok := range tokens {
			if strings.Contains(contentLower, tok) {
				score += 3
			}
			if strings.Contains(categoryLower, tok) {
				score += 2
			}
		}
		if score > 0 {
			matches = append(matches, scored{mem: m, score: score})
		}
	}

	sort.SliceStable(matches, func(i, j int) bool {
		if matches[i].score != matches[j].score {
			return matches[i].score > matches[j].score
		}
		return matches[i].mem.Importance > matches[j].mem.Importance
	})

	var result []MemoryItem
	for i, m := range matches {
		if i >= limit {
			break
		}
		result = append(result, m.mem)
	}
	return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Integrations Operations (Baïkal, etc.)
// ─────────────────────────────────────────────────────────────────────────────

func (s *JSONStore) SaveIntegration(serviceName string, config map[string]any, enabled bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.integrations[serviceName] = IntegrationConfig{
		ServiceName: serviceName,
		Enabled:     enabled,
		Config:      config,
		UpdatedAt:   time.Now().UTC().Format(time.RFC3339),
	}
	return s.saveIntegrationsLocked()
}

func (s *JSONStore) GetIntegration(serviceName string) (config map[string]any, enabled bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	cfg, ok := s.integrations[serviceName]
	if !ok {
		return map[string]any{}, false
	}
	return cfg.Config, cfg.Enabled
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

func generateID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// ─────────────────────────────────────────────────────────────────────────────
// User Session Operations (100% Local JSON Persistence, No Expiry, Real-Time Online Status)
// ─────────────────────────────────────────────────────────────────────────────

func (s *JSONStore) SaveSession(sess UserSessionItem) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	nowStr := time.Now().UTC().Format(time.RFC3339)
	if sess.CreatedAt == "" {
		sess.CreatedAt = nowStr
	}
	if sess.LastActiveAt == "" {
		sess.LastActiveAt = nowStr
	}
	sess.IsActive = true
	sess.RevokedAt = ""

	found := false
	for i, existing := range s.sessions {
		if existing.ID == sess.ID {
			s.sessions[i] = sess
			found = true
			break
		}
	}
	if !found {
		s.sessions = append([]UserSessionItem{sess}, s.sessions...)
	}

	return s.saveSessionsLocked()
}

func (s *JSONStore) TouchSession(sessionID string) error {
	if sessionID == "" {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	nowStr := time.Now().UTC().Format(time.RFC3339)
	for i, sess := range s.sessions {
		if sess.ID == sessionID {
			s.sessions[i].LastActiveAt = nowStr
			if !sess.IsActive && sess.RevokedAt == "" {
				s.sessions[i].IsActive = true
			}
			return s.saveSessionsLocked()
		}
	}
	return nil
}

func (s *JSONStore) UpdateSessionMetadata(sessionID string, devName, osName, browserName, clientType string) error {
	if sessionID == "" {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	for i, sess := range s.sessions {
		if sess.ID == sessionID {
			if devName != "" {
				s.sessions[i].DeviceName = devName
			}
			if osName != "" {
				s.sessions[i].OS = osName
			}
			if browserName != "" {
				s.sessions[i].Browser = browserName
			}
			if clientType != "" {
				s.sessions[i].ClientType = clientType
			}
			return s.saveSessionsLocked()
		}
	}
	return nil
}

func (s *JSONStore) GetSessionsByUsername(username string, currentSessionID string, isOnlineFn func(sessionID, username, clientType string) bool) ([]UserSessionItem, int, int, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []UserSessionItem
	totalCount := 0
	activeCount := 0
	now := time.Now().UTC()

	for _, sess := range s.sessions {
		if sess.Username != username && username != "" {
			continue
		}

		item := sess
		if item.ID == currentSessionID {
			item.IsCurrent = true
		}

		// Calculate presence (Online vs Offline vs Revoked)
		if item.RevokedAt != "" || !item.IsActive {
			item.IsActive = false
			item.IsOnline = false
			item.Status = "revoked"
		} else {
			item.IsActive = true
			activeCount++

			// Check live WebSocket connection or recent activity (<90s)
			isWsOnline := false
			if isOnlineFn != nil {
				isWsOnline = isOnlineFn(item.ID, item.Username, item.ClientType)
			}

			isRecentActivity := false
			if lastActive, err := time.Parse(time.RFC3339, item.LastActiveAt); err == nil {
				if now.Sub(lastActive) < 90*time.Second {
					isRecentActivity = true
				}
			}

			if isWsOnline || isRecentActivity || item.IsCurrent {
				item.IsOnline = true
				item.Status = "online"
			} else {
				item.IsOnline = false
				item.Status = "offline"
			}
		}

		totalCount++
		result = append(result, item)
	}

	return result, totalCount, activeCount, nil
}

func (s *JSONStore) RevokeSession(sessionID string, username string) error {
	if sessionID == "" {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	nowStr := time.Now().UTC().Format(time.RFC3339)
	for i, sess := range s.sessions {
		if sess.ID == sessionID && (username == "" || sess.Username == username) {
			s.sessions[i].IsActive = false
			s.sessions[i].RevokedAt = nowStr
			s.sessions[i].Status = "revoked"
			s.sessions[i].IsOnline = false
		}
	}
	return s.saveSessionsLocked()
}

func (s *JSONStore) RevokeAllSessions(username string) error {
	if username == "" {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	nowStr := time.Now().UTC().Format(time.RFC3339)
	for i, sess := range s.sessions {
		if sess.Username == username {
			s.sessions[i].IsActive = false
			s.sessions[i].RevokedAt = nowStr
			s.sessions[i].Status = "revoked"
			s.sessions[i].IsOnline = false
		}
	}
	return s.saveSessionsLocked()
}

func (s *JSONStore) IsSessionRevoked(sessionID string) bool {
	if sessionID == "" {
		return false
	}
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, sess := range s.sessions {
		if sess.ID == sessionID {
			return !sess.IsActive || sess.RevokedAt != ""
		}
	}
	return false
}

// ImportLocations ingests an array of external LocationItem records into the store with deduplication.
func (s *JSONStore) ImportLocations(nodeID string, items []LocationItem) (int, error) {
	if len(items) == 0 {
		return 0, nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	nowStr := time.Now().UTC().Format(time.RFC3339)
	devName := "Device"
	if nodeID != "" {
		if d, exists := s.telemetry.Devices[nodeID]; exists && d.DisplayName != "" {
			devName = d.DisplayName
		}
	}

	keyMap := make(map[string]bool, len(s.telemetry.Locations))
	for _, l := range s.telemetry.Locations {
		keyMap[fmt.Sprintf("%s|%f|%f|%s", l.NodeID, l.Latitude, l.Longitude, l.Timestamp)] = true
	}

	importedCount := 0
	var newItems []LocationItem
	for _, item := range items {
		if item.Latitude == 0 && item.Longitude == 0 {
			continue
		}
		// If target nodeID is provided, always bind/re-key to the target device
		if nodeID != "" {
			item.NodeID = nodeID
			item.DeviceName = devName
		} else if item.NodeID == "" {
			item.NodeID = "device"
			item.DeviceName = devName
		}
		if item.Timestamp == "" {
			item.Timestamp = time.Now().Format("2006-01-02 15:04:05")
		}
		if item.CreatedAt == "" {
			item.CreatedAt = nowStr
		}
		// Always assign a fresh collision-free unique ID
		item.ID = generateID()

		key := fmt.Sprintf("%s|%f|%f|%s", item.NodeID, item.Latitude, item.Longitude, item.Timestamp)
		if !keyMap[key] {
			keyMap[key] = true
			newItems = append(newItems, item)
			importedCount++
		}
	}

	if len(newItems) > 0 {
		s.telemetry.Locations = append(newItems, s.telemetry.Locations...)
		// Sort newest first
		sort.SliceStable(s.telemetry.Locations, func(i, j int) bool {
			return s.telemetry.Locations[i].Timestamp > s.telemetry.Locations[j].Timestamp
		})
		if len(s.telemetry.Locations) > 1000 {
			s.telemetry.Locations = s.telemetry.Locations[:1000]
		}
		if err := s.saveTelemetryLocked(); err != nil {
			return 0, err
		}
	}

	return importedCount, nil
}

// ImportNotifications ingests an array of external NotificationItem records into the store with deduplication.
func (s *JSONStore) ImportNotifications(nodeID string, items []NotificationItem) (int, error) {
	if len(items) == 0 {
		return 0, nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	nowStr := time.Now().UTC().Format(time.RFC3339)
	devName := "Device"
	if nodeID != "" {
		if d, exists := s.telemetry.Devices[nodeID]; exists && d.DisplayName != "" {
			devName = d.DisplayName
		}
	}

	keyMap := make(map[string]bool, len(s.telemetry.Notifications))
	for _, n := range s.telemetry.Notifications {
		keyMap[fmt.Sprintf("%s|%s|%s|%s", n.NodeID, n.PackageName, n.Timestamp, n.Title)] = true
	}

	importedCount := 0
	var newItems []NotificationItem
	for _, item := range items {
		if item.PackageName == "" && item.Title == "" && item.Text == "" {
			continue
		}
		// If target nodeID is provided, always bind/re-key to the target device
		if nodeID != "" {
			item.NodeID = nodeID
			item.DeviceName = devName
		} else if item.NodeID == "" {
			item.NodeID = "device"
			item.DeviceName = devName
		}
		if item.Timestamp == "" {
			item.Timestamp = nowStr
		}
		if item.CreatedAt == "" {
			item.CreatedAt = nowStr
		}
		// Always assign a fresh collision-free unique ID
		item.ID = generateID()

		key := fmt.Sprintf("%s|%s|%s|%s", item.NodeID, item.PackageName, item.Timestamp, item.Title)
		if !keyMap[key] {
			keyMap[key] = true
			newItems = append(newItems, item)
			importedCount++
		}
	}

	if len(newItems) > 0 {
		s.telemetry.Notifications = append(newItems, s.telemetry.Notifications...)
		sort.SliceStable(s.telemetry.Notifications, func(i, j int) bool {
			return s.telemetry.Notifications[i].Timestamp > s.telemetry.Notifications[j].Timestamp
		})
		if len(s.telemetry.Notifications) > 1000 {
			s.telemetry.Notifications = s.telemetry.Notifications[:1000]
		}
		if err := s.saveTelemetryLocked(); err != nil {
			return 0, err
		}
	}

	return importedCount, nil
}

// Set persists any serializable struct/map under a named json file in the store base directory.
func (s *JSONStore) Set(key string, val any) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := json.MarshalIndent(val, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal %s: %w", key, err)
	}

	targetPath := filepath.Join(s.baseDir, fmt.Sprintf("%s.json", key))
	tmpPath := fmt.Sprintf("%s.tmp", targetPath)

	if err := os.WriteFile(tmpPath, data, 0644); err != nil {
		return fmt.Errorf("write %s: %w", key, err)
	}
	return os.Rename(tmpPath, targetPath)
}

// Get retrieves a persisted JSON document by key and unmarshals into target.
func (s *JSONStore) Get(key string, target any) error {
	s.mu.RLock()
	defer s.mu.RUnlock()

	targetPath := filepath.Join(s.baseDir, fmt.Sprintf("%s.json", key))
	data, err := os.ReadFile(targetPath)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, target)
}

