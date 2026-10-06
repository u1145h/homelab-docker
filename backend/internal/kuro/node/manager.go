package node

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/ullashroy/poco-server/backend/internal/kuro/db"
)

const (
	MsgRegister  = "REGISTER"
	MsgHeartbeat = "HEARTBEAT"
	MsgEvent     = "EVENT"
	MsgResult    = "RESULT"
	MsgCommand   = "COMMAND"
	MsgPing      = "PING"
	MsgPong      = "PONG"
	MsgError     = "ERROR"
)

type NodeMessage struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data,omitempty"`
}

type RegisterPayload struct {
	NodeID       string   `json:"node_id"`
	Platform     string   `json:"platform"`
	Hostname     string   `json:"hostname"`
	DisplayName  string   `json:"display_name"`
	Capabilities []string `json:"capabilities"`
	NodeSecret   string   `json:"node_secret"`
	Metadata     any      `json:"metadata"`
}

type HeartbeatPayload struct {
	NodeID    string `json:"node_id"`
	Timestamp string `json:"timestamp"`
	System    any    `json:"system"`
	Network   any    `json:"network"`
	Battery   any    `json:"battery,omitempty"`
	ActiveApp string `json:"active_app,omitempty"`
}

type EventPayload struct {
	NodeID    string `json:"node_id"`
	EventType string `json:"event_type"`
	Data      any    `json:"data"`
}

type CommandPayload struct {
	CommandID  string `json:"command_id"`
	Capability string `json:"capability"`
	Params     any    `json:"params"`
}

type ResultPayload struct {
	CommandID string `json:"command_id"`
	Success   bool   `json:"success"`
	Data      any    `json:"data,omitempty"`
	Error     string `json:"error,omitempty"`
}

type PendingCommand struct {
	ResultCh chan ResultPayload
}

type ConnectedNode struct {
	ID           string
	SessionID    string
	ClientType   string
	Platform     string
	Hostname     string
	DisplayName  string
	Capabilities []string
	Username     string
	Role         string
	Conn         *websocket.Conn
	ConnectedAt  time.Time
	LastSeen     time.Time

	mu      sync.Mutex
	pending map[string]*PendingCommand
}

func (n *ConnectedNode) Send(msgType string, data any) error {
	payload, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("marshaling node message: %w", err)
	}
	msg := NodeMessage{Type: msgType, Data: payload}
	n.mu.Lock()
	defer n.mu.Unlock()
	return n.Conn.WriteJSON(msg)
}

func (n *ConnectedNode) HasCapability(cap string) bool {
	for _, c := range n.Capabilities {
		if c == cap {
			return true
		}
	}
	return false
}

type Manager struct {
	nodeSecret    string
	timeout       time.Duration
	db            *db.DB
	mu            sync.RWMutex
	nodes         map[string]*ConnectedNode
	cameraFrames  map[string]string
	cameraFrameMu sync.RWMutex
}

func NewManager(nodeSecret string, timeout time.Duration, database *db.DB) *Manager {
	if timeout <= 0 {
		timeout = 90 * time.Second
	}
	m := &Manager{
		nodeSecret:   nodeSecret,
		timeout:      timeout,
		db:           database,
		nodes:        make(map[string]*ConnectedNode),
		cameraFrames: make(map[string]string),
	}
	go m.heartbeatMonitor()
	return m
}

func (m *Manager) SetLatestCameraFrame(nodeID, frameB64 string) {
	m.cameraFrameMu.Lock()
	defer m.cameraFrameMu.Unlock()
	if m.cameraFrames == nil {
		m.cameraFrames = make(map[string]string)
	}
	m.cameraFrames[nodeID] = frameB64
}

func (m *Manager) GetLatestCameraFrame(nodeID string) string {
	m.cameraFrameMu.RLock()
	defer m.cameraFrameMu.RUnlock()
	if m.cameraFrames == nil {
		return ""
	}
	return m.cameraFrames[nodeID]
}

func (m *Manager) DB() *db.DB {
	return m.db
}

func (m *Manager) NodeSecret() string { return m.nodeSecret }

func (m *Manager) Register(n *ConnectedNode) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if existing, ok := m.nodes[n.ID]; ok {
		existing.Conn.Close()
	}

	m.nodes[n.ID] = n
	slog.Info("kuro node registered",
		"node", n.ID,
		"platform", n.Platform,
		"username", n.Username,
		"caps", len(n.Capabilities),
	)
}

func (m *Manager) Unregister(nodeID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.nodes, nodeID)
	slog.Info("kuro node disconnected", "node", nodeID)
}

