package db

import (
	"crypto/rand"
	"database/sql"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

//go:embed schema.sql
var schemaSQL string

// DB wraps the SQLite database for Kuro AI operations.
type DB struct {
	sql *sql.DB
}

// New opens or creates the SQLite database for Kuro.
func New(path string) (*DB, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, fmt.Errorf("creating kuro data directory: %w", err)
	}

	dsn := fmt.Sprintf(
		"file:%s?_journal_mode=WAL&_foreign_keys=on&_busy_timeout=5000&_synchronous=NORMAL",
		path,
	)
	sqlDB, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("opening kuro database: %w", err)
	}

	sqlDB.SetMaxOpenConns(1)
	sqlDB.SetMaxIdleConns(1)

	if err := sqlDB.Ping(); err != nil {
		return nil, fmt.Errorf("pinging kuro database: %w", err)
	}

	d := &DB{sql: sqlDB}
	if err := d.Migrate(); err != nil {
		return nil, err
	}

	return d, nil
}

func (d *DB) Close() error { return d.sql.Close() }

func (d *DB) Migrate() error {
	if _, err := d.sql.Exec(schemaSQL); err != nil {
		return fmt.Errorf("applying kuro schema: %w", err)
	}
	return nil
}

// ─────────────────────────────────────────────
// Conversations
// ─────────────────────────────────────────────

type Conversation struct {
	ID            string  `json:"id"`
	Username      string  `json:"username"`
	Title         string  `json:"title"`
	CreatedAt     string  `json:"created_at"`
	UpdatedAt     string  `json:"updated_at"`
	LastMessageAt *string `json:"last_message_at,omitempty"`
}

func (d *DB) CreateConversation(username, title string) (*Conversation, error) {
	id := newID()
	_, err := d.sql.Exec(
		`INSERT INTO kuro_conversations (id, username, title) VALUES (?, ?, ?)`,
		id, username, title,
	)
	if err != nil {
		return nil, fmt.Errorf("create conversation: %w", err)
	}
	return d.GetConversation(id)
}

func (d *DB) UpsertConversation(id, username, title string) (*Conversation, error) {
	if strings.TrimSpace(id) == "" {
		return d.CreateConversation(username, title)
	}
	if strings.TrimSpace(title) == "" {
		title = "Assistant Session"
	}
	_, err := d.sql.Exec(
		`INSERT INTO kuro_conversations (id, username, title, created_at, updated_at)
		 VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		 ON CONFLICT(id) DO UPDATE SET title = excluded.title, updated_at = CURRENT_TIMESTAMP`,
		id, username, title,
	)
	if err != nil {
		return nil, fmt.Errorf("upsert conversation: %w", err)
	}
	return d.GetConversation(id)
}

