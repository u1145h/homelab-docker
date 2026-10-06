package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/ullashroy/poco-server/backend/internal/camera"
	"github.com/ullashroy/poco-server/backend/internal/docker"
	"github.com/ullashroy/poco-server/backend/internal/kuro/db"
	"github.com/ullashroy/poco-server/backend/internal/kuro/integrations/baikal"
	"github.com/ullashroy/poco-server/backend/internal/kuro/integrations/immich"
	"github.com/ullashroy/poco-server/backend/internal/kuro/integrations/papra"
	"github.com/ullashroy/poco-server/backend/internal/kuro/llm"
	"github.com/ullashroy/poco-server/backend/internal/kuro/node"
	"github.com/ullashroy/poco-server/backend/internal/kuro/storage"
	"github.com/ullashroy/poco-server/backend/internal/state"
)

// PocoToolHandler executes native Go calls on the Poco server.
type PocoToolHandler struct {
	st *state.State
	ds *docker.Service
	cs *camera.Service
	db *db.DB
	nm *node.Manager
	js *storage.JSONStore
}

func NewPocoToolHandler(st *state.State, ds *docker.Service, cs *camera.Service, database *db.DB, nm *node.Manager, js *storage.JSONStore) *PocoToolHandler {
	return &PocoToolHandler{st: st, ds: ds, cs: cs, db: database, nm: nm, js: js}
}

func (h *PocoToolHandler) State() *state.State {
	return h.st
}

// resolveNodeID resolves a device name or ID against active connected nodes and database nodes
func (h *PocoToolHandler) resolveNodeID(nameOrID string) string {
	clean := strings.TrimSpace(nameOrID)
	if clean == "" {
		return ""
	}
	if h.nm != nil {
		if n, ok := h.nm.Get(clean); ok {
			return n.ID
		}
	}
	if h.db != nil {
		nodes, err := h.db.ListNodes("")
		if err == nil {
			for _, n := range nodes {
				if strings.EqualFold(n.ID, clean) || strings.EqualFold(n.DisplayName, clean) || strings.EqualFold(n.Hostname, clean) {
					return n.ID
				}
			}
		}
	}
	return clean
}