// BroadcastToUser dispatches a real-time event to all active client WebSocket connections for a specific user.
func (m *Manager) BroadcastToUser(username string, msgType string, data any) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, n := range m.nodes {
		if username == "" || strings.EqualFold(n.Username, username) {
			_ = n.Send(msgType, data)
		}
	}
}

// IsNodeOwnedBy verifies if a node is owned by the specified username or if the actor is an admin.
func (m *Manager) IsNodeOwnedBy(nodeID string, username string, role string) bool {
	if role == "admin" {
		return true
	}
	if username == "" {
		return false
	}
	// Check memory active nodes
	if n, ok := m.Get(nodeID); ok {
		if strings.EqualFold(n.Username, username) {
			return true
		}
	}
	// Check database nodes
	if m.db != nil {
		if dbNode, err := m.db.GetNode(nodeID); err == nil && dbNode != nil {
			if strings.EqualFold(dbNode.Username, username) {
				return true
			}
		}
	}
	return false
}

// DisconnectAndLogout sends a LOGOUT command to the node and actively terminates the connection.
func (m *Manager) DisconnectAndLogout(nodeID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if n, ok := m.nodes[nodeID]; ok {
		_ = n.Send("LOGOUT", map[string]any{
			"reason":  "client_deleted",
			"node_id": nodeID,
		})
		_ = n.Conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.ClosePolicyViolation, "client_deleted"), time.Now().Add(time.Second))
		_ = n.Conn.Close()
		delete(m.nodes, nodeID)
		slog.Info("kuro node disconnected and logged out by admin", "node", nodeID)
	}
}

// DisconnectAndLogoutSession sends a LOGOUT command to any active node connection associated with a specific session ID or user.
func (m *Manager) DisconnectAndLogoutSession(sessionID string, username string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	var targets []string
	for id, n := range m.nodes {
		if (sessionID != "" && n.SessionID == sessionID) || (sessionID == "" && username != "" && strings.EqualFold(n.Username, username)) {
			targets = append(targets, id)
		}
	}

	for _, nodeID := range targets {
		if n, ok := m.nodes[nodeID]; ok {
			_ = n.Send("LOGOUT", map[string]any{
				"reason":     "session_revoked",
				"session_id": sessionID,
				"node_id":    nodeID,
			})
			_ = n.Conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.ClosePolicyViolation, "session_revoked"), time.Now().Add(time.Second))
			_ = n.Conn.Close()
			delete(m.nodes, nodeID)
			slog.Info("kuro node disconnected and logged out due to session revocation", "node", nodeID, "session", sessionID, "user", username)
		}
	}
}

// IsSessionConnected checks if there is an active WebSocket connection matching sessionID or user+clientType.
func (m *Manager) IsSessionConnected(sessionID, username, clientType string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, n := range m.nodes {
		if sessionID != "" && n.SessionID == sessionID {
			return true
		}
		if username != "" && strings.EqualFold(n.Username, username) {
			if clientType == "" || strings.EqualFold(n.ClientType, clientType) {
				return true
			}
		}
	}
	return false
}

// UpdateNodeConfig updates the in-memory connected node's ID and display name, notifying the client.
func (m *Manager) UpdateNodeConfig(nodeID string, displayName string, newID string, syncIntervalSeconds int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if n, ok := m.nodes[nodeID]; ok {
		if displayName != "" {
			n.DisplayName = displayName
		}
		if newID != "" && newID != nodeID {
			n.ID = newID
			delete(m.nodes, nodeID)
			m.nodes[newID] = n
		}
		payload := map[string]any{
			"node_id":      n.ID,
			"display_name": n.DisplayName,
			"name":         n.DisplayName,
		}
		if syncIntervalSeconds > 0 {
			payload["sync_interval_seconds"] = syncIntervalSeconds
		}
		_ = n.Send("CONFIG_UPDATE", payload)
		_ = n.Send(MsgCommand, CommandPayload{
			CommandID:  generateID(),
			Capability: "config_update",
			Params:     payload,
		})
	}
}

func (m *Manager) Get(nodeID string) (*ConnectedNode, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// 1. Direct exact map lookup
	if n, ok := m.nodes[nodeID]; ok {
		return n, true
	}

	// 2. Case-insensitive / trimmed match
	cleanID := strings.TrimSpace(nodeID)
	for id, n := range m.nodes {
		if strings.EqualFold(id, cleanID) {
			return n, true
		}
	}

	// 3. Prefix & substring match on node ID (e.g. sm-m566b vs sm-m566b-b077)
	if len(cleanID) >= 4 {
		for id, n := range m.nodes {
			if strings.HasPrefix(strings.ToLower(id), strings.ToLower(cleanID)) ||
				strings.HasPrefix(strings.ToLower(cleanID), strings.ToLower(id)) ||
				strings.Contains(strings.ToLower(id), strings.ToLower(cleanID)) ||
				strings.Contains(strings.ToLower(cleanID), strings.ToLower(id)) {
				return n, true
			}
		}
	}

	// 4. Match against Hostname or DisplayName
	for _, n := range m.nodes {
		if strings.EqualFold(n.Hostname, cleanID) || strings.EqualFold(n.DisplayName, cleanID) ||
			strings.Contains(strings.ToLower(n.Hostname), strings.ToLower(cleanID)) ||
			strings.Contains(strings.ToLower(n.DisplayName), strings.ToLower(cleanID)) {
			return n, true
		}
	}

	return nil, false
}