func (d *DB) GetConversation(id string) (*Conversation, error) {
	c := &Conversation{}
	err := d.sql.QueryRow(
		`SELECT id, username, COALESCE(title,'') as title, created_at, updated_at, last_message_at
		 FROM kuro_conversations WHERE id = ?`, id,
	).Scan(&c.ID, &c.Username, &c.Title, &c.CreatedAt, &c.UpdatedAt, &c.LastMessageAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return c, nil
}

func (d *DB) ListConversations(username string) ([]Conversation, error) {
	rows, err := d.sql.Query(
		`SELECT id, username, COALESCE(title,'') as title, created_at, updated_at, last_message_at
		 FROM kuro_conversations 
		 WHERE username = ? 
		   AND EXISTS (SELECT 1 FROM kuro_messages WHERE conversation_id = kuro_conversations.id)
		 ORDER BY updated_at DESC`,
		username,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Conversation
	for rows.Next() {
		var c Conversation
		if err := rows.Scan(&c.ID, &c.Username, &c.Title, &c.CreatedAt, &c.UpdatedAt, &c.LastMessageAt); err != nil {
			return nil, err
		}
		list = append(list, c)
	}
	return list, rows.Err()
}

func (d *DB) DeleteConversation(id, username string) error {
	_, err := d.sql.Exec(`DELETE FROM kuro_conversations WHERE id = ? AND username = ?`, id, username)
	return err
}

func (d *DB) UpdateConversationTitle(id, title string) error {
	_, err := d.sql.Exec(
		`UPDATE kuro_conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
		title, id,
	)
	return err
}

// ─────────────────────────────────────────────
// Messages
// ─────────────────────────────────────────────

type Message struct {
	ID             string  `json:"id"`
	ConversationID string  `json:"conversation_id"`
	Role           string  `json:"role"`
	Content        string  `json:"content"`
	ToolCalls      *string `json:"tool_calls,omitempty"`
	ToolCallID     *string `json:"tool_call_id,omitempty"`
	ToolName       *string `json:"tool_name,omitempty"`
	NodeID         *string `json:"node_id,omitempty"`
	InputMode      string  `json:"input_mode"`
	ModelUsed      *string `json:"model_used,omitempty"`
	CreatedAt      string  `json:"created_at"`
}

func (d *DB) SaveMessage(m *Message) error {
	if m.ID == "" {
		m.ID = newID()
	}
	if m.InputMode == "" {
		m.InputMode = "text"
	}
	var err error
	if m.CreatedAt != "" {
		_, err = d.sql.Exec(
			`INSERT INTO kuro_messages
			 (id, conversation_id, role, content, tool_calls, tool_call_id, tool_name, node_id, input_mode, model_used, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(id) DO UPDATE SET content = excluded.content`,
			m.ID, m.ConversationID, m.Role, m.Content,
			m.ToolCalls, m.ToolCallID, m.ToolName, m.NodeID,
			m.InputMode, m.ModelUsed, m.CreatedAt,
		)
	} else {
		_, err = d.sql.Exec(
			`INSERT INTO kuro_messages
			 (id, conversation_id, role, content, tool_calls, tool_call_id, tool_name, node_id, input_mode, model_used)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(id) DO UPDATE SET content = excluded.content`,
			m.ID, m.ConversationID, m.Role, m.Content,
			m.ToolCalls, m.ToolCallID, m.ToolName, m.NodeID,
			m.InputMode, m.ModelUsed,
		)
	}
	if err != nil {
		return fmt.Errorf("save message: %w", err)
	}
	_ = d.TouchConversation(m.ConversationID)
	return nil
}

func (d *DB) GetMessages(conversationID string, limit int) ([]Message, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := d.sql.Query(
		`SELECT id, conversation_id, role, content, tool_calls, tool_call_id,
		        tool_name, node_id, input_mode, model_used, created_at
		 FROM (
		     SELECT * FROM kuro_messages
		     WHERE conversation_id = ?
		     ORDER BY created_at DESC
		     LIMIT ?
		 ) sub
		 ORDER BY created_at ASC`,
		conversationID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var msgs []Message
	for rows.Next() {
		var m Message
		if err := rows.Scan(
			&m.ID, &m.ConversationID, &m.Role, &m.Content,
			&m.ToolCalls, &m.ToolCallID, &m.ToolName, &m.NodeID,
			&m.InputMode, &m.ModelUsed, &m.CreatedAt,
		); err != nil {
			return nil, err
		}
		msgs = append(msgs, m)
	}
	return msgs, rows.Err()
}

func (d *DB) GetRecentUserMessages(username string, limit int) ([]Message, error) {
	if limit <= 0 {
		limit = 20
	}
	rows, err := d.sql.Query(
		`SELECT m.id, m.conversation_id, m.role, m.content, m.tool_calls, m.tool_call_id,
		        m.tool_name, m.node_id, m.input_mode, m.model_used, m.created_at
		 FROM kuro_messages m
		 JOIN kuro_conversations c ON c.id = m.conversation_id
		 WHERE c.username = ? AND m.role = 'user'
		 ORDER BY m.created_at DESC
		 LIMIT ?`,
		username, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var msgs []Message
	for rows.Next() {
		var m Message
		if err := rows.Scan(
			&m.ID, &m.ConversationID, &m.Role, &m.Content,
			&m.ToolCalls, &m.ToolCallID, &m.ToolName, &m.NodeID,
			&m.InputMode, &m.ModelUsed, &m.CreatedAt,
		); err != nil {
			return nil, err
		}
		msgs = append(msgs, m)
	}
	return msgs, rows.Err()
}

// ─────────────────────────────────────────────
// Memories
// ─────────────────────────────────────────────

type Memory struct {
	ID                   string  `json:"id"`
	Username             string  `json:"username"`
	Content              string  `json:"content"`
	Category             string  `json:"category"`
	Importance           int     `json:"importance"`
	SourceConversationID *string `json:"source_conversation_id,omitempty"`
	CreatedAt            string  `json:"created_at"`
	LastAccessedAt       *string `json:"last_accessed_at,omitempty"`
	AccessCount          int     `json:"access_count"`
}

func (d *DB) SaveMemory(username, content, category string, importance int, sourceConvID string) error {
	id := newID()
	var srcConv *string
	if sourceConvID != "" {
		srcConv = &sourceConvID
	}
	_, err := d.sql.Exec(
		`INSERT INTO kuro_memories (id, username, content, category, importance, source_conversation_id)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		id, username, content, category, importance, srcConv,
	)
	return err
}

func (d *DB) SearchMemories(username, query string, limit int) ([]Memory, error) {
	if limit <= 0 {
		limit = 5
	}
	rows, err := d.sql.Query(
		`SELECT m.id, m.username, m.content, m.category, m.importance,
		        m.source_conversation_id, m.created_at, m.last_accessed_at, m.access_count
		 FROM kuro_memories_fts fts
		 JOIN kuro_memories m ON m.rowid = fts.rowid
		 WHERE m.username = ? AND kuro_memories_fts MATCH ?
		 ORDER BY rank, m.importance DESC
		 LIMIT ?`,
		username, query, limit,
	)
	if err != nil {
		return d.GetRecentMemories(username, limit)
	}
	defer rows.Close()
	return scanMemories(rows)
}

func (d *DB) GetRecentMemories(username string, limit int) ([]Memory, error) {
	if limit <= 0 {
		limit = 10
	}
	rows, err := d.sql.Query(
		`SELECT id, username, content, category, importance,
		        source_conversation_id, created_at, last_accessed_at, access_count
		 FROM kuro_memories
		 WHERE username = ?
		 ORDER BY importance DESC, created_at DESC
		 LIMIT ?`,
		username, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanMemories(rows)
}

func (d *DB) ListMemories(username string) ([]Memory, error) {
	rows, err := d.sql.Query(
		`SELECT id, username, content, category, importance,
		        source_conversation_id, created_at, last_accessed_at, access_count
		 FROM kuro_memories
		 WHERE username = ?
		 ORDER BY created_at DESC`,
		username,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanMemories(rows)
}

func (d *DB) UpdateMemory(id, username, content, category string, importance int) error {
	_, err := d.sql.Exec(
		`UPDATE kuro_memories SET content = ?, category = ?, importance = ? WHERE id = ? AND username = ?`,
		content, category, importance, id, username,
	)
	return err
}

func (d *DB) SaveOrUpdateMemoryByContent(username, content, category string, importance int, sourceConvID string) error {
	var existingID string
	err := d.sql.QueryRow(
		`SELECT id FROM kuro_memories WHERE username = ? AND content = ? LIMIT 1`,
		username, content,
	).Scan(&existingID)

	if err == nil && existingID != "" {
		return d.UpdateMemory(existingID, username, content, category, importance)
	}
	return d.SaveMemory(username, content, category, importance, sourceConvID)
}

func (d *DB) DeleteMemory(id, username string) error {
	_, err := d.sql.Exec(
		`DELETE FROM kuro_memories WHERE id = ? AND username = ?`,
		id, username,
	)
	return err
}

func scanMemories(rows *sql.Rows) ([]Memory, error) {
	var list []Memory
	for rows.Next() {
		var m Memory
		if err := rows.Scan(
			&m.ID, &m.Username, &m.Content, &m.Category, &m.Importance,
			&m.SourceConversationID, &m.CreatedAt, &m.LastAccessedAt, &m.AccessCount,
		); err != nil {
			return nil, err
		}
		list = append(list, m)
	}
	return list, rows.Err()
}

// ─────────────────────────────────────────────
// Nodes
// ─────────────────────────────────────────────

type Node struct {
	ID           string  `json:"id"`
	Username     string  `json:"username"`
	Platform     string  `json:"platform"`
	Hostname     string  `json:"hostname"`
	DisplayName  string  `json:"display_name"`
	Capabilities string  `json:"capabilities"` // JSON array
	IsOnline     bool    `json:"is_online"`
	LastSeenAt   *string `json:"last_seen_at,omitempty"`
	Metadata     string  `json:"metadata"`
	CreatedAt    string  `json:"created_at"`
}

func (d *DB) UpsertNode(n *Node) error {
	_, err := d.sql.Exec(
		`INSERT INTO kuro_nodes (id, username, platform, hostname, display_name, capabilities, metadata, is_online, last_seen_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		 ON CONFLICT(id) DO UPDATE SET
		   username = excluded.username,
		   platform = excluded.platform,
		   hostname = excluded.hostname,
		   display_name = excluded.display_name,
		   capabilities = excluded.capabilities,
		   metadata = excluded.metadata,
		   is_online = 1,
		   last_seen_at = CURRENT_TIMESTAMP,
		   updated_at = CURRENT_TIMESTAMP`,
		n.ID, n.Username, n.Platform, n.Hostname, n.DisplayName, n.Capabilities, n.Metadata,
	)
	return err
}

func (d *DB) SetNodeOnline(nodeID string, online bool) error {
	onlineInt := 0
	if online {
		onlineInt = 1
	}
	_, err := d.sql.Exec(
		`UPDATE kuro_nodes
		 SET is_online = ?, last_seen_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
		 WHERE id = ?`,
		onlineInt, nodeID,
	)
	return err
}

func (d *DB) ListNodes(username string) ([]Node, error) {
	var rows *sql.Rows
	var err error
	if username != "" {
		rows, err = d.sql.Query(
			`SELECT id, username, platform, COALESCE(hostname,'') as hostname,
			        COALESCE(display_name,'') as display_name, capabilities,
			        is_online, last_seen_at, COALESCE(metadata,'{}') as metadata, created_at
			 FROM kuro_nodes WHERE username = ? ORDER BY is_online DESC, last_seen_at DESC`,
			username,
		)
	} else {
		rows, err = d.sql.Query(
			`SELECT id, username, platform, COALESCE(hostname,'') as hostname,
			        COALESCE(display_name,'') as display_name, capabilities,
			        is_online, last_seen_at, COALESCE(metadata,'{}') as metadata, created_at
			 FROM kuro_nodes ORDER BY is_online DESC, last_seen_at DESC`,
		)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var nodes []Node
	for rows.Next() {
		var n Node
		var isOnline int
		if err := rows.Scan(
			&n.ID, &n.Username, &n.Platform, &n.Hostname, &n.DisplayName,
			&n.Capabilities, &isOnline, &n.LastSeenAt, &n.Metadata, &n.CreatedAt,
		); err != nil {
			return nil, err
		}
		n.IsOnline = isOnline == 1
		nodes = append(nodes, n)
	}
	return nodes, rows.Err()
}

func (d *DB) GetNode(nodeID string) (*Node, error) {
	var n Node
	var isOnline int
	err := d.sql.QueryRow(
		`SELECT id, username, platform, COALESCE(hostname,'') as hostname,
		        COALESCE(display_name,'') as display_name, capabilities,
		        is_online, last_seen_at, COALESCE(metadata,'{}') as metadata, created_at
		 FROM kuro_nodes WHERE id = ?`,
		nodeID,
	).Scan(
		&n.ID, &n.Username, &n.Platform, &n.Hostname, &n.DisplayName,
		&n.Capabilities, &isOnline, &n.LastSeenAt, &n.Metadata, &n.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	n.IsOnline = isOnline == 1
	return &n, nil
}

func (d *DB) DeleteNode(nodeID string, deleteData bool, mergeTargetNodeID string) error {
	if mergeTargetNodeID != "" && mergeTargetNodeID != nodeID {
		_, _ = d.sql.Exec(`UPDATE kuro_device_calls SET node_id = ? WHERE node_id = ?`, mergeTargetNodeID, nodeID)
		_, _ = d.sql.Exec(`UPDATE kuro_device_messages SET node_id = ? WHERE node_id = ?`, mergeTargetNodeID, nodeID)
		_, _ = d.sql.Exec(`UPDATE kuro_device_locations SET node_id = ? WHERE node_id = ?`, mergeTargetNodeID, nodeID)
		_, _ = d.sql.Exec(`UPDATE kuro_device_contacts SET node_id = ? WHERE node_id = ?`, mergeTargetNodeID, nodeID)
	} else if deleteData {
		_, _ = d.sql.Exec(`DELETE FROM kuro_device_calls WHERE node_id = ?`, nodeID)
		_, _ = d.sql.Exec(`DELETE FROM kuro_device_messages WHERE node_id = ?`, nodeID)
		_, _ = d.sql.Exec(`DELETE FROM kuro_device_locations WHERE node_id = ?`, nodeID)
		_, _ = d.sql.Exec(`DELETE FROM kuro_device_contacts WHERE node_id = ?`, nodeID)
		_, _ = d.sql.Exec(`DELETE FROM kuro_node_snapshots WHERE node_id = ?`, nodeID)
	}
	_, err := d.sql.Exec(`DELETE FROM kuro_nodes WHERE id = ?`, nodeID)
	return err
}

func (d *DB) UpdateNodeConfig(nodeID string, displayName string, newID string) error {
	if newID != "" && newID != nodeID {
		_, err := d.sql.Exec(`UPDATE kuro_nodes SET id = ?, display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, newID, displayName, nodeID)
		if err != nil {
			return err
		}
		_, _ = d.sql.Exec(`UPDATE kuro_device_calls SET node_id = ? WHERE node_id = ?`, newID, nodeID)
		_, _ = d.sql.Exec(`UPDATE kuro_device_messages SET node_id = ? WHERE node_id = ?`, newID, nodeID)
		_, _ = d.sql.Exec(`UPDATE kuro_device_locations SET node_id = ? WHERE node_id = ?`, newID, nodeID)
		_, _ = d.sql.Exec(`UPDATE kuro_device_contacts SET node_id = ? WHERE node_id = ?`, newID, nodeID)
		_, _ = d.sql.Exec(`UPDATE kuro_node_snapshots SET node_id = ? WHERE node_id = ?`, newID, nodeID)
		return nil
	}
	_, err := d.sql.Exec(`UPDATE kuro_nodes SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, displayName, nodeID)
	return err
}

// ─────────────────────────────────────────────
// Device Contacts
// ─────────────────────────────────────────────

type DeviceContact struct {
	ID            string   `json:"id"`
	Username      string   `json:"username,omitempty"`
	NodeID        string   `json:"node_id"`
	DeviceName    string   `json:"device_name,omitempty"`
	Name          string   `json:"name"`
	PhoneNumbers  []string `json:"phone_numbers"`
	Email         string   `json:"email,omitempty"`
	IsStarred     bool     `json:"is_starred"`
	LastContacted string   `json:"last_contacted,omitempty"`
	CreatedAt     string   `json:"created_at"`
	UpdatedAt     string   `json:"updated_at"`
}

func (d *DB) SaveDeviceContacts(username, nodeID, deviceName string, contacts []DeviceContact) error {
	for _, c := range contacts {
		id := c.ID
		if id == "" {
			id = newID()
		}
		numsJSON, _ := json.Marshal(c.PhoneNumbers)
		starred := 0
		if c.IsStarred {
			starred = 1
		}
		_, _ = d.sql.Exec(
			`INSERT INTO kuro_device_contacts (id, username, node_id, device_name, name, phone_numbers, email, is_starred, last_contacted, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
			 ON CONFLICT(node_id, name, phone_numbers) DO UPDATE SET
			   username = excluded.username,
			   device_name = excluded.device_name,
			   email = excluded.email,
			   is_starred = excluded.is_starred,
			   last_contacted = excluded.last_contacted,
			   updated_at = CURRENT_TIMESTAMP`,
			id, username, nodeID, deviceName, c.Name, string(numsJSON), c.Email, starred, c.LastContacted,
		)
	}
	return nil
}

func (d *DB) GetDeviceContacts(username, nodeID string) ([]DeviceContact, error) {
	var query string
	var args []any
	if username != "" && nodeID != "" {
		query = `SELECT id, username, node_id, COALESCE(device_name,''), name, phone_numbers, COALESCE(email,''), is_starred, COALESCE(last_contacted,''), created_at, updated_at
		         FROM kuro_device_contacts WHERE username = ? AND node_id = ? ORDER BY name ASC`
		args = append(args, username, nodeID)
	} else if username != "" {
		query = `SELECT id, username, node_id, COALESCE(device_name,''), name, phone_numbers, COALESCE(email,''), is_starred, COALESCE(last_contacted,''), created_at, updated_at
		         FROM kuro_device_contacts WHERE username = ? ORDER BY name ASC`
		args = append(args, username)
	} else if nodeID != "" {
		query = `SELECT id, username, node_id, COALESCE(device_name,''), name, phone_numbers, COALESCE(email,''), is_starred, COALESCE(last_contacted,''), created_at, updated_at
		         FROM kuro_device_contacts WHERE node_id = ? ORDER BY name ASC`
		args = append(args, nodeID)
	} else {
		query = `SELECT id, username, node_id, COALESCE(device_name,''), name, phone_numbers, COALESCE(email,''), is_starred, COALESCE(last_contacted,''), created_at, updated_at
		         FROM kuro_device_contacts ORDER BY name ASC`
	}

	rows, err := d.sql.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []DeviceContact
	for rows.Next() {
		var c DeviceContact
		var numsJSON string
		var starred int
		if err := rows.Scan(&c.ID, &c.Username, &c.NodeID, &c.DeviceName, &c.Name, &numsJSON, &c.Email, &starred, &c.LastContacted, &c.CreatedAt, &c.UpdatedAt); err == nil {
			_ = json.Unmarshal([]byte(numsJSON), &c.PhoneNumbers)
			c.IsStarred = starred == 1
			list = append(list, c)
		}
	}
	return list, nil
}

func (d *DB) SaveNodeSnapshot(nodeID, snapshotJSON string) error {
	id := newID()
	_, err := d.sql.Exec(
		`INSERT INTO kuro_node_snapshots (id, node_id, snapshot) VALUES (?, ?, ?)`,
		id, nodeID, snapshotJSON,
	)
	return err
}

func (d *DB) GetLatestNodeSnapshot(nodeID string) (string, error) {
	var snap string
	err := d.sql.QueryRow(
		`SELECT snapshot FROM kuro_node_snapshots WHERE node_id = ? ORDER BY created_at DESC LIMIT 1`,
		nodeID,
	).Scan(&snap)
	if err == sql.ErrNoRows {
		return "{}", nil
	}
	return snap, err
}

func (d *DB) SaveEvent(nodeID, eventType, dataJSON string) error {
	id := newID()
	_, err := d.sql.Exec(
		`INSERT INTO kuro_events (id, node_id, type, data) VALUES (?, ?, ?, ?)`,
		id, nodeID, eventType, dataJSON,
	)
	return err
}

// ─────────────────────────────────────────────
// Calls
// ─────────────────────────────────────────────

type DeviceCall struct {
	ID          string `json:"id"`
	Username    string `json:"username,omitempty"`
	NodeID      string `json:"node_id"`
	CallerName  string `json:"caller_name"`
	PhoneNumber string `json:"phone_number"`
	CallType    string `json:"call_type"`
	Duration    int    `json:"duration"`
	Timestamp   string `json:"timestamp"`
}

func (d *DB) SaveDeviceCall(username, nodeID, callerName, phone, callType string, duration int, timestamp string) error {
	id := newID()
	_, err := d.sql.Exec(
		`INSERT OR IGNORE INTO kuro_device_calls (id, username, node_id, caller_name, phone_number, call_type, duration, timestamp)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		id, username, nodeID, callerName, phone, callType, duration, timestamp,
	)
	return err
}

func (d *DB) GetDeviceCalls(username, nodeID string, limit int) ([]DeviceCall, error) {
	calls, _, err := d.GetDeviceCallsPaginated(username, nodeID, limit, 0)
	return calls, err
}

func (d *DB) GetDeviceCallsPaginated(username, nodeID string, limit, offset int) ([]DeviceCall, int, error) {
	if limit <= 0 {
		limit = 10
	}
	if offset < 0 {
		offset = 0
	}

	var countQuery string
	var countArgs []any
	var query string
	var args []any

	if username != "" && nodeID != "" {
		countQuery = `SELECT count(*) FROM kuro_device_calls WHERE username = ? AND node_id = ?`
		countArgs = append(countArgs, username, nodeID)
		query = `SELECT id, username, node_id, coalesce(caller_name, ''), phone_number, call_type, duration, timestamp
		         FROM kuro_device_calls WHERE username = ? AND node_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?`
		args = append(args, username, nodeID, limit, offset)
	} else if username != "" {
		countQuery = `SELECT count(*) FROM kuro_device_calls WHERE username = ?`
		countArgs = append(countArgs, username)
		query = `SELECT id, username, node_id, coalesce(caller_name, ''), phone_number, call_type, duration, timestamp
		         FROM kuro_device_calls WHERE username = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?`
		args = append(args, username, limit, offset)
	} else if nodeID != "" {
		countQuery = `SELECT count(*) FROM kuro_device_calls WHERE node_id = ?`
		countArgs = append(countArgs, nodeID)
		query = `SELECT id, username, node_id, coalesce(caller_name, ''), phone_number, call_type, duration, timestamp
		         FROM kuro_device_calls WHERE node_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?`
		args = append(args, nodeID, limit, offset)
	} else {
		countQuery = `SELECT count(*) FROM kuro_device_calls`
		query = `SELECT id, username, node_id, coalesce(caller_name, ''), phone_number, call_type, duration, timestamp
		         FROM kuro_device_calls ORDER BY timestamp DESC LIMIT ? OFFSET ?`
		args = append(args, limit, offset)
	}

	var total int
	_ = d.sql.QueryRow(countQuery, countArgs...).Scan(&total)

	rows, err := d.sql.Query(query, args...)
	if err != nil {
		return nil, total, err
	}
	defer rows.Close()

	var calls []DeviceCall
	for rows.Next() {
		var c DeviceCall
		if err := rows.Scan(&c.ID, &c.Username, &c.NodeID, &c.CallerName, &c.PhoneNumber, &c.CallType, &c.Duration, &c.Timestamp); err == nil {
			calls = append(calls, c)
		}
	}
	return calls, total, nil
}

type DeviceMessage struct {
	ID          string `json:"id"`
	Username    string `json:"username,omitempty"`
	NodeID      string `json:"node_id"`
	SenderName  string `json:"sender_name"`
	PhoneNumber string `json:"phone_number"`
	MessageBody string `json:"message_body"`
	IsRead      bool   `json:"is_read"`
	Timestamp   string `json:"timestamp"`
}

func (d *DB) SaveDeviceMessage(username, nodeID, senderName, phone, body string, isRead bool, timestamp string) error {
	id := newID()
	readInt := 1
	if !isRead {
		readInt = 0
	}
	_, err := d.sql.Exec(
		`INSERT OR IGNORE INTO kuro_device_messages (id, username, node_id, sender_name, phone_number, message_body, is_read, timestamp)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		id, username, nodeID, senderName, phone, body, readInt, timestamp,
	)
	return err
}

func (d *DB) GetDeviceMessages(username, nodeID string, limit int) ([]DeviceMessage, error) {
	msgs, _, err := d.GetDeviceMessagesPaginated(username, nodeID, limit, 0)
	return msgs, err
}

func (d *DB) GetDeviceMessagesPaginated(username, nodeID string, limit, offset int) ([]DeviceMessage, int, error) {
	if limit <= 0 {
		limit = 10
	}
	if offset < 0 {
		offset = 0
	}

	var countQuery string
	var countArgs []any
	var query string
	var args []any

	if username != "" && nodeID != "" {
		countQuery = `SELECT count(*) FROM kuro_device_messages WHERE username = ? AND node_id = ?`
		countArgs = append(countArgs, username, nodeID)
		query = `SELECT id, username, node_id, coalesce(sender_name, ''), phone_number, message_body, is_read, timestamp
		         FROM kuro_device_messages WHERE username = ? AND node_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?`
		args = append(args, username, nodeID, limit, offset)
	} else if username != "" {
		countQuery = `SELECT count(*) FROM kuro_device_messages WHERE username = ?`
		countArgs = append(countArgs, username)
		query = `SELECT id, username, node_id, coalesce(sender_name, ''), phone_number, message_body, is_read, timestamp
		         FROM kuro_device_messages WHERE username = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?`
		args = append(args, username, limit, offset)
	} else if nodeID != "" {
		countQuery = `SELECT count(*) FROM kuro_device_messages WHERE node_id = ?`
		countArgs = append(countArgs, nodeID)
		query = `SELECT id, username, node_id, coalesce(sender_name, ''), phone_number, message_body, is_read, timestamp
		         FROM kuro_device_messages WHERE node_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?`
		args = append(args, nodeID, limit, offset)
	} else {
		countQuery = `SELECT count(*) FROM kuro_device_messages`
		query = `SELECT id, username, node_id, coalesce(sender_name, ''), phone_number, message_body, is_read, timestamp
		         FROM kuro_device_messages ORDER BY timestamp DESC LIMIT ? OFFSET ?`
		args = append(args, limit, offset)
	}

	var total int
	_ = d.sql.QueryRow(countQuery, countArgs...).Scan(&total)

	rows, err := d.sql.Query(query, args...)
	if err != nil {
		return nil, total, err
	}
	defer rows.Close()

	var msgs []DeviceMessage
	for rows.Next() {
		var m DeviceMessage
		var readInt int
		if err := rows.Scan(&m.ID, &m.Username, &m.NodeID, &m.SenderName, &m.PhoneNumber, &m.MessageBody, &readInt, &m.Timestamp); err == nil {
			m.IsRead = readInt == 1
			msgs = append(msgs, m)
		}
	}
	return msgs, total, nil
}

type DeviceLocation struct {
	ID        string  `json:"id"`
	Username  string  `json:"username,omitempty"`
	NodeID    string  `json:"node_id"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Accuracy  float64 `json:"accuracy"`
	Address   string  `json:"address"`
	WifiSSID  string  `json:"wifi_ssid"`
	Timestamp string  `json:"timestamp"`
}

func (d *DB) SaveDeviceLocation(username, nodeID string, lat, lon, acc float64, addr, wifiSSID, timestamp string) error {
	id := newID()
	_, err := d.sql.Exec(
		`INSERT INTO kuro_device_locations (id, username, node_id, latitude, longitude, accuracy, address, wifi_ssid, timestamp)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, username, nodeID, lat, lon, acc, addr, wifiSSID, timestamp,
	)
	return err
}

func (d *DB) GetLatestDeviceLocation(username, nodeID string) (*DeviceLocation, error) {
	var l DeviceLocation
	var query string
	var args []any
	if username != "" && nodeID != "" {
		query = `SELECT id, username, node_id, latitude, longitude, accuracy, coalesce(address, ''), coalesce(wifi_ssid, ''), timestamp
		         FROM kuro_device_locations WHERE username = ? AND node_id = ? ORDER BY timestamp DESC LIMIT 1`
		args = append(args, username, nodeID)
	} else if username != "" {
		query = `SELECT id, username, node_id, latitude, longitude, accuracy, coalesce(address, ''), coalesce(wifi_ssid, ''), timestamp
		         FROM kuro_device_locations WHERE username = ? ORDER BY timestamp DESC LIMIT 1`
		args = append(args, username)
	} else if nodeID != "" {
		query = `SELECT id, username, node_id, latitude, longitude, accuracy, coalesce(address, ''), coalesce(wifi_ssid, ''), timestamp
		         FROM kuro_device_locations WHERE node_id = ? ORDER BY timestamp DESC LIMIT 1`
		args = append(args, nodeID)
	} else {
		query = `SELECT id, username, node_id, latitude, longitude, accuracy, coalesce(address, ''), coalesce(wifi_ssid, ''), timestamp
		         FROM kuro_device_locations ORDER BY timestamp DESC LIMIT 1`
	}

	err := d.sql.QueryRow(query, args...).Scan(&l.ID, &l.Username, &l.NodeID, &l.Latitude, &l.Longitude, &l.Accuracy, &l.Address, &l.WifiSSID, &l.Timestamp)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &l, nil
}

func (d *DB) GetDeviceLocations(username, nodeID string, limit int) ([]DeviceLocation, error) {
	if limit <= 0 {
		limit = 20
	}
	query := `SELECT id, username, node_id, latitude, longitude, accuracy, coalesce(address, ''), coalesce(wifi_ssid, ''), timestamp
	          FROM kuro_device_locations WHERE 1=1`
	var args []any
	if username != "" {
		query += ` AND username = ?`
		args = append(args, username)
	}
	if nodeID != "" {
		query += ` AND node_id = ?`
		args = append(args, nodeID)
	}
	query += ` ORDER BY timestamp DESC LIMIT ?`
	args = append(args, limit)

	rows, err := d.sql.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []DeviceLocation
	for rows.Next() {
		var l DeviceLocation
		if err := rows.Scan(&l.ID, &l.Username, &l.NodeID, &l.Latitude, &l.Longitude, &l.Accuracy, &l.Address, &l.WifiSSID, &l.Timestamp); err == nil {
			list = append(list, l)
		}
	}
	return list, nil
}

func (d *DB) TouchConversation(id string) error {
	_, err := d.sql.Exec(`UPDATE kuro_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, id)
	return err
}

// SaveIntegration stores or updates a third-party server integration configuration JSON
func (d *DB) SaveIntegration(serviceName string, configJSON string, enabled bool) error {
	en := 0
	if enabled {
		en = 1
	}
	_, err := d.sql.Exec(
		`INSERT INTO kuro_integrations (service_name, enabled, config_json, updated_at)
		 VALUES (?, ?, ?, CURRENT_TIMESTAMP)
		 ON CONFLICT(service_name) DO UPDATE SET
		   enabled = excluded.enabled,
		   config_json = excluded.config_json,
		   updated_at = CURRENT_TIMESTAMP`,
		serviceName, en, configJSON,
	)
	return err
}

// GetIntegration retrieves a third-party server integration configuration JSON
func (d *DB) GetIntegration(serviceName string) (configJSON string, enabled bool, err error) {
	var en int
	err = d.sql.QueryRow(
		`SELECT config_json, enabled FROM kuro_integrations WHERE service_name = ?`,
		serviceName,
	).Scan(&configJSON, &en)
	if err == sql.ErrNoRows {
		return "{}", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return configJSON, en == 1, nil
}


func newID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic("crypto/rand unavailable: " + err.Error())
	}
	return hex.EncodeToString(b)
}

// UserSession represents an active or historical authenticated user session.
type UserSession struct {
	ID           string     `json:"id"`
	UserID       string     `json:"user_id"`
	Username     string     `json:"username"`
	TokenVersion int        `json:"token_version"`
	ClientType   string     `json:"client_type"`
	DeviceName   string     `json:"device_name"`
	OS           string     `json:"os"`
	Browser      string     `json:"browser"`
	IPAddress    string     `json:"ip_address"`
	UserAgent    string     `json:"user_agent"`
	IsActive     bool       `json:"is_active"`
	LastActiveAt time.Time  `json:"last_active_at"`
	CreatedAt    time.Time  `json:"created_at"`
	ExpiresAt    time.Time  `json:"expires_at"`
	RevokedAt    *time.Time `json:"revoked_at,omitempty"`
	IsCurrent    bool       `json:"is_current,omitempty"`
}

var (
	lastTouchMu  sync.Mutex
	lastTouchMap = make(map[string]time.Time)
)

// SaveUserSession persists a new or updated user session.
func (d *DB) SaveUserSession(sess *UserSession) error {
	if sess.ID == "" {
		sess.ID = newID()
	}
	if sess.CreatedAt.IsZero() {
		sess.CreatedAt = time.Now()
	}
	if sess.LastActiveAt.IsZero() {
		sess.LastActiveAt = time.Now()
	}
	activeInt := 0
	if sess.IsActive {
		activeInt = 1
	}

	_, err := d.sql.Exec(`
		INSERT INTO kuro_user_sessions (
			id, user_id, username, token_version, client_type, device_name, os, browser,
			ip_address, user_agent, is_active, last_active_at, created_at, expires_at, revoked_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			is_active = excluded.is_active,
			last_active_at = excluded.last_active_at,
			expires_at = excluded.expires_at,
			revoked_at = excluded.revoked_at
	`, sess.ID, sess.UserID, sess.Username, sess.TokenVersion, sess.ClientType, sess.DeviceName, sess.OS, sess.Browser,
		sess.IPAddress, sess.UserAgent, activeInt, sess.LastActiveAt, sess.CreatedAt, sess.ExpiresAt, sess.RevokedAt)
	return err
}

// TouchUserSession updates the last_active_at timestamp in a throttled fashion (max once every 30s).
func (d *DB) TouchUserSession(sessionID string) error {
	if sessionID == "" {
		return nil
	}
	now := time.Now()
	lastTouchMu.Lock()
	last, ok := lastTouchMap[sessionID]
	if ok && now.Sub(last) < 30*time.Second {
		lastTouchMu.Unlock()
		return nil
	}
	lastTouchMap[sessionID] = now
	// Clean up old entries if map grows large
	if len(lastTouchMap) > 5000 {
		for k, t := range lastTouchMap {
			if now.Sub(t) > 10*time.Minute {
				delete(lastTouchMap, k)
			}
		}
	}
	lastTouchMu.Unlock()

	_, err := d.sql.Exec(`UPDATE kuro_user_sessions SET last_active_at = CURRENT_TIMESTAMP WHERE id = ? AND is_active = 1`, sessionID)
	return err
}

// GetUserSessions retrieves all active and historical sessions for a user.
func (d *DB) GetUserSessions(username string, currentSessionID string) ([]UserSession, int, int, error) {
	query := `
		SELECT id, user_id, username, token_version, client_type, device_name, os, browser,
		       ip_address, user_agent, is_active, last_active_at, created_at, expires_at, revoked_at
		FROM kuro_user_sessions
		WHERE username = ?
		ORDER BY is_active DESC, last_active_at DESC
	`
	rows, err := d.sql.Query(query, username)
	if err != nil {
		return nil, 0, 0, err
	}
	defer rows.Close()

	var sessions []UserSession
	totalCount := 0
	activeCount := 0

	for rows.Next() {
		var s UserSession
		var activeInt int
		var revokedAt sql.NullTime

		if err := rows.Scan(
			&s.ID, &s.UserID, &s.Username, &s.TokenVersion, &s.ClientType, &s.DeviceName, &s.OS, &s.Browser,
			&s.IPAddress, &s.UserAgent, &activeInt, &s.LastActiveAt, &s.CreatedAt, &s.ExpiresAt, &revokedAt,
		); err != nil {
			return nil, 0, 0, err
		}

		s.IsActive = (activeInt == 1) && (!revokedAt.Valid)
		if revokedAt.Valid {
			s.RevokedAt = &revokedAt.Time
		}
		if s.ID == currentSessionID {
			s.IsCurrent = true
		}

		totalCount++
		if s.IsActive {
			activeCount++
		}
		sessions = append(sessions, s)
	}

	return sessions, totalCount, activeCount, nil
}

// RevokeUserSession marks an individual session as revoked and inactive.
func (d *DB) RevokeUserSession(sessionID string, username string) error {
	now := time.Now()
	var err error
	if username != "" {
		_, err = d.sql.Exec(`UPDATE kuro_user_sessions SET is_active = 0, revoked_at = ? WHERE id = ? AND username = ?`, now, sessionID, username)
	} else {
		_, err = d.sql.Exec(`UPDATE kuro_user_sessions SET is_active = 0, revoked_at = ? WHERE id = ?`, now, sessionID)
	}
	return err
}

// RevokeAllUserSessions marks all active sessions for a user as revoked and inactive.
func (d *DB) RevokeAllUserSessions(username string) error {
	now := time.Now()
	_, err := d.sql.Exec(`UPDATE kuro_user_sessions SET is_active = 0, revoked_at = ? WHERE username = ? AND is_active = 1`, now, username)
	return err
}

// IsSessionRevoked checks whether a given session ID has been revoked or expired.
func (d *DB) IsSessionRevoked(sessionID string) bool {
	if sessionID == "" {
		return false
	}
	var isActive int
	var revokedAt sql.NullTime
	var expiresAt time.Time
	err := d.sql.QueryRow(`SELECT is_active, revoked_at, expires_at FROM kuro_user_sessions WHERE id = ?`, sessionID).Scan(&isActive, &revokedAt, &expiresAt)
	if err != nil {
		return false
	}
	if isActive == 0 || revokedAt.Valid || expiresAt.Before(time.Now()) {
		return true
	}
	return false
}