// BuiltinTools returns the LLM tool schemas for native Poco server management.
func (h *PocoToolHandler) BuiltinTools() []llm.Tool {
	return []llm.Tool{
		// ─── TIER 1: AUTONOMOUS READ & INSPECTION TOOLS ──────────────────────────
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_get_server_status",
				Description: "Get the complete real-time hardware status of the Poco Linux home server (CPU usage, RAM, battery %, storage, thermal, network, uptime).",
				Parameters:  map[string]any{"type": "object", "properties": map[string]any{}},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_access_camera",
				Description: "Access the live camera video stream of the Poco Linux home server. Discovers camera devices (/dev/video*), checks stream status, captures snapshots, and returns stream URLs (/api/v1/camera/stream or /ws/camera/stream) to display live video feeds in the app or floating HUD.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"device": map[string]any{
							"type":        "string",
							"description": "Optional camera device path (e.g. /dev/video2). If omitted, default primary server camera is selected.",
						},
						"action": map[string]any{
							"type":        "string",
							"enum":        []string{"stream", "snapshot", "status"},
							"description": "Stream feed, snapshot, or status. Defaults to 'stream'.",
						},
					},
				},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_list_docker_containers",
				Description: "List all Docker containers running on the Poco server, including their IDs, names, images, status, and ports.",
				Parameters:  map[string]any{"type": "object", "properties": map[string]any{}},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_get_docker_logs",
				Description: "Get the latest log output from a specified Docker container.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"container_id_or_name": map[string]any{"type": "string", "description": "Name or ID of the Docker container"},
						"tail_lines":           map[string]any{"type": "integer", "description": "Number of recent lines to retrieve (default 50)"},
					},
					"required": []string{"container_id_or_name"},
				},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_get_top_processes",
				Description: "Get the top running processes on the Poco server sorted by CPU or memory usage.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"limit": map[string]any{"type": "integer", "description": "Number of processes to return (default 10)"},
					},
				},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_get_tailscale_status",
				Description: "Get Tailscale VPN status, self IP, and peer list on the Poco server.",
				Parameters:  map[string]any{"type": "object", "properties": map[string]any{}},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_get_network_info",
				Description: "Get network interface configurations, IP addresses, and gateway details on the server.",
				Parameters:  map[string]any{"type": "object", "properties": map[string]any{}},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_read_file",
				Description: "Read the content of any text file, configuration, script, or compose file on the server.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"path":      map[string]any{"type": "string", "description": "Absolute or relative file path to read"},
						"max_lines": map[string]any{"type": "integer", "description": "Optional line limit (default 200)"},
					},
					"required": []string{"path"},
				},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_list_directory",
				Description: "List files and subdirectories at any path on the server.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"path": map[string]any{"type": "string", "description": "Directory path to list (e.g. '/var/log', '/home', '.')"},
					},
					"required": []string{"path"},
				},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_search_files",
				Description: "Search for files and directories matching a pattern or keyword on the server.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"pattern":   map[string]any{"type": "string", "description": "Filename pattern or wildcard (e.g. '*.yml', 'docker-compose')"},
						"directory": map[string]any{"type": "string", "description": "Root directory to search within (default '.')"},
					},
					"required": []string{"pattern"},
				},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_web_search",
				Description: "Search the live internet for up-to-date information, documentation, news, or technical answers using DuckDuckGo.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"query":       map[string]any{"type": "string", "description": "The search query or question"},
						"max_results": map[string]any{"type": "integer", "description": "Max results to return (default 5)"},
					},
					"required": []string{"query"},
				},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_wiki_search",
				Description: "Query Wikipedia for verified encyclopedia summaries, definitions, history, science, and concepts.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"query": map[string]any{"type": "string", "description": "Topic or title to search on Wikipedia"},
					},
					"required": []string{"query"},
				},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_read_web_page",
				Description: "Fetch and read the text content of any public web page or documentation URL.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"url": map[string]any{"type": "string", "description": "The HTTP/HTTPS web page URL to read"},
					},
					"required": []string{"url"},
				},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_run_read_only_command",
				Description: "Execute a safe, read-only terminal inspection command on the Linux server (e.g. uname, lscpu, free -h, df -h, ip a, uptime).",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"command": map[string]any{"type": "string", "description": "The read-only command string to execute"},
					},
					"required": []string{"command"},
				},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_get_device_telemetry",
				Description: "Get the latest hardware, battery, and network telemetry from connected user client devices (Android phone, Windows PC, etc.).",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"node_id": map[string]any{"type": "string", "description": "Optional specific device ID. If omitted, returns latest data from all devices."},
					},
				},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_get_device_calls",
				Description: "Get recent calls and missed calls from the user's connected Android device (caller name, phone number, call type, time).",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"node_id": map[string]any{"type": "string", "description": "Optional device ID"},
						"limit":   map[string]any{"type": "integer", "description": "Max calls to return (default 10)"},
					},
				},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_get_device_messages",
				Description: "Get recent incoming SMS/text messages from the user's connected Android device (sender name, phone number, message text, timestamp).",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"node_id": map[string]any{"type": "string", "description": "Optional device ID"},
						"limit":   map[string]any{"type": "integer", "description": "Max messages to return (default 10)"},
					},
				},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_locate_device",
				Description: "Find the physical location ('Where is my phone / device?') of the user's connected Android device (GPS coordinates, approximate address, Wi-Fi SSID).",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"node_id": map[string]any{"type": "string", "description": "Optional device ID"},
					},
				},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "memory_store",
				Description: "Store an important user preference, fact, or directory layout in Kuro's long-term memory for future recall.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"content":    map[string]any{"type": "string", "description": "The fact or preference to remember"},
						"category":   map[string]any{"type": "string", "enum": []string{"preference", "fact", "device", "service", "general"}, "description": "Category of memory"},
						"importance": map[string]any{"type": "integer", "description": "Importance rating from 1 to 10"},
					},
					"required": []string{"content", "category", "importance"},
				},
			},
		},

		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_calendar_list_events",
				Description: "List upcoming calendar events and meetings from Baïkal CalDAV server across all user calendars (or a specific calendar). Can filter for 'today', 'tomorrow', 'week', or custom range.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"calendar":    map[string]any{"type": "string", "description": "Optional specific calendar name (e.g. 'office', 'personal', 'birthday', 'events'). If omitted, aggregates across ALL user calendars."},
						"filter_mode": map[string]any{"type": "string", "enum": []string{"today", "tomorrow", "week", "all"}, "description": "Filter timeframe: 'today' for today only, 'tomorrow' for tomorrow, 'week' for the upcoming week"},
						"days_ahead":  map[string]any{"type": "integer", "description": "Number of days ahead to look (default 7)"},
					},
				},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_reminder_list",
				Description: "List active reminders and to-do items from the designated Baïkal reminder calendar.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"calendar": map[string]any{"type": "string", "description": "Optional reminder calendar name"},
					},
				},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_contacts_search",
				Description: "Search contacts in Baïkal address book by name, phone number, email, or organization.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"query": map[string]any{"type": "string", "description": "Search term (name, organization, email, or phone number)"},
					},
					"required": []string{"query"},
				},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_immich_search_photos",
				Description: "Search photos and videos from Immich photo server by date (year, month, day, exact date), location (city, state, country), favorites, and smart semantic CLIP queries (e.g. 'sunset at the beach', 'cats', 'cars'). Displays interactive photo grids and carousels in chat and floating assistant.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"query":       map[string]any{"type": "string", "description": "Smart semantic visual search query (e.g. 'dog playing in snow', 'food', 'car', 'sunset')"},
						"year":        map[string]any{"type": "integer", "description": "Filter by year (e.g. 2024, 2025)"},
						"month":       map[string]any{"type": "integer", "description": "Filter by month (1 to 12)"},
						"day":         map[string]any{"type": "integer", "description": "Filter by day of month (1 to 31)"},
						"date":        map[string]any{"type": "string", "description": "Filter by exact date (YYYY-MM-DD)"},
						"location":    map[string]any{"type": "string", "description": "City, state, or country name (e.g. 'Tokyo', 'London', 'Paris')"},
						"is_favorite": map[string]any{"type": "boolean", "description": "Only return favorite photos"},
						"limit":       map[string]any{"type": "integer", "description": "Maximum number of photos to retrieve (default 8, max 24)"},
					},
				},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_immich_search_albums",
				Description: "Search photo albums in Immich by album name or keyword (e.g. 'Tokyo Trip', 'Vacation 2024', 'Family').",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"query": map[string]any{"type": "string", "description": "Album name or keyword to search"},
					},
				},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_immich_search_people",
				Description: "Search recognized people in Immich by name (e.g. 'Ullash', 'Sarah', 'Mom') and display their tagged photos.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"name":        map[string]any{"type": "string", "description": "Person's name to search"},
						"with_photos": map[string]any{"type": "boolean", "description": "Whether to also fetch recent photos of this person (default true)"},
						"limit":       map[string]any{"type": "integer", "description": "Maximum photos to retrieve (default 8)"},
					},
					"required": []string{"name"},
				},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_web_search",
				Description: "Perform live internet search and tech documentation research using DuckDuckGo to troubleshoot errors, lookup command manuals, or find online information.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"query":       map[string]any{"type": "string", "description": "Search query keywords or error message"},
						"max_results": map[string]any{"type": "integer", "description": "Maximum search results (default 5, max 10)"},
					},
					"required": []string{"query"},
				},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_wiki_search",
				Description: "Search Wikipedia for detailed encyclopedic summaries on technical or general concepts.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"query": map[string]any{"type": "string", "description": "Topic or article title to search"},
					},
					"required": []string{"query"},
				},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_read_web_page",
				Description: "Fetch and extract readable plain text from a public web page or technical documentation URL.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"url": map[string]any{"type": "string", "description": "The HTTP or HTTPS URL to read"},
					},
					"required": []string{"url"},
				},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_investigate_error",
				Description: "Autonomously investigate a server error, stack trace, or failing container using online documentation search to generate a step-by-step troubleshooting runbook.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"source":     map[string]any{"type": "string", "description": "Source of error (e.g. 'Docker Container postgres', 'Nginx Reverse Proxy')"},
						"error_text": map[string]any{"type": "string", "description": "The exact error message or stack trace"},
					},
					"required": []string{"source", "error_text"},
				},
			},
		},

		// ─── TIER 2: GUARDED WRITE & MUTATION TOOLS ─────────────────────────────
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_calendar_create_event",
				Description: "[GUARDED WRITE] Create a new calendar event in Baïkal CalDAV server in the designated or matching calendar. Supports specific calendars ('events', 'office', 'birthday', 'freelance', 'personal', 'project'), all-day flags, and yearly recurrences.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"title":       map[string]any{"type": "string", "description": "Title or summary of the event"},
						"start_time":  map[string]any{"type": "string", "description": "Start time in ISO format (e.g. 2026-08-25T15:00:00Z) or YYYY-MM-DD"},
						"end_time":    map[string]any{"type": "string", "description": "End time in ISO format (e.g. 2026-08-25T16:00:00Z) or YYYY-MM-DD"},
						"calendar":    map[string]any{"type": "string", "description": "Target calendar name (e.g. 'events', 'office', 'birthday', 'freelance', 'personal', 'project')"},
						"location":    map[string]any{"type": "string", "description": "Optional location"},
						"description": map[string]any{"type": "string", "description": "Optional description"},
						"is_all_day":   map[string]any{"type": "boolean", "description": "True if this is an all-day event (e.g. birthday or all-day holiday)"},
						"rrule":       map[string]any{"type": "string", "description": "Optional recurrence rule (e.g. 'FREQ=YEARLY' for birthdays, 'FREQ=MONTHLY', etc.)"},
					},
					"required": []string{"title", "start_time"},
				},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_reminder_create",
				Description: "[GUARDED WRITE] Create a reminder or to-do task in the designated Baïkal reminder calendar.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"title":       map[string]any{"type": "string", "description": "Reminder / task title"},
						"due_date":    map[string]any{"type": "string", "description": "Optional due date in ISO format"},
						"priority":    map[string]any{"type": "integer", "description": "Priority 1 (high), 5 (medium), 9 (low)"},
						"description": map[string]any{"type": "string", "description": "Optional notes"},
					},
					"required": []string{"title"},
				},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_calendar_delete_event",
				Description: "[GUARDED WRITE] Delete a calendar event from Baïkal CalDAV server. Always preview event details and require user confirmation first.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"event_id": map[string]any{"type": "string", "description": "The UID or ICS filename of the event to delete"},
						"calendar": map[string]any{"type": "string", "description": "Optional calendar name"},
						"title":    map[string]any{"type": "string", "description": "Optional event title to look up if event_id is unknown"},
					},
				},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_restart_docker_container",
				Description: "[GUARDED WRITE] Restart a Docker container on the Poco server. Must preview command and obtain user consent before executing.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"container_id_or_name": map[string]any{"type": "string", "description": "The name or ID of the container to restart"},
					},
					"required": []string{"container_id_or_name"},
				},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_stop_docker_container",
				Description: "[GUARDED WRITE] Stop a Docker container on the Poco server. Must obtain user consent before executing.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"container_id_or_name": map[string]any{"type": "string", "description": "The name or ID of the container to stop"},
					},
					"required": []string{"container_id_or_name"},
				},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_start_docker_container",
				Description: "[GUARDED WRITE] Start a stopped Docker container on the Poco server. Must obtain user consent before executing.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"container_id_or_name": map[string]any{"type": "string", "description": "The name or ID of the container to start"},
					},
					"required": []string{"container_id_or_name"},
				},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_write_file",
				Description: "[GUARDED WRITE] Write or overwrite content to a file on the server. Must preview target path and content before executing.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"path":    map[string]any{"type": "string", "description": "File path to write to"},
						"content": map[string]any{"type": "string", "description": "Text content to write to file"},
					},
					"required": []string{"path", "content"},
				},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_delete_file",
				Description: "[GUARDED WRITE] Delete a file on the server. Must preview path and obtain explicit confirmation before executing.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"path": map[string]any{"type": "string", "description": "File path to delete"},
					},
					"required": []string{"path"},
				},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_execute_mutating_command",
				Description: "[GUARDED WRITE] Execute a shell command that modifies system state. Must preview the exact command and obtain user consent before executing.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"command": map[string]any{"type": "string", "description": "The shell command to execute"},
					},
					"required": []string{"command"},
				},
			},
		},
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_ring_device",
				Description: "[GUARDED ACTION] Play a loud finding alarm tone on the user's Android phone (Find My Phone).",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"node_id":          map[string]any{"type": "string", "description": "Optional device ID"},
						"duration_seconds": map[string]any{"type": "integer", "description": "Duration to ring in seconds (default 30)"},
					},
				},
			},
		},

		// ─── PAPRA DOCUMENT MANAGEMENT (INVOICES, RECEIPTS, OCR DOCS) ───
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_papra_search",
				Description: "Search scanned documents, receipts, utility bills, warranty cards, contracts, and PDFs indexed in Papra Document Management. Always use this when the user asks for invoices, receipts, tax documents, or scanned files.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"query":    map[string]any{"type": "string", "description": "Search keyword or phrase matching document title, OCR text, or metadata"},
						"category": map[string]any{"type": "string", "enum": []string{"invoice", "receipt", "contract", "warranty", "doc"}, "description": "Optional category filter"},
						"tag":      map[string]any{"type": "string", "description": "Optional tag filter"},
						"limit":    map[string]any{"type": "integer", "description": "Maximum number of documents to return (default: 10)"},
					},
				},
			},
		},

		// ─── UNIFIED CROSS-SOURCE PERSONAL DATA SEARCH ───
		{
			Type: "function",
			Function: llm.ToolFunction{
				Name:        "poco_personal_search_all",
				Description: "Unified cross-source federated search across all personal sovereign data adapters: Baïkal (Calendar & Contacts), Papra (Invoices & OCR Documents), and Immich (Photos). Use when the user asks a broad personal query (e.g. 'find everything about dentist', 'search my records for electricity bill').",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"query": map[string]any{"type": "string", "description": "Keyword or topic to search across all personal homelab data services"},
						"limit": map[string]any{"type": "integer", "description": "Maximum results per source category (default: 5)"},
					},
					"required": []string{"query"},
				},
			},
		},
	}
}