func (m *Manager) List() []*ConnectedNode {
	m.mu.RLock()
	defer m.mu.RUnlock()
	nodes := make([]*ConnectedNode, 0, len(m.nodes))
	for _, n := range m.nodes {
		nodes = append(nodes, n)
	}
	return nodes
}

func (m *Manager) ListForUser(username string, role string) []*ConnectedNode {
	m.mu.RLock()
	defer m.mu.RUnlock()
	nodes := make([]*ConnectedNode, 0, len(m.nodes))
	for _, n := range m.nodes {
		if role == "admin" || strings.EqualFold(n.Username, username) {
			nodes = append(nodes, n)
		}
	}
	return nodes
}

// RequestSyncAll broadcasts an immediate full telemetry & data sync request to all active connected nodes.
func (m *Manager) RequestSyncAll() {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, n := range m.nodes {
		cmdID := generateID()
		_ = n.Send(MsgCommand, CommandPayload{
			CommandID:  cmdID,
			Capability: "sync_data",
			Params:     map[string]any{"force": true, "full_sync": true, "action": "sync"},
		})
	}
}

// RequestSyncNode requests an immediate full telemetry & data sync from a specific connected node.
func (m *Manager) RequestSyncNode(nodeID string) {
	if n, ok := m.Get(nodeID); ok {
		cmdID := generateID()
		_ = n.Send(MsgCommand, CommandPayload{
			CommandID:  cmdID,
			Capability: "sync_data",
			Params:     map[string]any{"force": true, "full_sync": true, "action": "sync"},
		})
	}
}

// SetLiveTracking instructs a connected node to start or stop live GPS streaming.
func (m *Manager) SetLiveTracking(nodeID string, enabled bool, intervalMs int) error {
	if intervalMs <= 0 {
		intervalMs = 2000
	}
	n, ok := m.Get(nodeID)
	if !ok {
		return fmt.Errorf("node %q is not connected", nodeID)
	}
	cmdID := generateID()
	return n.Send(MsgCommand, CommandPayload{
		CommandID:  cmdID,
		Capability: "live_track",
		Params: map[string]any{
			"enabled":     enabled,
			"interval_ms": intervalMs,
			"action":      "live_track",
		},
	})
}

func (m *Manager) SendCommand(nodeID, capability string, params any, timeout time.Duration) (*ResultPayload, error) {
	node, ok := m.Get(nodeID)
	if !ok {
		return nil, fmt.Errorf("node %q is not connected", nodeID)
	}

	commandID := generateID()
	pending := &PendingCommand{
		ResultCh: make(chan ResultPayload, 1),
	}

	node.mu.Lock()
	if node.pending == nil {
		node.pending = make(map[string]*PendingCommand)
	}
	node.pending[commandID] = pending
	node.mu.Unlock()

	defer func() {
		node.mu.Lock()
		delete(node.pending, commandID)
		node.mu.Unlock()
	}()

	if err := node.Send(MsgCommand, CommandPayload{
		CommandID:  commandID,
		Capability: capability,
		Params:     params,
	}); err != nil {
		return nil, fmt.Errorf("sending command to node %q: %w", nodeID, err)
	}

	select {
	case result := <-pending.ResultCh:
		return &result, nil
	case <-time.After(timeout):
		return nil, fmt.Errorf("command %q timed out waiting for node %q", capability, nodeID)
	}
}

func (m *Manager) DeliverResult(nodeID string, result ResultPayload) {
	node, ok := m.Get(nodeID)
	if !ok {
		return
	}
	node.mu.Lock()
	defer node.mu.Unlock()
	if p, ok := node.pending[result.CommandID]; ok {
		p.ResultCh <- result
	}
}

func (m *Manager) BuildToolList(username, role string) []map[string]any {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var tools []map[string]any
	for _, node := range m.nodes {
		if role != "admin" && !strings.EqualFold(node.Username, username) {
			continue
		}
		for _, cap := range node.Capabilities {
			tool := capabilityToTool(node.ID, node.Platform, cap)
			if tool != nil {
				tools = append(tools, tool)
			}
		}
	}
	return tools
}

