-- =========================================================
-- Kuro Assistant — SQLite Schema (Integrated into Poco Server)
-- =========================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;

-- =========================================================
-- Conversations (threads for chat history)
-- =========================================================
CREATE TABLE IF NOT EXISTS kuro_conversations (
    id              TEXT PRIMARY KEY,
    username        TEXT NOT NULL,
    title           TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_message_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_kuro_conversations_user
    ON kuro_conversations(username, updated_at DESC);

-- =========================================================
-- Messages (persists chat history across any model switch)
-- =========================================================
CREATE TABLE IF NOT EXISTS kuro_messages (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES kuro_conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK(role IN ('user','assistant','tool','system')),
    content         TEXT NOT NULL,
    tool_calls      TEXT,       -- JSON: tool calls requested by LLM
    tool_call_id    TEXT,       -- for tool result messages
    tool_name       TEXT,       -- for tool result messages
    node_id         TEXT,       -- which device sent this (for user messages)
    input_mode      TEXT NOT NULL DEFAULT 'text', -- 'text' | 'voice'
    model_used      TEXT,       -- LLM model that generated this
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kuro_messages_conv
    ON kuro_messages(conversation_id, created_at ASC);

-- =========================================================
-- Long-Term Memories (FTS5 search, model-independent)
-- =========================================================
CREATE TABLE IF NOT EXISTS kuro_memories (
    id                     TEXT PRIMARY KEY,
    username               TEXT NOT NULL,
    content                TEXT NOT NULL,
    category               TEXT NOT NULL DEFAULT 'general',
    importance             INTEGER NOT NULL DEFAULT 5 CHECK(importance BETWEEN 1 AND 10),
    source_conversation_id TEXT,
    created_at             DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at       DATETIME,
    access_count           INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_kuro_memories_user
    ON kuro_memories(username, importance DESC, created_at DESC);

-- Full-text search index on memories
CREATE VIRTUAL TABLE IF NOT EXISTS kuro_memories_fts USING fts5(
    content,
    category,
    content='kuro_memories',
    content_rowid='rowid'
);

-- Triggers for FTS sync
CREATE TRIGGER IF NOT EXISTS kuro_memories_ai AFTER INSERT ON kuro_memories BEGIN
    INSERT INTO kuro_memories_fts(rowid, content, category) VALUES (new.rowid, new.content, new.category);
END;

CREATE TRIGGER IF NOT EXISTS kuro_memories_ad AFTER DELETE ON kuro_memories BEGIN
    INSERT INTO kuro_memories_fts(kuro_memories_fts, rowid, content, category)
        VALUES('delete', old.rowid, old.content, old.category);
END;

CREATE TRIGGER IF NOT EXISTS kuro_memories_au AFTER UPDATE ON kuro_memories BEGIN
    INSERT INTO kuro_memories_fts(kuro_memories_fts, rowid, content, category)
        VALUES('delete', old.rowid, old.content, old.category);
    INSERT INTO kuro_memories_fts(rowid, content, category) VALUES (new.rowid, new.content, new.category);
END;

-- =========================================================
-- Registered Client Nodes (Windows, Android, Linux, etc.)
-- =========================================================
CREATE TABLE IF NOT EXISTS kuro_nodes (
    id           TEXT PRIMARY KEY,  -- e.g. "ullas-desktop-win"
    username     TEXT NOT NULL,
    platform     TEXT NOT NULL,     -- 'windows'|'android'|'linux'|'macos'|'ios'
    hostname     TEXT,
    display_name TEXT,
    capabilities TEXT NOT NULL DEFAULT '[]', -- JSON array
    is_online    INTEGER NOT NULL DEFAULT 0,
    last_seen_at DATETIME,
    metadata     TEXT NOT NULL DEFAULT '{}', -- JSON: OS version, hardware spec
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kuro_nodes_user
    ON kuro_nodes(username, is_online DESC, last_seen_at DESC);

-- =========================================================
-- Node Snapshots (telemetry stream)
-- =========================================================
CREATE TABLE IF NOT EXISTS kuro_node_snapshots (
    id         TEXT PRIMARY KEY,
    node_id    TEXT NOT NULL,
    snapshot   TEXT NOT NULL, -- JSON metrics
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kuro_snapshots_node
    ON kuro_node_snapshots(node_id, created_at DESC);

-- =========================================================
-- Events
-- =========================================================
CREATE TABLE IF NOT EXISTS kuro_events (
    id         TEXT PRIMARY KEY,
    node_id    TEXT NOT NULL,
    type       TEXT NOT NULL,
    data       TEXT NOT NULL DEFAULT '{}',
    processed  INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- Device Calls (Calls & Missed Calls)
-- =========================================================
CREATE TABLE IF NOT EXISTS kuro_device_calls (
    id           TEXT PRIMARY KEY,
    username     TEXT NOT NULL DEFAULT '',
    node_id      TEXT NOT NULL,
    caller_name  TEXT,
    phone_number TEXT NOT NULL,
    call_type    TEXT NOT NULL DEFAULT 'incoming', -- 'incoming' | 'missed' | 'outgoing'
    duration     INTEGER NOT NULL DEFAULT 0,
    timestamp    DATETIME NOT NULL,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(node_id, phone_number, call_type, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_kuro_device_calls_user_node
    ON kuro_device_calls(username, node_id, timestamp DESC);

-- =========================================================
-- Device Messages (SMS & Text Messages)
-- =========================================================
CREATE TABLE IF NOT EXISTS kuro_device_messages (
    id           TEXT PRIMARY KEY,
    username     TEXT NOT NULL DEFAULT '',
    node_id      TEXT NOT NULL,
    sender_name  TEXT,
    phone_number TEXT NOT NULL,
    message_body TEXT NOT NULL,
    is_read      INTEGER NOT NULL DEFAULT 1,
    timestamp    DATETIME NOT NULL,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(node_id, phone_number, timestamp, message_body)
);

CREATE INDEX IF NOT EXISTS idx_kuro_device_messages_user_node
    ON kuro_device_messages(username, node_id, timestamp DESC);

-- =========================================================
-- Deduplicate existing data (idempotent migration)
-- Remove duplicate calls keeping the oldest row per unique key
-- =========================================================
DELETE FROM kuro_device_calls
WHERE rowid NOT IN (
    SELECT MIN(rowid)
    FROM kuro_device_calls
    GROUP BY node_id, phone_number, call_type, timestamp
);

-- Remove duplicate messages keeping the oldest row per unique key
DELETE FROM kuro_device_messages
WHERE rowid NOT IN (
    SELECT MIN(rowid)
    FROM kuro_device_messages
    GROUP BY node_id, phone_number, timestamp, message_body
);

-- =========================================================
-- Device Locations (GPS & Wi-Fi Geolocation)
-- =========================================================
CREATE TABLE IF NOT EXISTS kuro_device_locations (
    id         TEXT PRIMARY KEY,
    username   TEXT NOT NULL DEFAULT '',
    node_id    TEXT NOT NULL,
    latitude   REAL NOT NULL,
    longitude  REAL NOT NULL,
    accuracy   REAL NOT NULL DEFAULT 0.0,
    address    TEXT,
    wifi_ssid  TEXT,
    timestamp  DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kuro_device_locations_user_node
    ON kuro_device_locations(username, node_id, timestamp DESC);

-- =========================================================
-- Device Contacts (Address Book)
-- =========================================================
CREATE TABLE IF NOT EXISTS kuro_device_contacts (
    id             TEXT PRIMARY KEY,
    username       TEXT NOT NULL DEFAULT '',
    node_id        TEXT NOT NULL,
    device_name    TEXT,
    name           TEXT NOT NULL,
    phone_numbers  TEXT NOT NULL DEFAULT '[]', -- JSON array of phone numbers
    email          TEXT,
    is_starred     INTEGER NOT NULL DEFAULT 0,
    last_contacted TEXT,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(node_id, name, phone_numbers)
);

CREATE INDEX IF NOT EXISTS idx_kuro_device_contacts_user_node
    ON kuro_device_contacts(username, node_id, name ASC);

-- =========================================================
-- Server Integrations (Baïkal, Immich, Paperless, etc.)
-- =========================================================
CREATE TABLE IF NOT EXISTS kuro_integrations (
    service_name TEXT PRIMARY KEY,
    enabled      INTEGER NOT NULL DEFAULT 1,
    config_json  TEXT NOT NULL DEFAULT '{}',
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);



-- =========================================================
-- User Sessions & Historical Login Intelligence
-- =========================================================
CREATE TABLE IF NOT EXISTS kuro_user_sessions (
    id             TEXT PRIMARY KEY,
    user_id        TEXT NOT NULL DEFAULT '',
    username       TEXT NOT NULL,
    token_version  INTEGER NOT NULL DEFAULT 0,
    client_type    TEXT NOT NULL DEFAULT 'web_dashboard',
    device_name    TEXT NOT NULL DEFAULT '',
    os             TEXT NOT NULL DEFAULT '',
    browser        TEXT NOT NULL DEFAULT '',
    ip_address     TEXT NOT NULL DEFAULT '',
    user_agent     TEXT NOT NULL DEFAULT '',
    is_active      INTEGER NOT NULL DEFAULT 1,
    last_active_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at     DATETIME NOT NULL,
    revoked_at     DATETIME
);

CREATE INDEX IF NOT EXISTS idx_kuro_user_sessions_user
    ON kuro_user_sessions(username, is_active, last_active_at DESC);