// Execute executes a native Poco tool in-memory.
func (h *PocoToolHandler) Execute(ctx context.Context, username, role, name, argsJSON string) (string, error) {
	const UnauthorizedMsg = "Sorry, I can't do that. You do not have authorization."

	// 1. Strict RBAC Enforcement for Admin-Only Server Integrations & System Controls
	adminOnlyTools := map[string]bool{
		// Immich Photos
		"poco_immich_search_assets": true, "poco_immich_list_albums": true, "poco_immich_get_asset_info": true, "poco_immich_search_by_person": true, "poco_immich_list_people": true,
		// Baïkal Calendar & Contacts
		"poco_calendar_list_events": true, "poco_calendar_create_event": true, "poco_contacts_search": true, "poco_contacts_list": true, "poco_reminder_list": true, "poco_reminder_create": true,
		// Papra Document Management & Personal Search
		"poco_papra_search": true, "poco_personal_search_all": true,
		// Server Cameras
		"poco_access_camera": true,
		// Docker Containers
		"poco_list_docker_containers": true, "poco_get_docker_logs": true, "poco_restart_docker_container": true, "poco_start_docker_container": true, "poco_stop_docker_container": true,
		// Server System Metrics & Filesystem
		"poco_get_server_status": true, "poco_get_top_processes": true, "poco_get_network_info": true, "poco_get_tailscale_status": true, "poco_run_read_only_command": true, "poco_execute_mutating_command": true,
		"poco_read_file": true, "poco_list_directory": true, "poco_search_files": true, "poco_write_file": true, "poco_delete_file": true,
	}

	if adminOnlyTools[name] && role != "admin" {
		return UnauthorizedMsg, nil
	}

	switch name {

	// ─── TIER 1: READ / INSPECTION TOOLS ─────────────────────────────────────

	case "poco_get_server_status":
		status := h.st.Status()
		memUsedGB := float64(status.Memory.Used) / (1024 * 1024 * 1024)
		memTotalGB := float64(status.Memory.Total) / (1024 * 1024 * 1024)
		storageFreeGB := float64(status.Storage.Summary.Free) / (1024 * 1024 * 1024)
		storageTotalGB := float64(status.Storage.Summary.TotalCapacity) / (1024 * 1024 * 1024)
		uptimeHours := float64(status.System.Uptime) / 3600

		return fmt.Sprintf("Poco Server Status:\n- CPU: %.1f%%\n- RAM: %.1fGB / %.1fGB (%.1f%%)\n- Battery: %d%% (%s, %.1f°C)\n- Storage: %.1fGB free / %.1fGB total\n- Uptime: %.1f hours",
			status.CPU.UsagePercent,
			memUsedGB, memTotalGB, status.Memory.Usage,
			status.Battery.Capacity, status.Battery.Status, status.Battery.TemperatureC,
			storageFreeGB, storageTotalGB,
			uptimeHours,
		), nil

	case "poco_access_camera":
		if h.cs == nil {
			return "Camera service is not initialized on the server.", nil
		}

		var args struct {
			Device string `json:"device"`
			Action string `json:"action"`
		}
		if argsJSON != "" {
			_ = json.Unmarshal([]byte(argsJSON), &args)
		}
		if args.Action == "" {
			args.Action = "stream"
		}

		devices := h.cs.ListDevices()
		if len(devices) == 0 {
			devices = []camera.CameraDevice{
				{Path: "/dev/video2", Name: "Main Back Camera (Sony IMX363)", Driver: "v4l2"},
				{Path: "/dev/video6", Name: "Front Camera", Driver: "v4l2"},
			}
		}

		selectedDevice := devices[0]
		if args.Device != "" {
			for _, d := range devices {
				if d.Path == args.Device || strings.Contains(strings.ToLower(d.Name), strings.ToLower(args.Device)) {
					selectedDevice = d
					break
				}
			}
		}

		streamURL := fmt.Sprintf("/api/v1/camera/stream?device=%s", selectedDevice.Path)
		snapshotURL := fmt.Sprintf("/api/v1/camera/snapshot?device=%s", selectedDevice.Path)
		wsURL := fmt.Sprintf("/ws/camera/stream?device=%s", selectedDevice.Path)

		respMap := map[string]any{
			"status":       "granted",
			"action":       args.Action,
			"device_path":  selectedDevice.Path,
			"device_name":  selectedDevice.Name,
			"stream_url":   streamURL,
			"snapshot_url": snapshotURL,
			"ws_url":       wsURL,
			"total_cams":   len(devices),
			"devices":      devices,
			"message":      fmt.Sprintf("Server camera access granted for %s (%s).", selectedDevice.Name, selectedDevice.Path),
		}

		respJSON, _ := json.Marshal(respMap)
		return fmt.Sprintf("CAMERA_ACCESS_GRANTED: %s\nStream URL: %s\nSnapshot URL: %s\nDirect feed embedded for client playback.", string(respJSON), streamURL, snapshotURL), nil

	case "poco_list_docker_containers":
		if h.ds == nil {
			return "Docker service unavailable", nil
		}
		containers, err := h.ds.ListContainers(ctx, username)
		if err != nil {
			return "", err
		}
		if len(containers) == 0 {
			return "No Docker containers are currently running on Poco server.", nil
		}
		var lines []string
		for _, c := range containers {
			cName := c.Name
			if cName == "" && len(c.ID) >= 8 {
				cName = c.ID[:8]
			}
			lines = append(lines, fmt.Sprintf("• %s | Image: %s | Status: %s (%s)", cName, c.Image, c.Status, c.State))
		}
		return "Running Docker Containers on Poco Server:\n" + strings.Join(lines, "\n"), nil

	case "poco_get_docker_logs":
		if h.ds == nil {
			return "Docker service unavailable", nil
		}
		var args struct {
			ID   string `json:"container_id_or_name"`
			Tail int    `json:"tail_lines"`
		}
		if err := json.Unmarshal([]byte(argsJSON), &args); err != nil || args.ID == "" {
			return "Missing container_id_or_name argument", nil
		}
		if args.Tail <= 0 {
			args.Tail = 50
		}
		cmdCtx, cancel := context.WithTimeout(ctx, 8*time.Second)
		defer cancel()
		cmd := exec.CommandContext(cmdCtx, "docker", "logs", "--tail", fmt.Sprint(args.Tail), args.ID)
		out, err := cmd.CombinedOutput()
		if err != nil {
			return fmt.Sprintf("Failed to get logs for %s: %v", args.ID, err), nil
		}
		res := strings.TrimSpace(string(out))
		if len(res) > 3000 {
			res = res[len(res)-3000:]
		}
		return fmt.Sprintf("Recent Logs for %s:\n%s", args.ID, res), nil

	case "poco_get_top_processes":
		cmdCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		defer cancel()
		var cmd *exec.Cmd
		if runtime.GOOS == "windows" {
			cmd = exec.CommandContext(cmdCtx, "powershell", "-NoProfile", "-NonInteractive", "-Command", "Get-Process | Sort-Object CPU -Descending | Select-Object -First 10 -Property Id, ProcessName, CPU, WorkingSet64 | Format-Table -AutoSize")
		} else {
			cmd = exec.CommandContext(cmdCtx, "ps", "aux", "--sort=-%cpu")
		}
		out, err := cmd.CombinedOutput()
		if err != nil {
			return fmt.Sprintf("Error retrieving top processes: %v", err), nil
		}
		lines := strings.Split(strings.TrimSpace(string(out)), "\n")
		limit := 11
		if len(lines) < limit {
			limit = len(lines)
		}
		return strings.Join(lines[:limit], "\n"), nil

	case "poco_get_network_info":
		ifaces, err := net.Interfaces()
		if err != nil {
			return fmt.Sprintf("Error listing network interfaces: %v", err), nil
		}
		var sb strings.Builder
		sb.WriteString("Active Network Interfaces:\n")
		for _, iface := range ifaces {
			if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
				continue
			}
			addrs, err := iface.Addrs()
			if err != nil || len(addrs) == 0 {
				continue
			}
			sb.WriteString(fmt.Sprintf("• %s (MAC: %s):\n", iface.Name, iface.HardwareAddr))
			for _, addr := range addrs {
				sb.WriteString(fmt.Sprintf("    - %s\n", addr.String()))
			}
		}
		return strings.TrimSpace(sb.String()), nil

	case "poco_get_tailscale_status":
		cmdCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		defer cancel()
		cmd := exec.CommandContext(cmdCtx, "tailscale", "status", "--json")
		out, err := cmd.CombinedOutput()
		if err != nil {
			cmdPlain := exec.CommandContext(ctx, "tailscale", "status")
			plainOut, pErr := cmdPlain.CombinedOutput()
			if pErr != nil {
				return "Tailscale is not active or not installed on the system.", nil
			}
			return fmt.Sprintf("Tailscale Status:\n%s", string(plainOut)), nil
		}
		return fmt.Sprintf("Tailscale Status:\n%s", string(out)), nil

	case "poco_run_read_only_command":
		var args struct {
			Command string `json:"command"`
		}
		if err := json.Unmarshal([]byte(argsJSON), &args); err != nil || args.Command == "" {
			return "Missing command argument", nil
		}
		cmdLower := strings.ToLower(args.Command)
		forbidden := []string{"rm ", "dd ", "mkfs", "chmod ", "chown ", "shutdown", "reboot", "poweroff", "systemctl restart", "systemctl stop", ">", ">>", "sudo"}
		for _, f := range forbidden {
			if strings.Contains(cmdLower, f) {
				return fmt.Sprintf("Blocked: command contains unsafe mutating keyword '%s'", f), nil
			}
		}
		cmdCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
		defer cancel()
		var cmd *exec.Cmd
		if runtime.GOOS == "windows" {
			cmd = exec.CommandContext(cmdCtx, "powershell", "-NoProfile", "-NonInteractive", "-Command", args.Command)
		} else {
			cmd = exec.CommandContext(cmdCtx, "sh", "-c", args.Command)
		}
		out, err := cmd.CombinedOutput()
		outputStr := strings.TrimSpace(string(out))
		if err != nil {
			return fmt.Sprintf("Command exited with error (%v):\n%s", err, outputStr), nil
		}
		if outputStr == "" {
			return "(command completed with empty output)", nil
		}
		return outputStr, nil

	case "poco_get_device_telemetry":
		if h.db == nil {
			return "Database unavailable", nil
		}
		var args struct {
			NodeID string `json:"node_id"`
		}
		if argsJSON != "" {
			_ = json.Unmarshal([]byte(argsJSON), &args)
		}
		targetID := h.resolveNodeID(args.NodeID)

		if targetID != "" && !h.isNodeAuthorized(targetID, username, role) {
			return UnauthorizedMsg, nil
		}

		userFilter := username
		if role == "admin" {
			userFilter = ""
		}
		allDbNodes, _ := h.db.ListNodes(userFilter)
		onlineMap := make(map[string]bool)
		if h.nm != nil {
			for _, on := range h.nm.ListForUser(username, role) {
				onlineMap[on.ID] = true
			}
		}

		if len(allDbNodes) == 0 && (h.nm == nil || len(h.nm.ListForUser(username, role)) == 0) {
			return "You do not have any connected client devices registered to your account.", nil
		}

		var matchedNodes []db.Node
		for _, dn := range allDbNodes {
			if targetID == "" || dn.ID == targetID {
				matchedNodes = append(matchedNodes, dn)
			}
		}

		if len(matchedNodes) == 0 && targetID != "" {
			return fmt.Sprintf("No registered device found matching identifier '%s'.", args.NodeID), nil
		}

		var sb strings.Builder
		sb.WriteString("Device Telemetry Breakdown:\n\n")
		for _, n := range matchedNodes {
			devName := n.DisplayName
			if devName == "" {
				devName = n.Hostname
			}
			if devName == "" {
				devName = n.ID
			}

			status := "Offline"
			if onlineMap[n.ID] {
				status = "Online (Active Session)"
			}

			lastSeen := "Unknown"
			if n.LastSeenAt != nil && *n.LastSeenAt != "" {
				lastSeen = *n.LastSeenAt
			}

			snapshot, _ := h.db.GetLatestNodeSnapshot(n.ID)
			sb.WriteString(fmt.Sprintf("━━━ [%s] (Node ID: %s) ━━━\n", devName, n.ID))
			sb.WriteString(fmt.Sprintf("• Platform: %s\n• Connection Status: %s\n• Last Seen: %s\n• Snapshot Data: %s\n\n",
				strings.ToUpper(n.Platform), status, lastSeen, snapshot))
		}
		return strings.TrimSpace(sb.String()), nil

	case "poco_get_device_calls":
		if h.db == nil {
			return "Database unavailable", nil
		}
		var args struct {
			NodeID string `json:"node_id"`
			Limit  int    `json:"limit"`
			Offset int    `json:"offset"`
		}
		if argsJSON != "" {
			_ = json.Unmarshal([]byte(argsJSON), &args)
		}
		args.NodeID = h.resolveNodeID(args.NodeID)
		if args.NodeID != "" && !h.isNodeAuthorized(args.NodeID, username, role) {
			return UnauthorizedMsg, nil
		}
		if args.Limit <= 0 {
			args.Limit = 10
		}
		if args.Offset < 0 {
			args.Offset = 0
		}

		userFilter := username
		if role == "admin" {
			userFilter = ""
		}
		calls, total, err := h.db.GetDeviceCallsPaginated(userFilter, args.NodeID, args.Limit, args.Offset)
		if err != nil {
			return fmt.Sprintf("Error retrieving device calls: %v", err), nil
		}
		if len(calls) == 0 && args.Offset == 0 {
			return "No call logs currently recorded from connected devices.", nil
		}
		if len(calls) == 0 {
			return fmt.Sprintf("No more calls found beyond offset %d (Total: %d).", args.Offset, total), nil
		}

		type CallCardItem struct {
			ID                string `json:"id"`
			CallerName        string `json:"caller_name"`
			PhoneNumber       string `json:"phone_number"`
			CallType          string `json:"call_type"`
			Timestamp         string `json:"timestamp"`
			Duration          int    `json:"duration"`
			DurationFormatted string `json:"duration_formatted"`
		}

		var cardItems []CallCardItem
		var lines []string
		for _, c := range calls {
			name := c.CallerName
			if name == "" {
				name = c.PhoneNumber
			}
			if name == "" {
				name = "Unknown Caller"
			}
			formattedTime := formatDateTime(c.Timestamp)
			formattedDur := formatDuration(c.Duration)
			if strings.EqualFold(c.CallType, "missed") || strings.EqualFold(c.CallType, "rejected") {
				formattedDur = strings.Title(c.CallType)
			}

			cardItems = append(cardItems, CallCardItem{
				ID:                c.ID,
				CallerName:        name,
				PhoneNumber:       c.PhoneNumber,
				CallType:          c.CallType,
				Timestamp:         formattedTime,
				Duration:          c.Duration,
				DurationFormatted: formattedDur,
			})
			lines = append(lines, fmt.Sprintf("• [%s] %s (%s) — %s (%s)",
				c.CallType, name, c.PhoneNumber, formattedTime, formattedDur))
		}

		listPayload := map[string]any{
			"calls":       cardItems,
			"total":       total,
			"limit":       args.Limit,
			"offset":      args.Offset,
			"has_more":    (args.Offset + len(calls)) < total,
			"next_offset": args.Offset + len(calls),
			"node_id":     args.NodeID,
		}
		rawJSON, _ := json.Marshal(listPayload)

		return fmt.Sprintf("Recent Calls (%d of %d):\n%s\n\n[CALL_LOG_LIST: %s]",
			len(cardItems), total, strings.Join(lines, "\n"), string(rawJSON)), nil

	case "poco_get_device_messages":
		if h.db == nil {
			return "Database unavailable", nil
		}
		var args struct {
			NodeID string `json:"node_id"`
			Limit  int    `json:"limit"`
			Offset int    `json:"offset"`
		}
		if argsJSON != "" {
			_ = json.Unmarshal([]byte(argsJSON), &args)
		}
		args.NodeID = h.resolveNodeID(args.NodeID)
		if args.NodeID != "" && !h.isNodeAuthorized(args.NodeID, username, role) {
			return UnauthorizedMsg, nil
		}
		if args.Limit <= 0 {
			args.Limit = 10
		}
		if args.Offset < 0 {
			args.Offset = 0
		}

		userFilter := username
		if role == "admin" {
			userFilter = ""
		}
		msgs, total, err := h.db.GetDeviceMessagesPaginated(userFilter, args.NodeID, args.Limit, args.Offset)
		if err != nil {
			return fmt.Sprintf("Error retrieving device messages: %v", err), nil
		}
		if len(msgs) == 0 && args.Offset == 0 {
			return "No text messages currently recorded from connected devices.", nil
		}
		if len(msgs) == 0 {
			return fmt.Sprintf("No more messages found beyond offset %d (Total: %d).", args.Offset, total), nil
		}

		type MsgCardItem struct {
			ID          string `json:"id"`
			SenderName  string `json:"sender_name"`
			PhoneNumber string `json:"phone_number"`
			MessageBody string `json:"message_body"`
			IsRead      bool   `json:"is_read"`
			Timestamp   string `json:"timestamp"`
		}

		var cardItems []MsgCardItem
		var lines []string
		for _, m := range msgs {
			sender := m.SenderName
			if sender == "" {
				sender = m.PhoneNumber
			}
			if sender == "" {
				sender = "Unknown Sender"
			}
			formattedTime := formatDateTime(m.Timestamp)
			snippet := m.MessageBody
			if len(snippet) > 60 {
				snippet = snippet[:57] + "..."
			}

			cardItems = append(cardItems, MsgCardItem{
				ID:          m.ID,
				SenderName:  sender,
				PhoneNumber: m.PhoneNumber,
				MessageBody: m.MessageBody,
				IsRead:      m.IsRead,
				Timestamp:   formattedTime,
			})
			lines = append(lines, fmt.Sprintf("• [%s] %s (%s): \"%s\"",
				formattedTime, sender, m.PhoneNumber, snippet))
		}

		listPayload := map[string]any{
			"messages":    cardItems,
			"total":       total,
			"limit":       args.Limit,
			"offset":      args.Offset,
			"has_more":    (args.Offset + len(msgs)) < total,
			"next_offset": args.Offset + len(msgs),
			"node_id":     args.NodeID,
		}
		rawJSON, _ := json.Marshal(listPayload)

		return fmt.Sprintf("Recent Messages (%d of %d):\n%s\n\n[SMS_MESSAGE_LIST: %s]",
			len(cardItems), total, strings.Join(lines, "\n"), string(rawJSON)), nil

	case "poco_locate_device":
		if h.db == nil {
			return "Database unavailable", nil
		}
		var args struct {
			NodeID string `json:"node_id"`
		}
		if argsJSON != "" {
			_ = json.Unmarshal([]byte(argsJSON), &args)
		}
		args.NodeID = h.resolveNodeID(args.NodeID)
		if args.NodeID != "" && !h.isNodeAuthorized(args.NodeID, username, role) {
			return UnauthorizedMsg, nil
		}
		userFilter := username
		if role == "admin" {
			userFilter = ""
		}
		if args.NodeID == "" {
			userNodes, _ := h.db.ListNodes(userFilter)
			if len(userNodes) > 0 {
				args.NodeID = userNodes[0].ID
			}
		}
		if args.NodeID == "" {
			return "You do not have any connected client devices registered to your account.", nil
		}

		loc, err := h.db.GetLatestDeviceLocation(userFilter, args.NodeID)
		if err != nil {
			return fmt.Sprintf("Error retrieving device location: %v", err), nil
		}
		if loc == nil {
			return "No GPS location data recorded for this device yet.", nil
		}
		addr := loc.Address
		if addr == "" {
			addr = "Coordinates: " + fmt.Sprintf("%.5f, %.5f", loc.Latitude, loc.Longitude)
		}
		return fmt.Sprintf("Device Location for %s:\n- Location: %s\n- Coordinates: %.6f, %.6f (Accuracy: %.1fm)\n- Wi-Fi SSID: %s\n- Last Recorded: %s",
			loc.NodeID, addr, loc.Latitude, loc.Longitude, loc.Accuracy, loc.WifiSSID, loc.Timestamp), nil

	// ─── TIER 2: GUARDED WRITE & MUTATION TOOLS ─────────────────────────────

	case "poco_restart_docker_container":
		if h.ds == nil {
			return "Docker service unavailable", nil
		}
		var args struct {
			ID string `json:"container_id_or_name"`
		}
		if err := json.Unmarshal([]byte(argsJSON), &args); err != nil || args.ID == "" {
			return "Missing container_id_or_name argument", nil
		}
		if err := h.ds.RestartContainer(ctx, username, args.ID); err != nil {
			return fmt.Sprintf("Failed to restart container %s: %v", args.ID, err), nil
		}
		return fmt.Sprintf("Successfully restarted Docker container '%s'", args.ID), nil

	case "poco_stop_docker_container":
		if h.ds == nil {
			return "Docker service unavailable", nil
		}
		var args struct {
			ID string `json:"container_id_or_name"`
		}
		if err := json.Unmarshal([]byte(argsJSON), &args); err != nil || args.ID == "" {
			return "Missing container_id_or_name argument", nil
		}
		if err := h.ds.StopContainer(ctx, username, args.ID); err != nil {
			return fmt.Sprintf("Failed to stop container %s: %v", args.ID, err), nil
		}
		return fmt.Sprintf("Successfully stopped Docker container '%s'", args.ID), nil

	case "poco_start_docker_container":
		if h.ds == nil {
			return "Docker service unavailable", nil
		}
		var args struct {
			ID string `json:"container_id_or_name"`
		}
		if err := json.Unmarshal([]byte(argsJSON), &args); err != nil || args.ID == "" {
			return "Missing container_id_or_name argument", nil
		}
		if err := h.ds.StartContainer(ctx, username, args.ID); err != nil {
			return fmt.Sprintf("Failed to start container %s: %v", args.ID, err), nil
		}
		return fmt.Sprintf("Successfully started Docker container '%s'", args.ID), nil

	case "poco_write_file":
		var args struct {
			Path    string `json:"path"`
			Content string `json:"content"`
		}
		if err := json.Unmarshal([]byte(argsJSON), &args); err != nil || args.Path == "" {
			return "Missing path or content argument", nil
		}
		if err := os.MkdirAll(filepath.Dir(args.Path), 0o755); err != nil {
			return fmt.Sprintf("Failed to create parent directory for %s: %v", args.Path, err), nil
		}
		if err := os.WriteFile(args.Path, []byte(args.Content), 0o644); err != nil {
			return fmt.Sprintf("Failed to write to %s: %v", args.Path, err), nil
		}
		return fmt.Sprintf("Successfully written %d bytes to %s", len(args.Content), args.Path), nil

	case "poco_delete_file":
		var args struct {
			Path string `json:"path"`
		}
		if err := json.Unmarshal([]byte(argsJSON), &args); err != nil || args.Path == "" {
			return "Missing path argument", nil
		}
		if err := os.Remove(args.Path); err != nil {
			return fmt.Sprintf("Failed to delete %s: %v", args.Path, err), nil
		}
		return fmt.Sprintf("Successfully deleted %s", args.Path), nil

	case "poco_execute_mutating_command":
		var args struct {
			Command string `json:"command"`
		}
		if err := json.Unmarshal([]byte(argsJSON), &args); err != nil || args.Command == "" {
			return "Missing command argument", nil
		}
		cmdCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		defer cancel()
		var cmd *exec.Cmd
		if runtime.GOOS == "windows" {
			cmd = exec.CommandContext(cmdCtx, "powershell", "-NoProfile", "-NonInteractive", "-Command", args.Command)
		} else {
			cmd = exec.CommandContext(cmdCtx, "sh", "-c", args.Command)
		}
		out, err := cmd.CombinedOutput()
		outputStr := strings.TrimSpace(string(out))
		if err != nil {
			return fmt.Sprintf("Command exited with error (%v):\n%s", err, outputStr), nil
		}
		return fmt.Sprintf("Command executed successfully:\n%s", outputStr), nil

	case "poco_ring_device":
		if h.nm == nil {
			return "Device manager unavailable", nil
		}
		var args struct {
			NodeID          string `json:"node_id"`
			DurationSeconds int    `json:"duration_seconds"`
		}
		if argsJSON != "" {
			_ = json.Unmarshal([]byte(argsJSON), &args)
		}
		if args.NodeID != "" && !h.isNodeAuthorized(args.NodeID, username, role) {
			return UnauthorizedMsg, nil
		}
		if args.DurationSeconds <= 0 {
			args.DurationSeconds = 30
		}
		targetNode := args.NodeID
		if targetNode == "" {
			nodes := h.nm.ListForUser(username, role)
			if len(nodes) > 0 {
				targetNode = nodes[0].ID
			}
		}
		if targetNode == "" {
			// Check if user has registered devices in DB that are currently offline
			userFilter := username
			if role == "admin" {
				userFilter = ""
			}
			if h.db != nil {
				if dbNodes, err := h.db.ListNodes(userFilter); err == nil && len(dbNodes) > 0 {
					devName := dbNodes[0].DisplayName
					if devName == "" {
						devName = dbNodes[0].ID
					}
					return fmt.Sprintf("Your device '%s' is currently offline. I couldn't ring it right now.", devName), nil
				}
			}
			return "You do not have any connected client devices registered to your account.", nil
		}
		res, err := h.nm.SendCommand(targetNode, "system.ring", map[string]any{
			"duration_seconds": args.DurationSeconds,
		}, 10*time.Second)
		if err != nil {
			return fmt.Sprintf("Failed to trigger ring alarm on %s: %v", targetNode, err), nil
		}
		if !res.Success {
			return fmt.Sprintf("Device error: %s", res.Error), nil
		}
		return fmt.Sprintf("Ringing device %s at maximum volume for %d seconds.", targetNode, args.DurationSeconds), nil

	case "poco_calendar_list_events":
		cfg, err := h.getBaikalConfig()
		if err != nil {
			return fmt.Sprintf("Baïkal is not configured: %v. Please configure Baïkal in Assistant -> Server Integrations.", err), nil
		}
		var args struct {
			Calendar   string `json:"calendar"`
			FilterMode string `json:"filter_mode"`
			DaysAhead  int    `json:"days_ahead"`
		}
		if argsJSON != "" {
			_ = json.Unmarshal([]byte(argsJSON), &args)
		}

		now := time.Now()
		var start, until time.Time
		headerText := ""

		fMode := strings.ToLower(strings.TrimSpace(args.FilterMode))
		switch fMode {
		case "today":
			start = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
			until = time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 0, now.Location())
			headerText = fmt.Sprintf("Today's Schedule (%s)", now.Format("Mon Jan 02"))
		case "tomorrow":
			tom := now.AddDate(0, 0, 1)
			start = time.Date(tom.Year(), tom.Month(), tom.Day(), 0, 0, 0, 0, tom.Location())
			until = time.Date(tom.Year(), tom.Month(), tom.Day(), 23, 59, 59, 0, tom.Location())
			headerText = fmt.Sprintf("Tomorrow's Schedule (%s)", tom.Format("Mon Jan 02"))
		case "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday":
			targetWeekday := time.Sunday
			switch fMode {
			case "monday":
				targetWeekday = time.Monday
			case "tuesday":
				targetWeekday = time.Tuesday
			case "wednesday":
				targetWeekday = time.Wednesday
			case "thursday":
				targetWeekday = time.Thursday
			case "friday":
				targetWeekday = time.Friday
			case "saturday":
				targetWeekday = time.Saturday
			}
			daysToAdd := (int(targetWeekday) - int(now.Weekday()) + 7) % 7
			if daysToAdd == 0 {
				daysToAdd = 7 // Next week's occurrence
			}
			target := now.AddDate(0, 0, daysToAdd)
			start = time.Date(target.Year(), target.Month(), target.Day(), 0, 0, 0, 0, now.Location())
			until = time.Date(target.Year(), target.Month(), target.Day(), 23, 59, 59, 0, now.Location())
			headerText = fmt.Sprintf("%s's Schedule (%s)", strings.Title(fMode), target.Format("Mon Jan 02"))
		default: // "week" or general schedule
			if args.DaysAhead <= 0 {
				args.DaysAhead = 7
			}
			start = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
			until = start.AddDate(0, 0, args.DaysAhead).Add(23*time.Hour + 59*time.Minute)
			headerText = fmt.Sprintf("Upcoming Schedule (Today & Next %d Days, %s - %s)",
				args.DaysAhead, start.Format("Jan 02"), until.Format("Jan 02"))
		}

		var events []baikal.CalendarEvent
		if args.Calendar != "" {
			events, err = baikal.ListEvents(*cfg, args.Calendar, start, until)
		} else {
			events, err = baikal.ListAllEvents(*cfg, start, until)
		}
		if err != nil {
			return fmt.Sprintf("Failed to list events from Baïkal: %v", err), nil
		}

		if len(events) == 0 {
			return fmt.Sprintf("No events scheduled on your calendar for %s.", headerText), nil
		}

		var lines []string
		var cardTokens []string
		for _, ev := range events {
			loc := ""
			if ev.Location != "" {
				loc = fmt.Sprintf(" (at %s)", ev.Location)
			}
			calBadge := ""
			if ev.Calendar != "" {
				calBadge = fmt.Sprintf("[%s] ", ev.Calendar)
			}

			timeDesc := ""
			if ev.IsAllDay {
				timeDesc = fmt.Sprintf("All Day (%s)", ev.StartTime.Format("Mon Jan 02"))
			} else {
				timeDesc = fmt.Sprintf("%s: %s - %s", ev.StartTime.Format("Mon Jan 02"), ev.StartTime.Format("15:04"), ev.EndTime.Format("15:04"))
			}

			lines = append(lines, fmt.Sprintf("• %s%s: %s%s", calBadge, ev.Title, timeDesc, loc))

			evJSON, _ := json.Marshal(map[string]any{
				"id":         ev.ID,
				"title":      ev.Title,
				"start_time": ev.StartTime.Format(time.RFC3339),
				"end_time":   ev.EndTime.Format(time.RFC3339),
				"is_all_day": ev.IsAllDay,
				"location":   ev.Location,
				"calendar":   ev.Calendar,
				"rrule":      ev.RRule,
			})
			cardTokens = append(cardTokens, fmt.Sprintf("[EVENT_CARD: %s]", string(evJSON)))
		}

		return fmt.Sprintf("%s (%d events):\n\n%s", headerText, len(events), strings.Join(cardTokens, "\n")), nil

	case "poco_calendar_delete_event":
		cfg, err := h.getBaikalConfig()
		if err != nil {
			return fmt.Sprintf("Baïkal is not configured: %v", err), nil
		}
		var args struct {
			EventID  string `json:"event_id"`
			Calendar string `json:"calendar"`
			Title    string `json:"title"`
		}
		if argsJSON != "" {
			_ = json.Unmarshal([]byte(argsJSON), &args)
		}
		targetID := args.EventID
		targetTitle := args.Title

		if targetID == "" && targetTitle != "" {
			found, err := baikal.FindEventByTitle(*cfg, args.Calendar, targetTitle)
			if err != nil {
				return fmt.Sprintf("Error finding event: %v", err), nil
			}
			if found == nil {
				return fmt.Sprintf("Could not find any calendar event matching '%s' to delete.", targetTitle), nil
			}
			targetID = found.ID
			targetTitle = found.Title
		}

		if targetID == "" {
			return "Please specify the event ID or title to delete.", nil
		}

		if err := baikal.DeleteEvent(*cfg, args.Calendar, targetID); err != nil {
			return fmt.Sprintf("Failed to delete event '%s': %v", targetTitle, err), nil
		}
		return fmt.Sprintf("Successfully deleted calendar event '%s' from Baïkal.", targetTitle), nil

	case "poco_calendar_create_event":
		cfg, err := h.getBaikalConfig()
		if err != nil {
			return fmt.Sprintf("Baïkal is not configured: %v", err), nil
		}
		var args struct {
			Title       string `json:"title"`
			StartTime   string `json:"start_time"`
			EndTime     string `json:"end_time"`
			Calendar    string `json:"calendar"`
			Location    string `json:"location"`
			Description string `json:"description"`
			IsAllDay    bool   `json:"is_all_day"`
			RRule       string `json:"rrule"`
		}
		if err := json.Unmarshal([]byte(argsJSON), &args); err != nil || args.Title == "" {
			return "Missing event title", nil
		}
		stPtr, _ := parseFlexibleDate(args.StartTime)
		var st time.Time
		if stPtr != nil {
			st = *stPtr
		} else {
			st = time.Now().Add(1 * time.Hour)
		}

		etPtr, _ := parseFlexibleDate(args.EndTime)
		var et time.Time
		if etPtr != nil {
			et = *etPtr
		} else if args.IsAllDay {
			et = st.Add(24 * time.Hour)
		} else {
			et = st.Add(1 * time.Hour)
		}

		targetCal := args.Calendar
		if targetCal == "" {
			targetCal = cfg.DefaultCalendar
			if targetCal == "" {
				targetCal = "events"
			}
		}
		ev := baikal.CalendarEvent{
			Title:       args.Title,
			StartTime:   st,
			EndTime:     et,
			Location:    args.Location,
			Description: args.Description,
			IsAllDay:    args.IsAllDay,
			RRule:       args.RRule,
			Calendar:    targetCal,
		}
		if err := baikal.CreateEvent(*cfg, targetCal, ev); err != nil {
			return fmt.Sprintf("Failed to create event in Baïkal calendar '%s': %v", targetCal, err), nil
		}
		evJSON, _ := json.Marshal(map[string]any{
			"id":         ev.ID,
			"title":      ev.Title,
			"start_time": st.Format(time.RFC3339),
			"end_time":   et.Format(time.RFC3339),
			"location":   ev.Location,
			"calendar":   targetCal,
			"is_all_day": ev.IsAllDay,
			"rrule":      ev.RRule,
		})
		timeDesc := fmt.Sprintf("%s to %s", st.Format("Mon Jan 02 15:04"), et.Format("15:04"))
		if ev.IsAllDay {
			timeDesc = fmt.Sprintf("All Day (%s)", st.Format("Mon Jan 02"))
		}
		recurDesc := ""
		if ev.RRule != "" {
			recurDesc = " (Repeats Yearly)"
		}
		return fmt.Sprintf("Successfully scheduled event '%s' in calendar '%s' [%s%s]\n\n[EVENT_CARD: %s]", args.Title, targetCal, timeDesc, recurDesc, string(evJSON)), nil

	case "poco_reminder_create":
		cfg, err := h.getBaikalConfig()
		if err != nil {
			return fmt.Sprintf("Baïkal is not configured: %v", err), nil
		}
		var args struct {
			Title       string `json:"title"`
			DueDate     string `json:"due_date"`
			Calendar    string `json:"calendar"`
			Priority    int    `json:"priority"`
			Description string `json:"description"`
		}
		if err := json.Unmarshal([]byte(argsJSON), &args); err != nil || args.Title == "" {
			return "Missing reminder title", nil
		}
		duePtr, _ := parseFlexibleDate(args.DueDate)

		cal := args.Calendar
		if cal == "" {
			cal = cfg.ReminderCalendar
			if cal == "" {
				cal = "todo"
			}
		}
		rem := baikal.CalendarReminder{
			Title:       args.Title,
			DueDate:     duePtr,
			Calendar:    cal,
			Priority:    args.Priority,
			Description: args.Description,
		}
		if err := baikal.CreateReminder(*cfg, rem); err != nil {
			return fmt.Sprintf("Failed to create reminder: %v", err), nil
		}
		dueDesc := "No specific deadline"
		dueRFC := ""
		if duePtr != nil {
			dueDesc = duePtr.Format("Mon Jan 02 15:04")
			dueRFC = duePtr.Format(time.RFC3339)
		}
		remJSON, _ := json.Marshal(map[string]any{
			"id":       rem.ID,
			"title":    rem.Title,
			"due_date": dueRFC,
			"priority": rem.Priority,
			"calendar": cal,
		})
		return fmt.Sprintf("Successfully created reminder '%s' in calendar '%s' (Due: %s)\n\n[REMINDER_CARD: %s]", args.Title, cal, dueDesc, string(remJSON)), nil

	case "poco_reminder_list":
		cfg, err := h.getBaikalConfig()
		if err != nil {
			return fmt.Sprintf("Baïkal is not configured: %v", err), nil
		}
		var args struct {
			Calendar string `json:"calendar"`
		}
		if argsJSON != "" {
			_ = json.Unmarshal([]byte(argsJSON), &args)
		}
		var reminders []baikal.CalendarReminder
		if args.Calendar != "" {
			reminders, err = baikal.ListReminders(*cfg, args.Calendar)
		} else {
			reminders, err = baikal.ListAllReminders(*cfg)
		}
		if err != nil {
			return fmt.Sprintf("Failed to check reminders from Baïkal: %v", err), nil
		}
		if len(reminders) == 0 {
			calName := args.Calendar
			if calName == "" {
				calName = cfg.ReminderCalendar
				if calName == "" {
					calName = "all calendars"
				}
			}
			return fmt.Sprintf("No active reminders or to-dos found in %s.", calName), nil
		}
		var lines []string
		var cardTokens []string
		for _, rem := range reminders {
			statusPill := "⏳"
			if rem.Completed {
				statusPill = "✅"
			}
			dueDesc := "No deadline"
			dueRFC := ""
			if rem.DueDate != nil {
				dueDesc = fmt.Sprintf("Due: %s", rem.DueDate.Format("Mon Jan 02 15:04"))
				dueRFC = rem.DueDate.Format(time.RFC3339)
			}
			lines = append(lines, fmt.Sprintf("%s %s (%s)", statusPill, rem.Title, dueDesc))
			remJSON, _ := json.Marshal(map[string]any{
				"id":        rem.ID,
				"title":     rem.Title,
				"due_date":  dueRFC,
				"priority":  rem.Priority,
				"completed": rem.Completed,
				"calendar":  rem.Calendar,
			})
			cardTokens = append(cardTokens, fmt.Sprintf("[REMINDER_CARD: %s]", string(remJSON)))
		}
		return fmt.Sprintf("Active Reminders (%d):\n\n%s", len(lines), strings.Join(cardTokens, "\n")), nil

	case "poco_contacts_search":
		cfg, err := h.getBaikalConfig()
		if err != nil {
			return fmt.Sprintf("Baïkal is not configured: %v", err), nil
		}
		var args struct {
			Query string `json:"query"`
		}
		if err := json.Unmarshal([]byte(argsJSON), &args); err != nil || args.Query == "" {
			return "Missing search query", nil
		}
		contacts, err := baikal.ListContacts(*cfg)
		if err != nil {
			return fmt.Sprintf("Failed to fetch contacts from Baïkal: %v", err), nil
		}
		q := strings.ToLower(args.Query)
		var matches []baikal.ContactItem
		for _, c := range contacts {
			if strings.Contains(strings.ToLower(c.FullName), q) || strings.Contains(strings.ToLower(c.Organization), q) {
				matches = append(matches, c)
				continue
			}
			for _, p := range c.PhoneNumbers {
				if strings.Contains(p, q) {
					matches = append(matches, c)
					break
				}
			}
		}
		if len(matches) == 0 {
			return fmt.Sprintf("No contacts matching '%s' found in Baïkal address book.", args.Query), nil
		}
		var lines []string
		for _, c := range matches {
			phones := strings.Join(c.PhoneNumbers, ", ")
			if phones == "" {
				phones = "No phone"
			}
			lines = append(lines, fmt.Sprintf("• %s | Phone: %s | Org: %s", c.FullName, phones, c.Organization))
		}
		return fmt.Sprintf("Found %d Contact(s):\n%s", len(lines), strings.Join(lines, "\n")), nil

	case "poco_immich_search_photos":
		cfg, err := h.getImmichConfig()
		if err != nil {
			return fmt.Sprintf("Immich Photos is not configured: %v", err), nil
		}
		var args struct {
			Query      string `json:"query"`
			Year       int    `json:"year"`
			Month      int    `json:"month"`
			Day        int    `json:"day"`
			Date       string `json:"date"`
			Location   string `json:"location"`
			IsFavorite *bool  `json:"is_favorite"`
			Limit      int    `json:"limit"`
		}
		if argsJSON != "" {
			_ = json.Unmarshal([]byte(argsJSON), &args)
		}
		filter := immich.SearchPhotoFilter{
			Query:      args.Query,
			Year:       args.Year,
			Month:      args.Month,
			Day:        args.Day,
			Date:       args.Date,
			Location:   args.Location,
			IsFavorite: args.IsFavorite,
			Limit:      args.Limit,
		}
		assets, err := immich.SearchPhotos(*cfg, filter)
		if err != nil {
			return fmt.Sprintf("Failed to search photos in Immich: %v", err), nil
		}
		monthNames := []string{"", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"}
		monthStr := ""
		if args.Month >= 1 && args.Month <= 12 {
			monthStr = monthNames[args.Month]
		}

		if len(assets) == 0 {
			desc := "matching your criteria"
			if args.Query != "" && args.Year > 0 {
				if monthStr != "" {
					desc = fmt.Sprintf("of '%s' from %s %d", args.Query, monthStr, args.Year)
				} else {
					desc = fmt.Sprintf("of '%s' from %d", args.Query, args.Year)
				}
			} else if args.Query != "" {
				desc = fmt.Sprintf("matching '%s'", args.Query)
			} else if monthStr != "" && args.Year > 0 {
				if args.Day > 0 {
					desc = fmt.Sprintf("from %s %d, %d", monthStr, args.Day, args.Year)
				} else {
					desc = fmt.Sprintf("from %s %d", monthStr, args.Year)
				}
			} else if args.Date != "" {
				desc = fmt.Sprintf("from %s", args.Date)
			} else if args.Year > 0 {
				desc = fmt.Sprintf("from %d", args.Year)
			} else if args.Location != "" {
				desc = fmt.Sprintf("in %s", args.Location)
			}
			return fmt.Sprintf("I couldn't find any photos in your Immich Gallery %s.", desc), nil
		}

		type photoCardItem struct {
			ID           string `json:"id"`
			ThumbnailURL string `json:"thumbnail_url"`
			PreviewURL   string `json:"preview_url"`
			FileName     string `json:"file_name"`
			TakenAt      string `json:"taken_at"`
			City         string `json:"city,omitempty"`
			Country      string `json:"country,omitempty"`
			Type         string `json:"type"`
			IsFavorite   bool   `json:"is_favorite"`
		}
		var photoCards []photoCardItem
		for _, a := range assets {
			tStr := ""
			if !a.TakenAt.IsZero() {
				tStr = a.TakenAt.Format("Jan 02, 2006")
			}
			photoCards = append(photoCards, photoCardItem{
				ID:           a.ID,
				ThumbnailURL: fmt.Sprintf("/api/v1/kuro/integrations/immich/asset/%s/thumbnail?size=thumbnail", a.ID),
				PreviewURL:   fmt.Sprintf("/api/v1/kuro/integrations/immich/asset/%s/thumbnail?size=preview", a.ID),
				FileName:     a.OriginalFileName,
				TakenAt:      tStr,
				City:         a.City,
				Country:      a.Country,
				Type:         a.Type,
				IsFavorite:   a.IsFavorite,
			})
		}

		queryDesc := "your search"
		qLower := strings.ToLower(strings.TrimSpace(args.Query))
		isRecent := (qLower == "" || qLower == "recent" || qLower == "latest" || qLower == "last" ||
			qLower == "newest" || qLower == "gallery" || qLower == "photos" || qLower == "my gallery" ||
			qLower == "my photos" || qLower == "recent photos" || qLower == "latest photos") &&
			args.Year == 0 && args.Month == 0 && args.Date == "" && args.Location == ""

		if !isRecent && args.Query != "" {
			if monthStr != "" && args.Year > 0 {
				queryDesc = fmt.Sprintf("%s from %s %d", args.Query, monthStr, args.Year)
			} else if args.Year > 0 {
				queryDesc = fmt.Sprintf("%s from %d", args.Query, args.Year)
			} else {
				queryDesc = args.Query
			}
		} else if monthStr != "" && args.Year > 0 {
			if args.Day > 0 {
				queryDesc = fmt.Sprintf("%s %d, %d", monthStr, args.Day, args.Year)
			} else {
				queryDesc = fmt.Sprintf("%s %d", monthStr, args.Year)
			}
		} else if args.Location != "" {
			queryDesc = args.Location
		} else if args.Year > 0 {
			queryDesc = fmt.Sprintf("%d", args.Year)
		} else if args.Date != "" {
			queryDesc = args.Date
		} else {
			queryDesc = "recent"
		}

		var summaryText string
		var title string
		layout := "carousel"
		if len(photoCards) == 1 {
			layout = "single"
		}

		if isRecent {
			if len(photoCards) == 1 {
				summaryText = "Here is your latest photo from your Immich Gallery."
			} else {
				summaryText = fmt.Sprintf("Here are your latest %d photos from your Immich Gallery.", len(photoCards))
			}
			title = fmt.Sprintf("Latest Photos (%d)", len(photoCards))
		} else {
			if len(photoCards) == 1 {
				summaryText = fmt.Sprintf("Here is 1 photo from %s in your Immich Gallery.", queryDesc)
			} else {
				summaryText = fmt.Sprintf("Here are %d photos from %s in your Immich Gallery.", len(photoCards), queryDesc)
			}
			title = fmt.Sprintf("Photos from %s (%d)", queryDesc, len(photoCards))
		}

		gridJSON, _ := json.Marshal(map[string]any{
			"title":        title,
			"count":        len(photoCards),
			"search_query": queryDesc,
			"immich_url":   cfg.URL,
			"layout":       layout,
			"photos":       photoCards,
		})

		return fmt.Sprintf("%s\n\n[PHOTO_GRID: %s]", summaryText, string(gridJSON)), nil

	case "poco_immich_search_albums":
		cfg, err := h.getImmichConfig()
		if err != nil {
			return fmt.Sprintf("Immich Photos is not configured: %v", err), nil
		}
		var args struct {
			Query string `json:"query"`
		}
		if argsJSON != "" {
			_ = json.Unmarshal([]byte(argsJSON), &args)
		}
		albums, err := immich.SearchAlbums(*cfg, args.Query)
		if err != nil {
			return fmt.Sprintf("Failed to search albums in Immich: %v", err), nil
		}
		if len(albums) == 0 {
			return fmt.Sprintf("No albums matching '%s' found in Immich.", args.Query), nil
		}

		type albumCardItem struct {
			ID           string `json:"id"`
			Name         string `json:"name"`
			Description  string `json:"description,omitempty"`
			AssetCount   int    `json:"asset_count"`
			ThumbnailURL string `json:"thumbnail_url,omitempty"`
		}
		var albumCards []albumCardItem
		for _, alb := range albums {
			thumbURL := ""
			if alb.AlbumThumbnailAssetID != "" {
				thumbURL = fmt.Sprintf("/api/v1/kuro/integrations/immich/asset/%s/thumbnail?size=preview", alb.AlbumThumbnailAssetID)
			}
			albumCards = append(albumCards, albumCardItem{
				ID:           alb.ID,
				Name:         alb.AlbumName,
				Description:  alb.Description,
				AssetCount:   alb.AssetCount,
				ThumbnailURL: thumbURL,
			})
		}

		albumsJSON, _ := json.Marshal(map[string]any{
			"count":  len(albumCards),
			"albums": albumCards,
		})

		return fmt.Sprintf("Found %d Album(s) in Immich:\n\n[ALBUM_LIST: %s]", len(albumCards), string(albumsJSON)), nil

	case "poco_immich_search_people":
		cfg, err := h.getImmichConfig()
		if err != nil {
			return fmt.Sprintf("Immich Photos is not configured: %v", err), nil
		}
		var args struct {
			Name       string `json:"name"`
			WithPhotos bool   `json:"with_photos"`
			Limit      int    `json:"limit"`
		}
		if argsJSON != "" {
			_ = json.Unmarshal([]byte(argsJSON), &args)
		}
		if args.Name == "" {
			return "Missing person name", nil
		}
		people, err := immich.SearchPeople(*cfg, args.Name)
		if err != nil {
			return fmt.Sprintf("Failed to search people in Immich: %v", err), nil
		}
		if len(people) == 0 {
			return fmt.Sprintf("No recognized person matching '%s' found in Immich.", args.Name), nil
		}

		person := people[0]
		var photoCards []map[string]any
		if args.WithPhotos || args.Limit > 0 {
			limit := args.Limit
			if limit <= 0 {
				limit = 8
			}
			assets, _ := immich.GetPersonAssets(*cfg, person.ID, limit)
			for _, a := range assets {
				tStr := ""
				if !a.TakenAt.IsZero() {
					tStr = a.TakenAt.Format("Jan 02, 2006")
				}
				photoCards = append(photoCards, map[string]any{
					"id":            a.ID,
					"thumbnail_url": fmt.Sprintf("/api/v1/kuro/integrations/immich/asset/%s/thumbnail?size=thumbnail", a.ID),
					"file_name":     a.OriginalFileName,
					"taken_at":      tStr,
					"city":          a.City,
					"country":       a.Country,
					"type":          a.Type,
					"is_favorite":   a.IsFavorite,
				})
			}
		}

		gridJSON, _ := json.Marshal(map[string]any{
			"title":        fmt.Sprintf("Photos of %s", person.Name),
			"person":       person.Name,
			"count":        len(photoCards),
			"search_query": person.Name,
			"immich_url":   cfg.URL,
			"photos":       photoCards,
		})

		return fmt.Sprintf("You have %d photos of %s in your Immich Gallery.\n\n[PHOTO_GRID: %s]", len(photoCards), person.Name, string(gridJSON)), nil



	case "poco_papra_search":
		cfg, err := h.getPapraConfig()
		if err != nil {
			return fmt.Sprintf("Papra Document Management is not reachable: %v", err), nil
		}
		client := papra.NewClient(*cfg)

		var args struct {
			Query    string `json:"query"`
			Category string `json:"category"`
			Tag      string `json:"tag"`
			Limit    int    `json:"limit"`
		}
		if argsJSON != "" {
			_ = json.Unmarshal([]byte(argsJSON), &args)
		}
		if args.Limit <= 0 {
			args.Limit = 10
		}

		docs, err := client.SearchDocuments(ctx, papra.SearchDocumentsFilter{
			Query:    args.Query,
			Category: args.Category,
			Tag:      args.Tag,
			Limit:    args.Limit,
		})
		if err != nil {
			return fmt.Sprintf("Error searching Papra documents: %v", err), nil
		}
		if len(docs) == 0 {
			return fmt.Sprintf("No documents or receipts matching %q found in Papra.", args.Query), nil
		}

		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("Found **%d** matching document(s) in Papra:\n\n", len(docs)))
		for i, d := range docs {
			sb.WriteString(fmt.Sprintf("%d. **%s** (`%s`) — Category: *%s*\n", i+1, d.Title, d.FileName, d.Category))
			if d.Description != "" {
				sb.WriteString(fmt.Sprintf("   - %s\n", d.Description))
			}
			if len(d.Tags) > 0 {
				sb.WriteString(fmt.Sprintf("   - Tags: %s\n", strings.Join(d.Tags, ", ")))
			}
		}
		docsJSON, _ := json.Marshal(docs)
		sb.WriteString(fmt.Sprintf("\n[DOCUMENT_CARD: %s]", string(docsJSON)))
		return sb.String(), nil

	case "poco_personal_search_all":
		var args struct {
			Query string `json:"query"`
			Limit int    `json:"limit"`
		}
		if argsJSON != "" {
			_ = json.Unmarshal([]byte(argsJSON), &args)
		}
		if args.Limit <= 0 {
			args.Limit = 5
		}
		q := strings.TrimSpace(args.Query)
		if q == "" {
			return "Please provide a search term for personal federated search.", nil
		}

		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("🔍 **Sovereign Homelab Personal Search for %q**\n\n", q))
		var anyFound bool

		// 1. Papra Documents Search
		if papraCfg, err := h.getPapraConfig(); err == nil {
			pc := papra.NewClient(*papraCfg)
			if docs, err := pc.SearchDocuments(ctx, papra.SearchDocumentsFilter{Query: q, Limit: args.Limit}); err == nil && len(docs) > 0 {
				anyFound = true
				sb.WriteString(fmt.Sprintf("📄 **Papra Documents & Receipts (%d):**\n", len(docs)))
				for _, d := range docs {
					sb.WriteString(fmt.Sprintf("- **%s** (`%s`) — Category: *%s*\n", d.Title, d.FileName, d.Category))
				}
				sb.WriteString("\n")
			}
		}

		// 2. Baïkal Calendar Events Search
		if baikalCfg, err := h.getBaikalConfig(); err == nil {
			if events, err := baikal.ListAllEvents(*baikalCfg, time.Now().AddDate(-1, 0, 0), time.Now().AddDate(1, 0, 0)); err == nil {
				var matchingEvents []baikal.CalendarEvent
				for _, ev := range events {
					if strings.Contains(strings.ToLower(ev.Title), strings.ToLower(q)) || strings.Contains(strings.ToLower(ev.Description), strings.ToLower(q)) {
						matchingEvents = append(matchingEvents, ev)
						if len(matchingEvents) >= args.Limit {
							break
						}
					}
				}
				if len(matchingEvents) > 0 {
					anyFound = true
					sb.WriteString(fmt.Sprintf("📅 **Baïkal Calendar Events (%d):**\n", len(matchingEvents)))
					for _, ev := range matchingEvents {
						sb.WriteString(fmt.Sprintf("- **%s** — %s\n", ev.Title, ev.StartTime.Format("Mon Jan 02 15:04")))
					}
					sb.WriteString("\n")
				}
			}
		}

		// 3. Immich Photos Search
		if immichCfg, err := h.getImmichConfig(); err == nil {
			if assets, err := immich.SearchPhotos(*immichCfg, immich.SearchPhotoFilter{Query: q, Limit: args.Limit}); err == nil && len(assets) > 0 {
				anyFound = true
				limit := args.Limit
				if len(assets) < limit {
					limit = len(assets)
				}
				sb.WriteString(fmt.Sprintf("📷 **Immich Photos (%d):**\n", limit))
				for i := 0; i < limit; i++ {
					sb.WriteString(fmt.Sprintf("- Photo `%s` (%s)\n", assets[i].ID, assets[i].TakenAt.Format("2006-01-02 15:04")))
				}
				sb.WriteString("\n")
			}
		}

		if !anyFound {
			return fmt.Sprintf("No personal items found matching %q across Papra Documents, Calendar, or Photos.", q), nil
		}

		return strings.TrimSpace(sb.String()), nil
	}

	return "", fmt.Errorf("unknown poco tool: %s", name)
}