func (m *Manager) DeviceContextSummary(username, role string) string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var userNodes []*ConnectedNode
	for _, n := range m.nodes {
		if role == "admin" || strings.EqualFold(n.Username, username) {
			userNodes = append(userNodes, n)
		}
	}

	if len(userNodes) == 0 {
		return "No client devices currently connected for your account."
	}

	var sb strings.Builder
	sb.WriteString("## Connected External Devices:\n")
	for _, n := range userNodes {
		sb.WriteString(fmt.Sprintf("- %s (%s, %s) — %d capabilities\n",
			n.DisplayName, n.ID, n.Platform, len(n.Capabilities)))
	}
	return sb.String()
}

func (m *Manager) heartbeatMonitor() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		m.mu.Lock()
		now := time.Now()
		for id, node := range m.nodes {
			if now.Sub(node.LastSeen) > m.timeout {
				slog.Warn("kuro node heartbeat timeout", "node", id)
				node.Conn.Close()
				delete(m.nodes, id)
			}
		}
		m.mu.Unlock()
	}
}

func capabilityToTool(nodeID, platform, capability string) map[string]any {
	definitions := map[string]map[string]any{
		"notifications.send": {
			"description": fmt.Sprintf("Send a notification to %s (%s)", platform, nodeID),
			"parameters": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"title": map[string]any{"type": "string", "description": "Notification title"},
					"body":  map[string]any{"type": "string", "description": "Notification body text"},
				},
				"required": []string{"title", "body"},
			},
		},
		"system.get_metrics": {
			"description": fmt.Sprintf("Get system metrics (CPU, RAM, disk, network) from %s (%s)", platform, nodeID),
			"parameters":  map[string]any{"type": "object", "properties": map[string]any{}},
		},
		"system.get_processes": {
			"description": fmt.Sprintf("Get running processes list from %s (%s)", platform, nodeID),
			"parameters":  map[string]any{"type": "object", "properties": map[string]any{}},
		},
		"system.kill_process": {
			"description": fmt.Sprintf("Kill a process on %s (%s)", platform, nodeID),
			"parameters": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"pid":          map[string]any{"type": "integer", "description": "Process ID to kill"},
					"process_name": map[string]any{"type": "string", "description": "Process name"},
				},
				"required": []string{"pid", "process_name"},
			},
		},
		"system.shutdown": {
			"description": fmt.Sprintf("Shutdown or restart %s (%s)", platform, nodeID),
			"parameters": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"action": map[string]any{"type": "string", "enum": []string{"shutdown", "restart", "sleep", "hibernate"}},
				},
				"required": []string{"action"},
			},
		},
		"services.list": {
			"description": fmt.Sprintf("List Windows services on %s (%s)", platform, nodeID),
			"parameters":  map[string]any{"type": "object", "properties": map[string]any{}},
		},
		"services.control": {
			"description": fmt.Sprintf("Start, stop, or restart a Windows service on %s (%s)", platform, nodeID),
			"parameters": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"service_name": map[string]any{"type": "string"},
					"action":       map[string]any{"type": "string", "enum": []string{"start", "stop", "restart"}},
				},
				"required": []string{"service_name", "action"},
			},
		},
		"filesystem.search": {
			"description": fmt.Sprintf("Search for files on %s (%s)", platform, nodeID),
			"parameters": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"query":     map[string]any{"type": "string", "description": "Search term"},
					"directory": map[string]any{"type": "string", "description": "Directory to search in"},
				},
				"required": []string{"query"},
			},
		},
		"battery.get": {
			"description": fmt.Sprintf("Get battery level and charging state from %s (%s)", platform, nodeID),
			"parameters":  map[string]any{"type": "object", "properties": map[string]any{}},
		},
		"system.ring": {
			"description": fmt.Sprintf("Ring %s (%s) with a loud finding alarm tone even if set to silent or vibrate", platform, nodeID),
			"parameters": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"duration_seconds": map[string]any{"type": "integer", "description": "Duration to ring in seconds (default 30)"},
				},
			},
		},
	}

	def, ok := definitions[capability]
	if !ok {
		def = map[string]any{
			"description": fmt.Sprintf("Execute capability %q on %s (%s)", capability, platform, nodeID),
			"parameters":  map[string]any{"type": "object", "properties": map[string]any{}},
		}
	}

	toolName := fmt.Sprintf("%s__%s", nodeID, strings.ReplaceAll(capability, ".", "_"))
	return map[string]any{
		"type": "function",
		"function": map[string]any{
			"name":        toolName,
			"description": def["description"],
			"parameters":  def["parameters"],
		},
	}
}

func generateID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}