func parseFlexibleDate(raw string) (*time.Time, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}

	layouts := []string{
		time.RFC3339,
		"2006-01-02T15:04:05Z07:00",
		"2006-01-02T15:04:05",
		"2006-01-02T15:04",
		"2006-01-02 15:04:05",
		"2006-01-02 15:04",
		"2006-01-02",
		"2006/01/02 15:04:05",
		"2006/01/02 15:04",
		"2006/01/02",
		"02-01-2006 15:04",
		"02/01/2006 15:04",
	}

	for _, layout := range layouts {
		if t, err := time.Parse(layout, raw); err == nil {
			return &t, nil
		}
		if t, err := time.ParseInLocation(layout, raw, time.Local); err == nil {
			return &t, nil
		}
	}

	return nil, fmt.Errorf("unrecognized date format: %q", raw)
}

func (h *PocoToolHandler) getBaikalConfig() (*baikal.BaikalConfig, error) {
	var cfg baikal.BaikalConfig
	var found bool

	if h.db != nil {
		if cfgJSON, enabled, err := h.db.GetIntegration("baikal"); err == nil && enabled && cfgJSON != "" && cfgJSON != "{}" {
			if err := json.Unmarshal([]byte(cfgJSON), &cfg); err == nil && cfg.URL != "" {
				found = true
			}
		}
	}

	if !found && h.js != nil {
		if savedMap, enabled := h.js.GetIntegration("baikal"); enabled && len(savedMap) > 0 {
			if mapBytes, err := json.Marshal(savedMap); err == nil {
				if err := json.Unmarshal(mapBytes, &cfg); err == nil && cfg.URL != "" {
					found = true
				}
			}
		}
	}

	if !found || cfg.URL == "" {
		return nil, fmt.Errorf("Baïkal integration is disabled or not configured")
	}

	return &cfg, nil
}

func (h *PocoToolHandler) getImmichConfig() (*immich.ImmichConfig, error) {
	var cfg immich.ImmichConfig
	var found bool

	if h.db != nil {
		if cfgJSON, enabled, err := h.db.GetIntegration("immich"); err == nil && enabled && cfgJSON != "" && cfgJSON != "{}" {
			if err := json.Unmarshal([]byte(cfgJSON), &cfg); err == nil && cfg.URL != "" {
				found = true
			}
		}
	}

	if !found && h.js != nil {
		if savedMap, enabled := h.js.GetIntegration("immich"); enabled && len(savedMap) > 0 {
			if mapBytes, err := json.Marshal(savedMap); err == nil {
				if err := json.Unmarshal(mapBytes, &cfg); err == nil && cfg.URL != "" {
					found = true
				}
			}
		}
	}

	if !found || cfg.URL == "" {
		return nil, fmt.Errorf("Immich integration is disabled or not configured")
	}

	return &cfg, nil
}



func (h *PocoToolHandler) getPapraConfig() (*papra.PapraConfig, error) {
	var cfg papra.PapraConfig
	var found bool

	if h.db != nil {
		if cfgJSON, enabled, err := h.db.GetIntegration("papra"); err == nil && enabled && cfgJSON != "" && cfgJSON != "{}" {
			if err := json.Unmarshal([]byte(cfgJSON), &cfg); err == nil && cfg.URL != "" {
				found = true
			}
		}
	}

	if !found && h.js != nil {
		if savedMap, enabled := h.js.GetIntegration("papra"); enabled && len(savedMap) > 0 {
			if mapBytes, err := json.Marshal(savedMap); err == nil {
				if err := json.Unmarshal(mapBytes, &cfg); err == nil && cfg.URL != "" {
					found = true
				}
			}
		}
	}

	if !found || cfg.URL == "" {
		cfg.URL = "http://127.0.0.1:3005"
	}

	return &cfg, nil
}

func formatDateTime(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return time.Now().Format("2006-01-02 03:04 PM")
	}

	// 1. Try unix timestamp in milliseconds
	if ms, err := strconv.ParseInt(raw, 10, 64); err == nil && ms > 100000000000 {
		t := time.UnixMilli(ms)
		return t.Format("2006-01-02 03:04 PM")
	}
	// 2. Try unix timestamp in seconds
	if s, err := strconv.ParseInt(raw, 10, 64); err == nil && s > 1000000000 {
		t := time.Unix(s, 0)
		return t.Format("2006-01-02 03:04 PM")
	}
	// 3. Try standard datetime string formats
	formats := []string{
		time.RFC3339,
		time.RFC3339Nano,
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
		"2006-01-02 15:04",
		"2006-01-02 03:04 PM",
		"2006-01-02 03:04:05 PM",
		"02-01-2006 15:04:05",
		"02/01/2006 15:04:05",
	}
	for _, f := range formats {
		if t, err := time.Parse(f, raw); err == nil {
			return t.Format("2006-01-02 03:04 PM")
		}
		if t, err := time.ParseInLocation(f, raw, time.Local); err == nil {
			return t.Format("2006-01-02 03:04 PM")
		}
	}
	return raw
}

func formatDuration(sec int) string {
	if sec <= 0 {
		return "0s"
	}
	if sec < 60 {
		return fmt.Sprintf("%ds", sec)
	}
	m := sec / 60
	s := sec % 60
	if s == 0 {
		return fmt.Sprintf("%dm", m)
	}
	return fmt.Sprintf("%dm %ds", m, s)
}

func (h *PocoToolHandler) isNodeAuthorized(nodeID, username, role string) bool {
	if role == "admin" {
		return true
	}
	if username == "" {
		return false
	}
	if h.nm != nil && h.nm.IsNodeOwnedBy(nodeID, username, role) {
		return true
	}
	if h.db != nil {
		if node, err := h.db.GetNode(nodeID); err == nil && node != nil {
			if strings.EqualFold(node.Username, username) {
				return true
			}
		}
	}
	return false
}
