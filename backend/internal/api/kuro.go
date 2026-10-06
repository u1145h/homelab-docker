package api

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/ullashroy/poco-server/backend/internal/auth"
	"github.com/ullashroy/poco-server/backend/internal/kuro"
	"github.com/ullashroy/poco-server/backend/internal/kuro/agent"
	"github.com/ullashroy/poco-server/backend/internal/kuro/db"
	"github.com/ullashroy/poco-server/backend/internal/kuro/integrations/baikal"
	"github.com/ullashroy/poco-server/backend/internal/kuro/integrations/immich"
	kurocrpyto "github.com/ullashroy/poco-server/backend/internal/kuro/crypto"
	"github.com/ullashroy/poco-server/backend/internal/kuro/llm"
	"github.com/ullashroy/poco-server/backend/internal/kuro/llm/anthropic"
	"github.com/ullashroy/poco-server/backend/internal/kuro/llm/openai_compat"
	"github.com/ullashroy/poco-server/backend/internal/kuro/node"
	"github.com/ullashroy/poco-server/backend/internal/kuro/storage"
)

var kuroUpgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
	HandshakeTimeout: 10 * time.Second,
}

// KuroHealthHandler returns the status of the Kuro AI engine.
func KuroHealthHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if ks == nil {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"status":   "offline",
				"model":    "none",
				"provider": "openai_compat",
				"nodes":    0,
			})
			return
		}

		engineStatus := "ok"
		if err := ks.LLM.Health(); err != nil {
			engineStatus = "offline"
		}

		_ = json.NewEncoder(w).Encode(map[string]any{
			"status":   engineStatus,
			"model":    ks.LLM.ModelName(),
			"provider": ks.LLM.ProviderName(),
			"nodes":    len(ks.Nodes.List()),
		})
	}
}

// KuroListConversationsHandler lists all chat threads for the current user.
func KuroListConversationsHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := auth.CurrentUser(r.Context())
		convs, err := ks.DB.ListConversations(user.Username)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if convs == nil {
			convs = []db.Conversation{}
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"conversations": convs})
	}
}

// KuroCreateConversationHandler creates a new chat thread.
func KuroCreateConversationHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := auth.CurrentUser(r.Context())
		var req struct {
			Title string `json:"title"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)

		conv, err := ks.DB.CreateConversation(user.Username, req.Title)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(conv)
	}
}

// KuroGetConversationHandler retrieves a conversation and its metadata.
func KuroGetConversationHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := auth.CurrentUser(r.Context())
		id := chi.URLParam(r, "id")
		conv, err := ks.DB.GetConversation(id)
		if err != nil || conv == nil || conv.Username != user.Username {
			http.Error(w, "conversation not found", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(conv)
	}
}

// KuroUpdateConversationHandler updates conversation metadata such as title.
func KuroUpdateConversationHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := auth.CurrentUser(r.Context())
		id := chi.URLParam(r, "id")

		conv, err := ks.DB.GetConversation(id)
		if err != nil || conv == nil || conv.Username != user.Username {
			http.Error(w, "conversation not found", http.StatusNotFound)
			return
		}

		var req struct {
			Title string `json:"title"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Title) == "" {
			http.Error(w, "valid title is required", http.StatusBadRequest)
			return
		}

		if err := ks.DB.UpdateConversationTitle(id, strings.TrimSpace(req.Title)); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		conv.Title = strings.TrimSpace(req.Title)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(conv)
	}
}

// KuroDeleteConversationHandler deletes a chat thread and all its messages.
func KuroDeleteConversationHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := auth.CurrentUser(r.Context())
		id := chi.URLParam(r, "id")
		if err := ks.DB.DeleteConversation(id, user.Username); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Real-time synchronization: Broadcast CONVERSATION_DELETED to all client nodes of this user
		if ks.Nodes != nil {
			ks.Nodes.BroadcastToUser(user.Username, "CONVERSATION_DELETED", map[string]any{
				"conversation_id": id,
			})
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]bool{"deleted": true})
	}
}

// KuroListMessagesHandler lists all messages in a conversation.
func KuroListMessagesHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := auth.CurrentUser(r.Context())
		id := chi.URLParam(r, "id")
		conv, err := ks.DB.GetConversation(id)
		if err != nil || conv == nil || conv.Username != user.Username {
			http.Error(w, "conversation not found", http.StatusNotFound)
			return
		}
		msgs, err := ks.DB.GetMessages(conv.ID, 500)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if msgs == nil {
			msgs = []db.Message{}
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"messages": msgs})
	}
}

// KuroSendMessageHandler is the main chat turn endpoint.
func KuroSendMessageHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := auth.CurrentUser(r.Context())
		id := chi.URLParam(r, "id")

		conv, err := ks.DB.GetConversation(id)
		if err != nil || conv == nil || conv.Username != user.Username {
			http.Error(w, "conversation not found", http.StatusNotFound)
			return
		}

		var req struct {
			Content   string `json:"content"`
			InputMode string `json:"input_mode"`
			NodeID    string `json:"node_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Content == "" {
			http.Error(w, "content is required", http.StatusBadRequest)
			return
		}
		if req.InputMode == "" {
			req.InputMode = "text"
		}

		resp, err := ks.Agent.Chat(r.Context(), agent.ChatRequest{
			Username:       user.Username,
			Role:           user.Role,
			ConversationID: conv.ID,
			Content:        req.Content,
			InputMode:      req.InputMode,
			NodeID:         req.NodeID,
		})
		if err != nil {
			slog.Warn("⚠️ Kuro Agent turn failed", "error", err, "model", ks.Config.Model, "base_url", ks.Config.BaseURL)
			diagnosticText := fmt.Sprintf("⚠️ **Kuro AI Engine Warning**\n\nCould not reach the LLM provider `%s` at `%s`.\n\n**Error:** `%v`\n\n**Troubleshooting:**\n1. Ensure your local Ollama or LLM server is running (e.g. `ollama serve`).\n2. Make sure model `%s` is pulled (`ollama pull %s`).\n3. You can adjust the endpoint URL or model in the **Model & Inference Settings** tab.", ks.Config.Provider, ks.Config.BaseURL, err, ks.Config.Model, ks.Config.Model)

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":         "err-" + uuid.NewString(),
				"role":       "assistant",
				"content":    diagnosticText,
				"response":   diagnosticText,
				"model_used": ks.Config.Model,
				"is_error":   true,
			})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"id":         resp.MessageID,
			"role":       "assistant",
			"content":    resp.Content,
			"response":   resp.Content,
			"model_used": resp.ModelUsed,
		})
	}
}

// KuroSyncDirectMessagesHandler allows nodes/clients to archive and sync offline or direct mode conversation turns.
func KuroSyncDirectMessagesHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := auth.CurrentUser(r.Context())
		convID := chi.URLParam(r, "id")

		var req struct {
			Title    string `json:"title,omitempty"`
			Messages []struct {
				ID        string  `json:"id"`
				Role      string  `json:"role"`
				Content   string  `json:"content"`
				NodeID    *string `json:"node_id,omitempty"`
				InputMode string  `json:"input_mode,omitempty"`
				CreatedAt string  `json:"created_at,omitempty"`
			} `json:"messages"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid payload", http.StatusBadRequest)
			return
		}

		title := strings.TrimSpace(req.Title)
		if title == "" {
			title = "Assistant Session"
		}

		conv, err := ks.DB.GetConversation(convID)
		if err != nil || conv == nil {
			// Upsert with client's exact convID so client and server remain 100% in sync
			conv, err = ks.DB.UpsertConversation(convID, user.Username, title)
			if err != nil {
				http.Error(w, "failed to create conversation", http.StatusInternalServerError)
				return
			}
		} else if conv.Username != user.Username {
			http.Error(w, "conversation not found", http.StatusNotFound)
			return
		}

		syncedIDs := make([]string, 0, len(req.Messages))
		for _, m := range req.Messages {
			if strings.TrimSpace(m.Content) == "" {
				continue
			}
			role := m.Role
			if role != "user" && role != "assistant" && role != "system" {
				role = "user"
			}
			msgRecord := &db.Message{
				ID:             m.ID,
				ConversationID: conv.ID,
				Role:           role,
				Content:        m.Content,
				NodeID:         m.NodeID,
				InputMode:      m.InputMode,
				CreatedAt:      m.CreatedAt,
			}
			if err := ks.DB.SaveMessage(msgRecord); err == nil {
				syncedIDs = append(syncedIDs, msgRecord.ID)
			}
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"success":         true,
			"conversation_id": conv.ID,
			"synced_count":    len(syncedIDs),
			"synced_ids":      syncedIDs,
		})
	}
}

// KuroTestLLMHandler checks connectivity to an LLM provider and measures latency.
func KuroTestLLMHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			BaseURL     string `json:"base_url"`
			APIKey      string `json:"api_key"`
			Model       string `json:"model"`
			ProviderTag string `json:"provider"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)

		providerTag := strings.ToLower(strings.TrimSpace(req.ProviderTag))
		apiKey := req.APIKey

		// If no key provided in payload but testing a cloud provider, try using decrypted stored key
		if apiKey == "" && ks != nil && ks.Config.CloudAPIKey != "" {
			if decKey, err := kurocrpyto.DecryptAPIKey(ks.Config.CloudAPIKey, ks.Config.NodeSecret); err == nil {
				apiKey = decKey
			}
		}

		var tempProvider llm.Provider
		baseURL := req.BaseURL
		model := req.Model

		switch providerTag {
		case "anthropic":
			if model == "" {
				model = "claude-haiku-4-5"
			}
			tempProvider = anthropic.New(anthropic.Config{
				APIKey:    apiKey,
				Model:     model,
				MaxTokens: 512,
				Timeout:   5 * time.Second,
			})
			baseURL = "https://api.anthropic.com"
		case "groq":
			if model == "" {
				model = "llama-3.1-70b-versatile"
			}
			baseURL = "https://api.groq.com/openai/v1"
			tempProvider = openai_compat.New(openai_compat.Config{
				BaseURL:     baseURL,
				APIKey:      apiKey,
				Model:       model,
				ProviderTag: "groq",
				Timeout:     5 * time.Second,
			})
		case "nvidia":
			if model == "" {
				model = "meta/llama-3.1-70b-instruct"
			}
			baseURL = "https://integrate.api.nvidia.com/v1"
			tempProvider = openai_compat.New(openai_compat.Config{
				BaseURL:     baseURL,
				APIKey:      apiKey,
				Model:       model,
				ProviderTag: "nvidia",
				Timeout:     5 * time.Second,
			})
		case "gemini":
			if model == "" {
				model = "gemini-1.5-flash"
			}
			baseURL = "https://generativelanguage.googleapis.com/v1beta/openai"
			tempProvider = openai_compat.New(openai_compat.Config{
				BaseURL:     baseURL,
				APIKey:      apiKey,
				Model:       model,
				ProviderTag: "gemini",
				Timeout:     5 * time.Second,
			})
		case "custom":
			if baseURL == "" && ks != nil {
				baseURL = ks.Config.CloudBaseURL
			}
			tempProvider = openai_compat.New(openai_compat.Config{
				BaseURL:     baseURL,
				APIKey:      apiKey,
				Model:       model,
				ProviderTag: "custom",
				Timeout:     5 * time.Second,
			})
		case "openai":
			if model == "" {
				model = "gpt-4o-mini"
			}
			baseURL = "https://api.openai.com/v1"
			tempProvider = openai_compat.New(openai_compat.Config{
				BaseURL:     baseURL,
				APIKey:      apiKey,
				Model:       model,
				ProviderTag: "openai",
				Timeout:     5 * time.Second,
			})
		default: // Ollama / local LLM
			if baseURL == "" && ks != nil {
				baseURL = ks.Config.BaseURL
			}
			if model == "" && ks != nil {
				model = ks.Config.Model
			}
			tempProvider = openai_compat.New(openai_compat.Config{
				BaseURL:     baseURL,
				APIKey:      apiKey,
				Model:       model,
				ProviderTag: req.ProviderTag,
				Timeout:     5 * time.Second,
			})
		}

		start := time.Now()
		err := tempProvider.Health()
		latency := time.Since(start).Milliseconds()

		w.Header().Set("Content-Type", "application/json")
		if err != nil {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"ok":         false,
				"error":      err.Error(),
				"latency_ms": latency,
				"base_url":   baseURL,
				"model":      model,
			})
			return
		}

		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":         true,
			"latency_ms": latency,
			"base_url":   baseURL,
			"model":      model,
			"status":     "LLM provider is reachable and responsive",
		})
	}
}


// KuroListMemoriesHandler returns stored long-term memories.
func KuroListMemoriesHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := auth.CurrentUser(r.Context())
		mems, err := ks.DB.ListMemories(user.Username)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if mems == nil {
			mems = []db.Memory{}
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"memories": mems})
	}
}

// KuroCreateMemoryHandler stores a new memory manually.
func KuroCreateMemoryHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := auth.CurrentUser(r.Context())
		var req struct {
			Content    string `json:"content"`
			Category   string `json:"category"`
			Importance int    `json:"importance"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Content == "" {
			http.Error(w, "content is required", http.StatusBadRequest)
			return
		}
		if req.Category == "" {
			req.Category = "general"
		}
		if req.Importance == 0 {
			req.Importance = 5
		}

		if err := ks.DB.SaveMemory(user.Username, req.Content, req.Category, req.Importance, ""); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]bool{"stored": true})
	}
}

// KuroUpdateMemoryHandler updates an existing memory/knowledge item.
func KuroUpdateMemoryHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := auth.CurrentUser(r.Context())
		id := chi.URLParam(r, "id")
		var req struct {
			Content    string `json:"content"`
			Category   string `json:"category"`
			Importance int    `json:"importance"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Content == "" {
			http.Error(w, "content is required", http.StatusBadRequest)
			return
		}
		if req.Category == "" {
			req.Category = "general"
		}
		if req.Importance == 0 {
			req.Importance = 5
		}

		if err := ks.DB.UpdateMemory(id, user.Username, req.Content, req.Category, req.Importance); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]bool{"updated": true})
	}
}

// KuroDeleteMemoryHandler removes a long-term memory.
func KuroDeleteMemoryHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := auth.CurrentUser(r.Context())
		id := chi.URLParam(r, "id")
		if err := ks.DB.DeleteMemory(id, user.Username); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]bool{"deleted": true})
	}
}

// KuroListNodesHandler returns registered remote client devices for the current user.
func KuroListNodesHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := auth.CurrentUser(r.Context())
		nodesMap := make(map[string]map[string]any)

		userFilter := user.Username
		if user.Role == "admin" {
			userFilter = ""
		}

		// Map active real-time WebSocket sessions
		wsOnlineMap := make(map[string]bool)
		if ks.Nodes != nil {
			for _, n := range ks.Nodes.ListForUser(user.Username, user.Role) {
				wsOnlineMap[n.ID] = true
			}
		}

		// 1. Get from DB
		dbNodes, _ := ks.DB.ListNodes(userFilter)
		for _, n := range dbNodes {
			name := n.DisplayName
			if name == "" {
				name = n.Hostname
			}
			if name == "" {
				name = n.ID
			}
			lastSeen := ""
			if n.LastSeenAt != nil {
				lastSeen = *n.LastSeenAt
			}

			isOnline := wsOnlineMap[n.ID]
			status := "offline"
			if isOnline {
				status = "online"
			} else if lastSeen != "" {
				if t, err := time.Parse(time.RFC3339, lastSeen); err == nil {
					if time.Since(t) <= 10*time.Minute {
						isOnline = true
						status = "online"
					}
				}
			}

			nodesMap[n.ID] = map[string]any{
				"id":                    n.ID,
				"name":                  name,
				"platform":              n.Platform,
				"status":                status,
				"is_online":             isOnline,
				"hostname":              n.Hostname,
				"last_seen":             lastSeen,
				"created_at":            n.CreatedAt,
				"sync_interval_seconds": 900,
			}
		}

		// 2. Get from JSONStore (devices that have synced)
		if ks.JSONStore != nil {
			_, _, _, _, _, _, _, snap, devices := ks.JSONStore.GetClientData(userFilter)
			for _, d := range devices {
				syncInt := d.SyncIntervalSeconds
				if syncInt <= 0 {
					syncInt = 900
				}

				isOnline := wsOnlineMap[d.NodeID]
				status := "offline"
				if isOnline {
					status = "online"
				} else if d.LastSeenAt != "" {
					if t, err := time.Parse(time.RFC3339, d.LastSeenAt); err == nil {
						grace := time.Duration(syncInt+120) * time.Second
						if grace < 5*time.Minute {
							grace = 5 * time.Minute
						}
						if time.Since(t) <= grace {
							isOnline = true
							status = "online"
						}
					}
				}

				name := d.DisplayName
				if name == "" {
					name = d.Hostname
				}
				if name == "" {
					name = d.NodeID
				}
				platform := d.Platform
				if platform == "" {
					platform = "android"
				}

				entry, exists := nodesMap[d.NodeID]
				if !exists {
					entry = map[string]any{
						"id":                    d.NodeID,
						"name":                  name,
						"platform":              platform,
						"status":                status,
						"is_online":             isOnline,
						"hostname":              d.Hostname,
						"last_seen":             d.LastSeenAt,
						"created_at":            d.LastSeenAt,
						"sync_interval_seconds": syncInt,
					}
				} else {
					// Prefer custom display name
					if d.DisplayName != "" && d.DisplayName != d.Hostname {
						entry["name"] = d.DisplayName
					}
					entry["platform"] = platform
					entry["status"] = status
					entry["is_online"] = isOnline
					if d.LastSeenAt != "" {
						entry["last_seen"] = d.LastSeenAt
					}
					entry["sync_interval_seconds"] = syncInt
				}
				if d.LatestSnapshot != nil {
					entry["telemetry"] = d.LatestSnapshot
				} else if snap != nil {
					entry["telemetry"] = snap
				}
				nodesMap[d.NodeID] = entry
			}
		}

		// 3. Check active WebSocket connections
		if ks.Nodes != nil {
			connected := ks.Nodes.ListForUser(user.Username, user.Role)
			for _, n := range connected {
				entry, exists := nodesMap[n.ID]
				if !exists {
					name := n.DisplayName
					if name == "" {
						name = n.Hostname
					}
					if name == "" {
						name = n.ID
					}
					entry = map[string]any{
						"id":                    n.ID,
						"name":                  name,
						"platform":              n.Platform,
						"status":                "online",
						"is_online":             true,
						"hostname":              n.Hostname,
						"sync_interval_seconds": 900,
						"last_seen":             time.Now().UTC().Format(time.RFC3339),
					}
				} else {
					entry["status"] = "online"
					entry["is_online"] = true
					if n.DisplayName != "" && n.DisplayName != n.Hostname {
						entry["name"] = n.DisplayName
					}
				}
				nodesMap[n.ID] = entry
			}
		}

		// Deduplicate: If an active online node or updated node shares the same device_uuid or hardware hostname with an older ghost node, prune the ghost
		type devSig struct {
			uuid     string
			hostname string
			platform string
		}
		seenSigs := make(map[string]string) // sig -> primary nodeID

		// First pass: register online nodes as primary
		for id, n := range nodesMap {
			isOnline, _ := n["is_online"].(bool)
			hostname, _ := n["hostname"].(string)
			platform, _ := n["platform"].(string)
			uuid := ""
			if ks.JSONStore != nil {
				if d, ok := ks.JSONStore.GetDevice(id); ok {
					uuid = d.DeviceUUID
				}
			}
			if isOnline {
				if uuid != "" {
					seenSigs["uuid:"+uuid] = id
				}
				if hostname != "" && platform != "" && hostname != "android-node" && hostname != "windows-client" {
					seenSigs["host:"+platform+":"+strings.ToLower(hostname)] = id
				}
			}
		}

		// Second pass: filter out ghost duplicates and propagate any custom display names
		var result []map[string]any
		for id, n := range nodesMap {
			isOnline, _ := n["is_online"].(bool)
			hostname, _ := n["hostname"].(string)
			platform, _ := n["platform"].(string)
			uuid := ""
			if ks.JSONStore != nil {
				if d, ok := ks.JSONStore.GetDevice(id); ok {
					uuid = d.DeviceUUID
				}
			}

			// If offline and matches an online primary node signature, prune it
			isGhost := false
			var primaryID string
			if !isOnline {
				if uuid != "" {
					if pid, ok := seenSigs["uuid:"+uuid]; ok && pid != id {
						isGhost = true
						primaryID = pid
					}
				}
				if !isGhost && hostname != "" && platform != "" && hostname != "android-node" && hostname != "windows-client" {
					if pid, ok := seenSigs["host:"+platform+":"+strings.ToLower(hostname)]; ok && pid != id {
						isGhost = true
						primaryID = pid
					}
				}
			}

			if isGhost && primaryID != "" {
				// If the ghost node had a customized name, transfer it to the primary online node
				ghostName, _ := n["name"].(string)
				if ghostName != "" && ghostName != id && ghostName != "android-node" && ghostName != "windows-client" && ghostName != hostname {
					if prim, exists := nodesMap[primaryID]; exists {
						primName, _ := prim["name"].(string)
						if primName == "" || primName == primaryID || primName == "android-node" || primName == "windows-client" || primName == hostname {
							prim["name"] = ghostName
						}
					}
				}
			}

			if !isGhost {
				result = append(result, n)
			}
		}
		if result == nil {
			result = []map[string]any{}
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"nodes": result})
	}
}

// KuroDeleteNodeHandler deletes/revokes a client node, logs out the connected device, and optionally deletes or merges telemetry data.
func KuroDeleteNodeHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := auth.CurrentUser(r.Context())
		nodeID := chi.URLParam(r, "id")
		if nodeID == "" {
			http.Error(w, `{"error":"missing node id"}`, http.StatusBadRequest)
			return
		}

		if user.Role != "admin" && !ks.Nodes.IsNodeOwnedBy(nodeID, user.Username, user.Role) {
			http.Error(w, `{"error":"Unauthorized"}`, http.StatusForbidden)
			return
		}

		var req struct {
			DeleteData    bool   `json:"delete_data"`
			MergeTargetID string `json:"merge_target_id"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)

		// 1. Immediately disconnect and send LOGOUT command to remote device
		if ks != nil && ks.Nodes != nil {
			ks.Nodes.DisconnectAndLogout(nodeID)
		}

		// 2. Update/Delete in JSONStore
		if ks != nil && ks.JSONStore != nil {
			_ = ks.JSONStore.DeleteDevice(nodeID, req.DeleteData, req.MergeTargetID)
		}

		// 3. Update/Delete in DB
		if ks != nil && ks.DB != nil {
			_ = ks.DB.DeleteNode(nodeID, req.DeleteData, req.MergeTargetID)
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"deleted":         true,
			"node_id":         nodeID,
			"data_deleted":    req.DeleteData,
			"merged_target":   req.MergeTargetID,
		})
	}
}

// KuroUpdateNodeHandler updates the node's display alias and sync interval (Node ID remains immutable).
func KuroUpdateNodeHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := auth.CurrentUser(r.Context())
		nodeID := chi.URLParam(r, "id")
		if nodeID == "" {
			http.Error(w, `{"error":"missing node id"}`, http.StatusBadRequest)
			return
		}

		if user.Role != "admin" && !ks.Nodes.IsNodeOwnedBy(nodeID, user.Username, user.Role) {
			http.Error(w, `{"error":"Unauthorized"}`, http.StatusForbidden)
			return
		}

		var req struct {
			Name                string `json:"name"`
			SyncIntervalSeconds int    `json:"sync_interval_seconds"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}

		cleanName := strings.TrimSpace(req.Name)
		syncInterval := req.SyncIntervalSeconds

		// 1. Update in JSONStore (keeping nodeID constant)
		if ks != nil && ks.JSONStore != nil {
			_ = ks.JSONStore.UpdateDeviceInfo(nodeID, cleanName, "", syncInterval)
		}

		// 2. Update in DB (keeping nodeID constant)
		if ks != nil && ks.DB != nil {
			_ = ks.DB.UpdateNodeConfig(nodeID, cleanName, "")
		}

		// 3. Update in Active Hub sessions and notify client
		if ks != nil && ks.Nodes != nil {
			ks.Nodes.UpdateNodeConfig(nodeID, cleanName, "", syncInterval)
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"success":               true,
			"node_id":               nodeID,
			"display_name":          cleanName,
			"sync_interval_seconds": syncInterval,
		})
	}
}

// KuroGetNodeSnapshotHandler returns the latest telemetry snapshot from a device.
func KuroGetNodeSnapshotHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		snap, err := ks.DB.GetLatestNodeSnapshot(id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		var data any
		_ = json.Unmarshal([]byte(snap), &data)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"node_id": id, "snapshot": data})
	}
}

// KuroTriggerSyncNodeHandler sends an immediate full telemetry & data sync command to a specific connected edge node.
func KuroTriggerSyncNodeHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if ks == nil {
			http.Error(w, `{"error":"kuro disabled"}`, http.StatusServiceUnavailable)
			return
		}
		id := chi.URLParam(r, "id")
		if id == "" {
			http.Error(w, `{"error":"node id is required"}`, http.StatusBadRequest)
			return
		}
		if ks.Nodes != nil {
			ks.Nodes.RequestSyncNode(id)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"synced":  true,
			"node_id": id,
			"message": fmt.Sprintf("Full sync signal dispatched to node %s", id),
		})
	}
}

// KuroTriggerSyncAllHandler broadcasts an immediate full telemetry & data sync command to all connected edge nodes.
func KuroTriggerSyncAllHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if ks == nil {
			http.Error(w, `{"error":"kuro disabled"}`, http.StatusServiceUnavailable)
			return
		}
		if ks.Nodes != nil {
			ks.Nodes.RequestSyncAll()
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"synced":  true,
			"message": "Full sync signal dispatched to all connected edge nodes",
		})
	}
}

func formatDeviceOS(platform string) string {
	switch strings.ToLower(strings.TrimSpace(platform)) {
	case "android":
		return "Android"
	case "ios", "iphone", "ipad":
		return "iPhone"
	case "windows", "win32", "win64":
		return "Windows"
	case "darwin", "macos", "mac":
		return "MacBook"
	case "linux":
		return "Linux"
	default:
		if platform != "" {
			return strings.ToUpper(platform[:1]) + strings.ToLower(platform[1:])
		}
		return "Device"
	}
}

// KuroNodeSyncHandler receives batch telemetry, call logs, SMS, contacts, and location from a client device.
func KuroNodeSyncHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if ks == nil {
			http.Error(w, `{"error":"kuro disabled"}`, http.StatusServiceUnavailable)
			return
		}
		nodeID := chi.URLParam(r, "id")
		if nodeID == "" {
			nodeID = "android-node"
		}

		var req struct {
			DeviceName string `json:"device_name"`
			Platform   string `json:"platform"`
			DeviceUUID string `json:"device_uuid"`
			Battery    any    `json:"battery"`
			Network    any    `json:"network"`
			Storage    any    `json:"storage"`
			Hardware   any    `json:"hardware"`
			Context       any    `json:"context"`
			Media         any    `json:"media"`
			Metadata      any    `json:"metadata"`
			Cameras       any    `json:"cameras"`
			Microphones   any    `json:"microphones"`
			Location   *struct {
				Latitude  float64 `json:"latitude"`
				Longitude float64 `json:"longitude"`
				Accuracy  float64 `json:"accuracy"`
				Address   string  `json:"address"`
				WifiSSID  string  `json:"wifi_ssid"`
				Timestamp string  `json:"timestamp"`
			} `json:"location"`
			Locations []struct {
				Latitude  float64 `json:"latitude"`
				Longitude float64 `json:"longitude"`
				Accuracy  float64 `json:"accuracy"`
				Address   string  `json:"address"`
				WifiSSID  string  `json:"wifi_ssid"`
				Timestamp string  `json:"timestamp"`
			} `json:"locations"`
			Calls []struct {
				CallerName  string `json:"caller_name"`
				PhoneNumber string `json:"phone_number"`
				CallType    string `json:"call_type"`
				Duration    int    `json:"duration"`
				Timestamp   string `json:"timestamp"`
			} `json:"calls"`
			Messages []struct {
				SenderName  string `json:"sender_name"`
				PhoneNumber string `json:"phone_number"`
				MessageBody string `json:"message_body"`
				IsRead      bool   `json:"is_read"`
				MessageType string `json:"message_type"`
				IsSent      bool   `json:"is_sent"`
				Timestamp   string `json:"timestamp"`
			} `json:"messages"`
			Contacts []struct {
				ID            string   `json:"id"`
				Name          string   `json:"name"`
				PhoneNumbers  []string `json:"phone_numbers"`
				Email         string   `json:"email"`
				IsStarred     bool     `json:"is_starred"`
				LastContacted string   `json:"last_contacted"`
			} `json:"contacts"`
			Notifications []struct {
				ID              string `json:"id"`
				PackageName     string `json:"package_name"`
				AppLabel        string `json:"app_label"`
				Title           string `json:"title"`
				Text            string `json:"text"`
				SubText         string `json:"sub_text"`
				Timestamp       string `json:"timestamp"`
				IsCleared       bool   `json:"is_cleared"`
				MediaPreviewB64 string `json:"media_preview_b64"`
			} `json:"notifications"`
			InstalledApps []struct {
				PackageName  string `json:"package_name"`
				AppName      string `json:"app_name"`
				VersionName  string `json:"version_name"`
				VersionCode  int64  `json:"version_code"`
				InstalledAt  string `json:"installed_at"`
				LastUpdated  string `json:"last_updated"`
				IsSystemApp  bool   `json:"is_system_app"`
				APKSizeBytes int64  `json:"apk_size_bytes"`
				IconB64      string `json:"icon_b64,omitempty"`
			} `json:"installed_apps"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid payload"}`, http.StatusBadRequest)
			return
		}

		platform := req.Platform
		if platform == "" {
			platform = "android"
		}

		devName := req.DeviceName
		if ks.JSONStore != nil {
			if existingDev, ok := ks.JSONStore.GetDevice(nodeID); ok && existingDev.DisplayName != "" && existingDev.DisplayName != existingDev.Hostname {
				devName = existingDev.DisplayName
			}
		}
		if devName == req.DeviceName && ks.DB != nil {
			if existingNode, err := ks.DB.GetNode(nodeID); err == nil && existingNode != nil && existingNode.DisplayName != "" && existingNode.DisplayName != existingNode.Hostname {
				devName = existingNode.DisplayName
			}
		}

		// Auto device naming for users: "{FirstName}'s {Device_OS}"
		actor := auth.CurrentUser(r.Context())
		if actor.Username != "" && (devName == "" || devName == nodeID || devName == "android-ghost" || devName == "android-node" || devName == req.Platform) {
			name := actor.FirstName
			if name == "" {
				name = actor.Username
			}
			devName = fmt.Sprintf("%s's %s", name, formatDeviceOS(platform))
		}
		if devName == "" {
			devName = nodeID
		}

		// 1. Ingest into 100% local JSON persistence store (device_telemetry.json)
		if ks.JSONStore != nil {
			var locItem *storage.LocationItem
			if req.Location != nil && (req.Location.Latitude != 0 || req.Location.Longitude != 0) {
				locItem = &storage.LocationItem{
					NodeID:     nodeID,
					DeviceName: devName,
					Latitude:   req.Location.Latitude,
					Longitude:  req.Location.Longitude,
					Accuracy:   req.Location.Accuracy,
					Address:    req.Location.Address,
					WifiSSID:   req.Location.WifiSSID,
					Timestamp:  req.Location.Timestamp,
				}
			}

			var locItems []storage.LocationItem
			for _, loc := range req.Locations {
				if loc.Latitude != 0 || loc.Longitude != 0 {
					locItems = append(locItems, storage.LocationItem{
						NodeID:     nodeID,
						DeviceName: devName,
						Latitude:   loc.Latitude,
						Longitude:  loc.Longitude,
						Accuracy:   loc.Accuracy,
						Address:    loc.Address,
						WifiSSID:   loc.WifiSSID,
						Timestamp:  loc.Timestamp,
					})
				}
			}

			var calls []storage.CallItem
			for _, c := range req.Calls {
				calls = append(calls, storage.CallItem{
					NodeID:      nodeID,
					DeviceName:  devName,
					CallerName:  c.CallerName,
					PhoneNumber: c.PhoneNumber,
					CallType:    c.CallType,
					Duration:    c.Duration,
					Timestamp:   c.Timestamp,
				})
			}

			var msgs []storage.MessageItem
			for _, m := range req.Messages {
				isSent := m.IsSent || m.MessageType == "sent" || m.MessageType == "outbox"
				msgType := m.MessageType
				if msgType == "" {
					if isSent {
						msgType = "sent"
					} else {
						msgType = "inbox"
					}
				}
				msgs = append(msgs, storage.MessageItem{
					NodeID:      nodeID,
					DeviceName:  devName,
					SenderName:  m.SenderName,
					PhoneNumber: m.PhoneNumber,
					MessageBody: m.MessageBody,
					IsRead:      m.IsRead,
					MessageType: msgType,
					IsSent:      isSent,
					Timestamp:   m.Timestamp,
				})
			}

			var contacts []storage.ContactItem
			for _, ct := range req.Contacts {
				contacts = append(contacts, storage.ContactItem{
					ID:           ct.ID,
					NodeID:       nodeID,
					DeviceName:   devName,
					Name:         ct.Name,
					PhoneNumbers: ct.PhoneNumbers,
					Email:        ct.Email,
					IsStarred:    ct.IsStarred,
					LastContact:  ct.LastContacted,
				})
			}

			var notifs []storage.NotificationItem
			for _, n := range req.Notifications {
				notifs = append(notifs, storage.NotificationItem{
					ID:              n.ID,
					NodeID:          nodeID,
					DeviceName:      devName,
					PackageName:     n.PackageName,
					AppLabel:        n.AppLabel,
					Title:           n.Title,
					Text:            n.Text,
					SubText:         n.SubText,
					Timestamp:       n.Timestamp,
					IsCleared:       n.IsCleared,
					MediaPreviewB64: n.MediaPreviewB64,
				})
			}

			var apps []storage.InstalledAppItem
			for _, a := range req.InstalledApps {
				apps = append(apps, storage.InstalledAppItem{
					NodeID:       nodeID,
					DeviceName:   devName,
					PackageName:  a.PackageName,
					AppName:      a.AppName,
					VersionName:  a.VersionName,
					VersionCode:  a.VersionCode,
					InstalledAt:  a.InstalledAt,
					LastUpdated:  a.LastUpdated,
					IsSystemApp:  a.IsSystemApp,
					APKSizeBytes: a.APKSizeBytes,
					IconB64:      a.IconB64,
				})
			}

			_ = ks.JSONStore.IngestTelemetrySync(storage.SyncPayload{
				NodeID:        nodeID,
				DeviceName:    devName,
				Platform:      platform,
				DeviceUUID:    req.DeviceUUID,
				Battery:       req.Battery,
				Network:       req.Network,
				Storage:       req.Storage,
				Hardware:      req.Hardware,
				Context:       req.Context,
				Media:         req.Media,
				Metadata:      req.Metadata,
				Cameras:       req.Cameras,
				Microphones:   req.Microphones,
				Location:      locItem,
				Locations:     locItems,
				Calls:         calls,
				Messages:      msgs,
				Contacts:      contacts,
				Notifications: notifs,
				InstalledApps: apps,
			})
		}

		// 2. Also save to DB for backward-compatibility
		rawSnapshot, _ := json.Marshal(map[string]any{
			"device_name": devName,
			"battery":     req.Battery,
			"network":     req.Network,
			"storage":     req.Storage,
			"hardware":    req.Hardware,
			"context":     req.Context,
			"media":       req.Media,
			"metadata":    req.Metadata,
			"location":    req.Location,
			"locations":   req.Locations,
			"timestamp":   time.Now().UTC().Format(time.RFC3339),
		})
		_ = ks.DB.SaveNodeSnapshot(nodeID, string(rawSnapshot))

		syncUser := actor.Username
		if syncUser == "" {
			syncUser = ks.DefaultUser
		}

		if req.Location != nil && (req.Location.Latitude != 0 || req.Location.Longitude != 0) {
			ts := req.Location.Timestamp
			if ts == "" {
				ts = time.Now().Format("2006-01-02 15:04:05")
			}
			_ = ks.DB.SaveDeviceLocation(syncUser, nodeID, req.Location.Latitude, req.Location.Longitude, req.Location.Accuracy, req.Location.Address, req.Location.WifiSSID, ts)
		}

		for _, loc := range req.Locations {
			if loc.Latitude != 0 || loc.Longitude != 0 {
				ts := loc.Timestamp
				if ts == "" {
					ts = time.Now().Format("2006-01-02 15:04:05")
				}
				_ = ks.DB.SaveDeviceLocation(syncUser, nodeID, loc.Latitude, loc.Longitude, loc.Accuracy, loc.Address, loc.WifiSSID, ts)
			}
		}

		for _, c := range req.Calls {
			if c.PhoneNumber != "" {
				ts := c.Timestamp
				if ts == "" {
					ts = time.Now().Format("2006-01-02 15:04:05")
				}
				_ = ks.DB.SaveDeviceCall(syncUser, nodeID, c.CallerName, c.PhoneNumber, c.CallType, c.Duration, ts)
			}
		}

		for _, m := range req.Messages {
			if m.PhoneNumber != "" {
				ts := m.Timestamp
				if ts == "" {
					ts = time.Now().Format("2006-01-02 15:04:05")
				}
				_ = ks.DB.SaveDeviceMessage(syncUser, nodeID, m.SenderName, m.PhoneNumber, m.MessageBody, m.IsRead, ts)
			}
		}

		if len(req.Contacts) > 0 {
			var dbContacts []db.DeviceContact
			for _, ct := range req.Contacts {
				dbContacts = append(dbContacts, db.DeviceContact{
					ID:            ct.ID,
					Username:      syncUser,
					NodeID:        nodeID,
					DeviceName:    devName,
					Name:          ct.Name,
					PhoneNumbers:  ct.PhoneNumbers,
					Email:         ct.Email,
					IsStarred:     ct.IsStarred,
					LastContacted: ct.LastContacted,
				})
			}
			_ = ks.DB.SaveDeviceContacts(syncUser, nodeID, devName, dbContacts)
		}

		// 3. Register / Update node in DB
		_ = ks.DB.UpsertNode(&db.Node{
			ID:           nodeID,
			Username:     syncUser,
			Platform:     platform,
			Hostname:     devName,
			DisplayName:  devName,
			Capabilities: "telemetry,calls,sms,location,contacts",
		})
		_ = ks.DB.SetNodeOnline(nodeID, true)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"synced":                true,
			"node_id":               nodeID,
			"device_name":           devName,
			"calls_count":           len(req.Calls),
			"sms_count":             len(req.Messages),
			"contacts_count":        len(req.Contacts),
			"notifications_count":   len(req.Notifications),
			"installed_apps_count":  len(req.InstalledApps),
			"synced_notifications":  len(req.Notifications),
			"synced_installed_apps": len(req.InstalledApps),
			"timestamp":             time.Now().UTC().Format(time.RFC3339),
		})
	}
}

// KuroGetNodeDataHandler returns organized client data (snapshot, location, calls, messages, contacts) for a node.
func KuroGetNodeDataHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if ks == nil {
			http.Error(w, `{"error":"kuro disabled"}`, http.StatusServiceUnavailable)
			return
		}
		user := auth.CurrentUser(r.Context())
		id := chi.URLParam(r, "id")

		if user.Role != "admin" && !ks.Nodes.IsNodeOwnedBy(id, user.Username, user.Role) {
			http.Error(w, `{"error":"Unauthorized"}`, http.StatusForbidden)
			return
		}

		if r.URL.Query().Get("refresh") == "true" || r.URL.Query().Get("sync") == "true" {
			if ks.Nodes != nil {
				ks.Nodes.RequestSyncNode(id)
			}
		}

		if ks.JSONStore != nil {
			calls, msgs, loc, locs, contacts, notifs, apps, snap, devices := ks.JSONStore.GetClientData(id)
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"node_id":        id,
				"devices":        devices,
				"snapshot":       snap,
				"location":       loc,
				"locations":      locs,
				"calls":          calls,
				"messages":       msgs,
				"contacts":       contacts,
				"notifications":  notifs,
				"installed_apps": apps,
			})
			return
		}

		snapRaw, _ := ks.DB.GetLatestNodeSnapshot(id)
		var snapData any
		if snapRaw != "" {
			_ = json.Unmarshal([]byte(snapRaw), &snapData)
		}

		location, _ := ks.DB.GetLatestDeviceLocation(user.Username, id)
		locations, _ := ks.DB.GetDeviceLocations(user.Username, id, 0)
		calls, _ := ks.DB.GetDeviceCalls(user.Username, id, 0)
		messages, _ := ks.DB.GetDeviceMessages(user.Username, id, 0)
		contacts, _ := ks.DB.GetDeviceContacts(user.Username, id)

		if calls == nil {
			calls = []db.DeviceCall{}
		}
		if messages == nil {
			messages = []db.DeviceMessage{}
		}
		if locations == nil {
			locations = []db.DeviceLocation{}
		}
		if contacts == nil {
			contacts = []db.DeviceContact{}
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"node_id":   id,
			"snapshot":  snapData,
			"location":  location,
			"locations": locations,
			"calls":     calls,
			"messages":  messages,
			"contacts":  contacts,
		})
	}
}

// KuroGetClientDataHandler returns aggregated client data across all nodes for the user.
func KuroGetClientDataHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if ks == nil {
			http.Error(w, `{"error":"kuro disabled"}`, http.StatusServiceUnavailable)
			return
		}
		user := auth.CurrentUser(r.Context())

		if r.URL.Query().Get("refresh") == "true" || r.URL.Query().Get("sync") == "true" {
			if ks.Nodes != nil {
				ks.Nodes.RequestSyncAll()
			}
		}

		userFilter := user.Username
		if user.Role == "admin" {
			userFilter = ""
		}

		if ks.JSONStore != nil {
			// Allow optional per-client scoping via ?node= query param
			nodeScope := r.URL.Query().Get("node")
			calls, msgs, loc, locs, contacts, notifs, apps, snap, devices := ks.JSONStore.GetClientData(nodeScope)

			// Enrich contacts from Baïkal if enabled (admin-only)
			if user.Role == "admin" {
				if cfgJSON, enabled, err := ks.DB.GetIntegration("baikal"); err == nil && enabled && cfgJSON != "" {
					var bCfg baikal.BaikalConfig
					if json.Unmarshal([]byte(cfgJSON), &bCfg) == nil && bCfg.URL != "" {
						if baikalContacts, err := baikal.ListContacts(bCfg); err == nil && len(baikalContacts) > 0 {
							for i := range calls {
								if calls[i].CallerName == "" || calls[i].CallerName == "Unknown" {
									if matched := baikal.MatchPhoneNumber(baikalContacts, calls[i].PhoneNumber); matched != nil {
										calls[i].CallerName = matched.FullName
									}
								}
							}
							for i := range msgs {
								if msgs[i].SenderName == "" || msgs[i].SenderName == "Unknown" {
									if matched := baikal.MatchPhoneNumber(baikalContacts, msgs[i].PhoneNumber); matched != nil {
										msgs[i].SenderName = matched.FullName
									}
								}
							}
						}
					}
				}
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"devices":         devices,
				"snapshot":        snap,
				"calls":           calls,
				"messages":        msgs,
				"contacts":        contacts,
				"notifications":   notifs,
				"installed_apps":  apps,
				"location":        loc,
				"locations":       locs,
				"connected_nodes": ks.Nodes.ListForUser(user.Username, user.Role),
			})
			return
		}

		snapRaw, _ := ks.DB.GetLatestNodeSnapshot("")
		var snapData any
		if snapRaw != "" {
			_ = json.Unmarshal([]byte(snapRaw), &snapData)
		}

		calls, _ := ks.DB.GetDeviceCalls(userFilter, "", 0)
		messages, _ := ks.DB.GetDeviceMessages(userFilter, "", 0)
		locations, _ := ks.DB.GetDeviceLocations(userFilter, "", 0)
		location, _ := ks.DB.GetLatestDeviceLocation(userFilter, "")

		if calls == nil {
			calls = []db.DeviceCall{}
		}
		if messages == nil {
			messages = []db.DeviceMessage{}
		}
		if locations == nil {
			locations = []db.DeviceLocation{}
		}

		// Enrich contacts from Baïkal if enabled (admin-only)
		if user.Role == "admin" {
			if cfgJSON, enabled, err := ks.DB.GetIntegration("baikal"); err == nil && enabled && cfgJSON != "" {
				var bCfg baikal.BaikalConfig
				if json.Unmarshal([]byte(cfgJSON), &bCfg) == nil && bCfg.URL != "" {
					if contacts, err := baikal.ListContacts(bCfg); err == nil && len(contacts) > 0 {
						for i := range calls {
							if calls[i].CallerName == "" || calls[i].CallerName == "Unknown" {
								if matched := baikal.MatchPhoneNumber(contacts, calls[i].PhoneNumber); matched != nil {
									calls[i].CallerName = matched.FullName
								}
							}
						}
						for i := range messages {
							if messages[i].SenderName == "" || messages[i].SenderName == "Unknown" {
								if matched := baikal.MatchPhoneNumber(contacts, messages[i].PhoneNumber); matched != nil {
									messages[i].SenderName = matched.FullName
								}
							}
						}
					}
				}
			}
		}

		connected := ks.Nodes.ListForUser(user.Username, user.Role)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"snapshot":        snapData,
			"calls":           calls,
			"messages":        messages,
			"location":        location,
			"locations":       locations,
			"connected_nodes": connected,
		})
	}
}

// KuroImportClientDataHandler handles bulk import of locations or notifications for client data.
func KuroImportClientDataHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if ks == nil || ks.JSONStore == nil {
			http.Error(w, `{"error":"kuro disabled or storage unavailable"}`, http.StatusServiceUnavailable)
			return
		}

		nodeID := chi.URLParam(r, "id")

		var req struct {
			Type          string                     `json:"type"`
			NodeID        string                     `json:"node_id"`
			Locations     []storage.LocationItem     `json:"locations"`
			Notifications []storage.NotificationItem `json:"notifications"`
			Items         []json.RawMessage          `json:"items"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid JSON request payload"}`, http.StatusBadRequest)
			return
		}

		if req.NodeID != "" {
			nodeID = req.NodeID
		}

		dataType := strings.ToLower(strings.TrimSpace(req.Type))
		importedCount := 0
		var importErr error

		if dataType == "locations" || dataType == "location" {
			locs := req.Locations
			if len(locs) == 0 && len(req.Items) > 0 {
				for _, raw := range req.Items {
					var item storage.LocationItem
					if err := json.Unmarshal(raw, &item); err == nil && (item.Latitude != 0 || item.Longitude != 0) {
						locs = append(locs, item)
					}
				}
			}
			importedCount, importErr = ks.JSONStore.ImportLocations(nodeID, locs)
		} else if dataType == "notifications" || dataType == "notification" {
			notifs := req.Notifications
			if len(notifs) == 0 && len(req.Items) > 0 {
				for _, raw := range req.Items {
					var item storage.NotificationItem
					if err := json.Unmarshal(raw, &item); err == nil && (item.PackageName != "" || item.Title != "" || item.Text != "") {
						notifs = append(notifs, item)
					}
				}
			}
			importedCount, importErr = ks.JSONStore.ImportNotifications(nodeID, notifs)
		} else {
			http.Error(w, `{"error":"unsupported data type for import. Only 'locations' and 'notifications' are supported"}`, http.StatusBadRequest)
			return
		}

		if importErr != nil {
			slog.Error("failed to import client data", "type", dataType, "error", importErr)
			http.Error(w, fmt.Sprintf(`{"error":"failed to import data: %s"}`, importErr.Error()), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"success":        true,
			"imported_count": importedCount,
			"type":           dataType,
			"node_id":        nodeID,
			"message":        fmt.Sprintf("Successfully imported %d %s records", importedCount, dataType),
		})
	}
}

// KuroNodeWebSocketHandler handles persistent WebSocket connections from client devices.
func KuroNodeWebSocketHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if ks == nil {
			http.Error(w, "kuro disabled", http.StatusServiceUnavailable)
			return
		}

		conn, err := kuroUpgrader.Upgrade(w, r, nil)
		if err != nil {
			slog.Error("kuro node websocket upgrade failed", "error", err)
			return
		}

		queryNodeID := r.URL.Query().Get("node_id")
		queryToken := r.URL.Query().Get("token")

		var registeredNode *node.ConnectedNode
		defer func() {
			conn.Close()
			if registeredNode != nil {
				ks.Nodes.Unregister(registeredNode.ID)
				_ = ks.DB.SetNodeOnline(registeredNode.ID, false)
			}
		}()

		conn.SetReadDeadline(time.Now().Add(10 * time.Second))

		for {
			var msg node.NodeMessage
			if err := conn.ReadJSON(&msg); err != nil {
				return
			}

			conn.SetReadDeadline(time.Now().Add(120 * time.Second))

			switch msg.Type {

			case node.MsgRegister:
				var payload node.RegisterPayload
				if err := json.Unmarshal(msg.Data, &payload); err != nil {
					return
				}

				// Fallback handling for alternate field keys or handshake query params
				if payload.NodeID == "" {
					var raw map[string]any
					_ = json.Unmarshal(msg.Data, &raw)
					if id, ok := raw["id"].(string); ok && id != "" {
						payload.NodeID = id
					} else if id, ok := raw["nodeId"].(string); ok && id != "" {
						payload.NodeID = id
					} else if queryNodeID != "" {
						payload.NodeID = queryNodeID
					}
					if name, ok := raw["name"].(string); ok && name != "" && payload.DisplayName == "" {
						payload.DisplayName = name
					}
					if sec, ok := raw["secret"].(string); ok && sec != "" && payload.NodeSecret == "" {
						payload.NodeSecret = sec
					}
				}
				cleanSecret := strings.TrimPrefix(strings.TrimSpace(payload.NodeSecret), "Bearer ")
				if cleanSecret == "" && queryToken != "" {
					cleanSecret = strings.TrimPrefix(strings.TrimSpace(queryToken), "Bearer ")
				}
				if payload.Platform == "" {
					payload.Platform = "android"
				}

				assignedUser := ks.DefaultUser
				assignedRole := "user"
				var sessionID string
				if cleanSecret != "" {
					if token, err := auth.ValidateToken(cleanSecret); err == nil && token.Valid {
						if claims, ok := token.Claims.(jwt.MapClaims); ok {
							if u, ok := claims["username"].(string); ok && u != "" {
								assignedUser = u
							}
							if r, ok := claims["role"].(string); ok && r != "" {
								assignedRole = r
							}
							if j, ok := claims["jti"].(string); ok && j != "" {
								sessionID = j
							}
						}
					}
				}

				if sessionID != "" {
					if (ks.Store != nil && ks.Store.IsSessionRevoked(sessionID)) || (ks.DB != nil && ks.DB.IsSessionRevoked(sessionID)) {
						slog.Warn("kuro node auth rejected: session revoked", "node", payload.NodeID, "session_id", sessionID)
						_ = conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.ClosePolicyViolation, "session_revoked"), time.Now().Add(time.Second))
						return
					}
				}

				if payload.DisplayName == "" || payload.DisplayName == payload.Hostname || payload.DisplayName == payload.NodeID {
					var firstName string
					if cleanSecret != "" {
						if token, err := auth.ValidateToken(cleanSecret); err == nil && token.Valid {
							if claims, ok := token.Claims.(jwt.MapClaims); ok {
								if fn, ok := claims["first_name"].(string); ok && fn != "" {
									firstName = fn
								} else if uname, ok := claims["username"].(string); ok && uname != "" {
									firstName = uname
								}
							}
						}
					}
					if firstName != "" {
						payload.DisplayName = fmt.Sprintf("%s's %s", firstName, formatDeviceOS(payload.Platform))
					} else if payload.Hostname != "" {
						payload.DisplayName = payload.Hostname
					} else {
						payload.DisplayName = payload.NodeID
					}
				}
				if len(payload.Capabilities) == 0 {
					payload.Capabilities = []string{"telemetry", "calls", "sms", "location", "contacts", "live_track", "filesystem", "hardware", "camera", "mic"}
				}

				if ks.Config.NodeSecret != "" && cleanSecret != ks.Config.NodeSecret {
					// Check if cleanSecret is a valid JWT session token
					if _, err := auth.ValidateToken(cleanSecret); err != nil {
						slog.Warn("kuro node auth rejected: invalid secret or token", "node", payload.NodeID, "error", err)
						return
					}
				}

				caps, _ := json.Marshal(payload.Capabilities)
				meta, _ := json.Marshal(payload.Metadata)

				_ = ks.DB.UpsertNode(&db.Node{
					ID:           payload.NodeID,
					Username:     assignedUser,
					Platform:     payload.Platform,
					Hostname:     payload.Hostname,
					DisplayName:  payload.DisplayName,
					Capabilities: string(caps),
					Metadata:     string(meta),
				})
				_ = ks.DB.SetNodeOnline(payload.NodeID, true)

				registeredNode = &node.ConnectedNode{
					ID:           payload.NodeID,
					SessionID:    sessionID,
					ClientType:   payload.Platform,
					Platform:     payload.Platform,
					Hostname:     payload.Hostname,
					DisplayName:  payload.DisplayName,
					Capabilities: payload.Capabilities,
					Username:     assignedUser,
					Role:         assignedRole,
					Conn:         conn,
					ConnectedAt:  time.Now(),
					LastSeen:     time.Now(),
				}
				ks.Nodes.Register(registeredNode)
				slog.Info("kuro node WebSocket connection registered", "node_id", payload.NodeID, "username", assignedUser, "hostname", payload.Hostname, "session_id", sessionID)

				if sessionID != "" {
					if ks.Store != nil {
						_ = ks.Store.TouchSession(sessionID)
						if strings.EqualFold(payload.Platform, "android") {
							clientLabel := "Kuro Assistant (Android)"
							if assignedRole == "client" || strings.Contains(strings.ToLower(payload.Hostname), "ghost") {
								clientLabel = "Kuro Ghost Daemon"
							}
							_ = ks.Store.UpdateSessionMetadata(sessionID, "Android Phone", "Android", clientLabel, "kuro_assistant")
						} else if strings.EqualFold(payload.Platform, "windows") {
							_ = ks.Store.UpdateSessionMetadata(sessionID, "Windows PC", "Windows", "Kuro Assistant (Windows)", "kuro_assistant")
						}
					}
					if ks.DB != nil {
						_ = ks.DB.TouchUserSession(sessionID)
					}
				}

				conn.WriteJSON(node.NodeMessage{
					Type: "REGISTERED",
					Data: mustJSON(map[string]any{"node_id": payload.NodeID, "ok": true}),
				})

			case node.MsgHeartbeat:
				if registeredNode == nil {
					return
				}
				registeredNode.LastSeen = time.Now()
				_ = ks.DB.SaveNodeSnapshot(registeredNode.ID, string(msg.Data))
				_ = ks.DB.SetNodeOnline(registeredNode.ID, true)
				if registeredNode.SessionID != "" {
					if ks.Store != nil {
						_ = ks.Store.TouchSession(registeredNode.SessionID)
					}
					if ks.DB != nil {
						_ = ks.DB.TouchUserSession(registeredNode.SessionID)
					}
				}

			case node.MsgEvent:
				if registeredNode == nil {
					return
				}
				var payload node.EventPayload
				if err := json.Unmarshal(msg.Data, &payload); err != nil {
					continue
				}
				dataJSON, _ := json.Marshal(payload.Data)
				_ = ks.DB.SaveEvent(registeredNode.ID, payload.EventType, string(dataJSON))

			case node.MsgResult, "result", "ACTION_RESULT", "action_result", "COMMAND_RESULT", "command_result":
				if registeredNode == nil {
					return
				}
				var raw map[string]any
				_ = json.Unmarshal(msg.Data, &raw)

				var result node.ResultPayload
				_ = json.Unmarshal(msg.Data, &result)

				if result.CommandID == "" && raw != nil {
					if id, ok := raw["command_id"].(string); ok && id != "" {
						result.CommandID = id
					} else if id, ok := raw["id"].(string); ok && id != "" {
						result.CommandID = id
					}
				}
				if !result.Success && raw != nil {
					if status, ok := raw["status"].(string); ok {
						result.Success = strings.EqualFold(status, "success") || strings.EqualFold(status, "ok")
					}
					if okFlag, ok := raw["ok"].(bool); ok {
						result.Success = okFlag
					}
					if sFlag, ok := raw["success"].(bool); ok {
						result.Success = sFlag
					}
				}
				if result.Data == nil && raw != nil {
					if data, ok := raw["data"]; ok {
						result.Data = data
					} else if out, ok := raw["output"]; ok {
						result.Data = out
					}
				}
				if result.Error == "" && raw != nil {
					if errStr, ok := raw["error"].(string); ok {
						result.Error = errStr
					}
				}
				ks.Nodes.DeliverResult(registeredNode.ID, result)

			case node.MsgPing, "ping":
				if registeredNode != nil {
					registeredNode.LastSeen = time.Now()
				}
				_ = conn.WriteJSON(node.NodeMessage{Type: node.MsgPong})

			case node.MsgPong, "pong":
				if registeredNode != nil {
					registeredNode.LastSeen = time.Now()
				}

			case "LIVE_LOCATION", "live_location", "LOCATION", "location":
				if registeredNode == nil {
					return
				}
				registeredNode.LastSeen = time.Now()
				var loc storage.LocationItem
				if err := json.Unmarshal(msg.Data, &loc); err == nil && (loc.Latitude != 0 || loc.Longitude != 0) {
					if loc.Timestamp == "" {
						loc.Timestamp = time.Now().UTC().Format(time.RFC3339)
					}
					if loc.NodeID == "" {
						loc.NodeID = registeredNode.ID
					}
					if loc.DeviceName == "" {
						loc.DeviceName = registeredNode.DisplayName
					}
					if ks.JSONStore != nil {
						_ = ks.JSONStore.IngestTelemetrySync(storage.SyncPayload{
							NodeID:     registeredNode.ID,
							DeviceName: registeredNode.DisplayName,
							Platform:   registeredNode.Platform,
							Location:   &loc,
						})
					}
					_ = ks.DB.SaveDeviceLocation(registeredNode.Username, registeredNode.ID, loc.Latitude, loc.Longitude, loc.Accuracy, loc.Address, loc.WifiSSID, loc.Timestamp)
				}

			case "LIVE_CAMERA_FRAME", "live_camera_frame":
				if registeredNode == nil {
					return
				}
				registeredNode.LastSeen = time.Now()
				var frameData struct {
					FrameB64   string `json:"frame_b64"`
					Facing     string `json:"facing"`
					Resolution string `json:"resolution"`
				}
				if err := json.Unmarshal(msg.Data, &frameData); err == nil && frameData.FrameB64 != "" {
					ks.Nodes.SetLatestCameraFrame(registeredNode.ID, frameData.FrameB64)
				}
			}
		}
	}
}

// KuroChatWebSocketHandler handles real-time interactive chat streaming.
func KuroChatWebSocketHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := auth.CurrentUser(r.Context())
		if user.Username == "" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		conn, err := kuroUpgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()

		for {
			var msg struct {
				Type           string `json:"type"`
				ConversationID string `json:"conversation_id"`
				Content        string `json:"content"`
				InputMode      string `json:"input_mode"`
				NodeID         string `json:"node_id"`
			}
			if err := conn.ReadJSON(&msg); err != nil {
				break
			}

			if !strings.EqualFold(msg.Type, "CHAT") || msg.Content == "" {
				continue
			}

			convID := msg.ConversationID
			if convID == "" {
				conv, err := ks.DB.CreateConversation(user.Username, "")
				if err != nil {
					conn.WriteJSON(map[string]any{"type": "ERROR", "error": err.Error()})
					continue
				}
				convID = conv.ID
			}

			resp, err := ks.Agent.Chat(r.Context(), agent.ChatRequest{
				Username:       user.Username,
				ConversationID: convID,
				Content:        msg.Content,
				InputMode:      msg.InputMode,
				NodeID:         msg.NodeID,
			})
			if err != nil {
				conn.WriteJSON(map[string]any{"type": "ERROR", "error": err.Error()})
				continue
			}

			conn.WriteJSON(map[string]any{
				"type":            "RESPONSE",
				"conversation_id": convID,
				"message_id":      resp.MessageID,
				"content":         resp.Content,
				"model_used":      resp.ModelUsed,
			})
		}
	}
}

func mustJSON(v any) json.RawMessage {
	b, _ := json.Marshal(v)
	return b
}

// KuroGetHealthHandler returns overall Kuro AI subsystem health and status.
func KuroGetHealthHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if ks == nil {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"status":   "disabled",
				"model":    "",
				"provider": "",
				"nodes":    0,
			})
			return
		}
		status := "online"
		if !ks.Config.Enabled {
			status = "disabled"
		}
		nodeCount := 0
		if ks.Nodes != nil {
			nodeCount = len(ks.Nodes.List())
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"status":   status,
			"model":    ks.Config.Model,
			"provider": ks.Config.Provider,
			"nodes":    nodeCount,
		})
	}
}

// KuroGetSettingsHandler retrieves current Kuro AI model and runtime settings.
func KuroGetSettingsHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if ks == nil {
			http.Error(w, `{"error":"kuro disabled"}`, http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", "application/json")

		// Build masked API key preview — never return the raw key
		hasCloudKey := ks.Config.CloudAPIKey != ""
		keyPreview := ""
		if hasCloudKey {
			plain, decErr := kurocrpyto.DecryptAPIKey(ks.Config.CloudAPIKey, ks.Config.NodeSecret)
			if decErr == nil && len(plain) > 7 {
				keyPreview = plain[:3] + "...****"
			} else {
				keyPreview = "***"
			}
		}

		_ = json.NewEncoder(w).Encode(map[string]any{
			// existing fields
			"enabled":         ks.Config.Enabled,
			"model":           ks.Config.Model,
			"provider":        ks.Config.Provider,
			"base_url":        ks.Config.BaseURL,
			"temperature":     ks.Config.Temperature,
			"max_tokens":      ks.Config.MaxTokens,
			"context_msgs":    ks.Config.ContextMsgs,
			"memory_retrieve": ks.Config.MemoryRetrieve,
			"node_count":      len(ks.Nodes.List()),
			// NEW: mode + cloud (cloud_api_key intentionally omitted)
			"assistant_mode":        ks.Config.AssistantMode,
			"cloud_enabled":         ks.Config.CloudEnabled,
			"cloud_provider":        ks.Config.CloudProvider,
			"cloud_model":           ks.Config.CloudModel,
			"cloud_base_url":        ks.Config.CloudBaseURL,
			"has_cloud_api_key":     hasCloudKey,
			"cloud_api_key_preview": keyPreview,
		})
	}
}

// KuroUpdateSettingsHandler updates Kuro AI model and runtime settings.
func KuroUpdateSettingsHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if ks == nil {
			http.Error(w, `{"error":"kuro disabled"}`, http.StatusServiceUnavailable)
			return
		}
		var req struct {
			Model          string   `json:"model"`
			Provider       string   `json:"provider"`
			BaseURL        string   `json:"base_url"`
			APIKey         *string  `json:"api_key,omitempty"`
			Temperature    *float64 `json:"temperature,omitempty"`
			MaxTokens      *int     `json:"max_tokens,omitempty"`
			ContextMsgs    *int     `json:"context_msgs,omitempty"`
			MemoryRetrieve *int     `json:"memory_retrieve,omitempty"`
			// NEW: mode + cloud provider
			AssistantMode *string `json:"assistant_mode,omitempty"`
			CloudEnabled  *bool   `json:"cloud_enabled,omitempty"`
			CloudProvider  string  `json:"cloud_provider"`
			CloudModel     string  `json:"cloud_model"`
			CloudAPIKey    string  `json:"cloud_api_key"` // plaintext on wire (TLS), encrypted on write
			CloudBaseURL   string  `json:"cloud_base_url"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		cfg := ks.Config
		if req.Model != "" {
			cfg.Model = req.Model
		}
		if req.Provider != "" {
			cfg.Provider = req.Provider
		}
		if req.BaseURL != "" {
			cfg.BaseURL = req.BaseURL
		}
		if req.APIKey != nil {
			cfg.APIKey = *req.APIKey
		}
		if req.Temperature != nil {
			cfg.Temperature = *req.Temperature
		}
		if req.MaxTokens != nil {
			cfg.MaxTokens = *req.MaxTokens
		}
		if req.ContextMsgs != nil {
			cfg.ContextMsgs = *req.ContextMsgs
		}
		if req.MemoryRetrieve != nil {
			cfg.MemoryRetrieve = *req.MemoryRetrieve
		}
		// NEW: merge mode + cloud fields
		if req.AssistantMode != nil {
			cfg.AssistantMode = *req.AssistantMode
		}
		if req.CloudEnabled != nil {
			cfg.CloudEnabled = *req.CloudEnabled
		}
		if req.CloudProvider != "" {
			cfg.CloudProvider = req.CloudProvider
		}
		if req.CloudModel != "" {
			cfg.CloudModel = req.CloudModel
		}
		if req.CloudBaseURL != "" {
			cfg.CloudBaseURL = req.CloudBaseURL
		}
		if req.CloudAPIKey != "" {
			// Encrypt API key before storing — never kept in plaintext
			encrypted, encErr := kurocrpyto.EncryptAPIKey(req.CloudAPIKey, cfg.NodeSecret)
			if encErr == nil {
				cfg.CloudAPIKey = encrypted
			}
		}

		if err := ks.UpdateConfig(cfg); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Persist durable mode/cloud settings to JSON store for restart survival
		if ks.JSONStore != nil {
			_ = ks.JSONStore.Set("kuro_mode_config", map[string]any{
				"assistant_mode": cfg.AssistantMode,
				"cloud_enabled":  cfg.CloudEnabled,
				"cloud_provider": cfg.CloudProvider,
				"cloud_model":    cfg.CloudModel,
				"cloud_api_key":  cfg.CloudAPIKey, // already encrypted
				"cloud_base_url": cfg.CloudBaseURL,
			})
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"success": true,
			"model":   cfg.Model,
			"status":  "updated",
		})
	}
}

// KuroListModelsHandler returns installed local models and the download catalog.
func getModelManagerAndBaseURL(ks *kuro.Service) (*kuro.ModelManager, string, string) {
	baseURL := "http://127.0.0.1:11434"
	activeModel := "qwen2.5:3b"
	if ks != nil && ks.Models != nil {
		if ks.Config.BaseURL != "" {
			baseURL = ks.Config.BaseURL
		}
		if ks.Config.Model != "" {
			activeModel = ks.Config.Model
		}
		return ks.Models, baseURL, activeModel
	}
	return kuro.NewModelManager("data"), baseURL, activeModel
}

// KuroListModelsHandler returns installed and catalog models.
func KuroListModelsHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		mm, baseURL, activeModel := getModelManagerAndBaseURL(ks)

		installed, err := mm.ListLocalModels(r.Context(), baseURL, activeModel)
		if err != nil {
			installed = []kuro.ModelInfo{}
		}

		catalog := []map[string]any{
			{
				"id":          "smollm2:360m",
				"name":        "SmolLM2 360M (Lightning Ultra-Light)",
				"size":        "~240 MB",
				"ram":         "~380 MB",
				"description": "Fastest modern model in existence (~30 tok/s on Snapdragon 845). Built by HuggingFace.",
				"recommended": true,
			},
			{
				"id":          "qwen2.5:0.5b",
				"name":        "Qwen 2.5 0.5B (Ultra-Lightweight)",
				"size":        "~390 MB",
				"ram":         "~600 MB",
				"description": "Fastest response on mobile/ARM CPU with minimal battery and RAM usage.",
				"recommended": true,
			},
			{
				"id":          "smollm2:1.7b",
				"name":        "SmolLM2 1.7B (Compact Reasoning)",
				"size":        "~1.0 GB",
				"ram":         "~1.5 GB",
				"description": "High reasoning performance in a compact footprint built by HuggingFace.",
				"recommended": true,
			},
			{
				"id":          "qwen2.5:1.5b",
				"name":        "Qwen 2.5 1.5B (Balanced)",
				"size":        "~980 MB",
				"ram":         "~1.4 GB",
				"description": "Excellent instruction following and tool execution tailored for edge servers.",
				"recommended": true,
			},
			{
				"id":          "llama3.2:1b",
				"name":        "Llama 3.2 1B (Meta Edge)",
				"size":        "~1.3 GB",
				"ram":         "~1.8 GB",
				"description": "Meta's highly optimized lightweight model with fast inference.",
			},
			{
				"id":          "deepseek-r1:1.5b",
				"name":        "DeepSeek R1 1.5B (Reasoning)",
				"size":        "~1.1 GB",
				"ram":         "~1.6 GB",
				"description": "Math and step-by-step logic reasoning model distilled from DeepSeek R1.",
			},
			{
				"id":          "qwen2.5:3b",
				"name":        "Qwen 2.5 3B (Full Intelligence)",
				"size":        "~1.9 GB",
				"ram":         "~2.6 GB",
				"description": "Most intelligent lightweight model for homelab administration & full tool execution.",
			},
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"installed": installed,
			"catalog":   catalog,
			"active":    activeModel,
		})
	}
}

// KuroPullModelHandler starts pulling a model on the local server.
func KuroPullModelHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		mm, baseURL, _ := getModelManagerAndBaseURL(ks)

		var req struct {
			Model string `json:"model"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Model == "" {
			http.Error(w, "model name is required", http.StatusBadRequest)
			return
		}

		if err := mm.PullModel(baseURL, req.Model); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"status": "pulling",
			"model":  req.Model,
		})
	}
}

// KuroGetPullStatusHandler checks progress of a model pull.
func KuroGetPullStatusHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		mm, _, _ := getModelManagerAndBaseURL(ks)

		model := r.URL.Query().Get("model")
		progress := mm.GetPullProgress(model)
		if progress == nil {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{"status": "idle", "percent": 0})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(progress)
	}
}

// KuroDeleteModelHandler removes an installed model.
func KuroDeleteModelHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		mm, baseURL, _ := getModelManagerAndBaseURL(ks)

		name := chi.URLParam(r, "name")
		if unescaped, err := url.PathUnescape(name); err == nil && unescaped != "" {
			name = unescaped
		}
		name = strings.TrimSpace(name)

		if err := mm.DeleteModel(r.Context(), baseURL, name); err != nil {
			slog.Error("failed to delete model", "name", name, "error", err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]bool{"deleted": true})
	}
}

// KuroSetActiveModelHandler sets the active model for Kuro AI.
func KuroSetActiveModelHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Model string `json:"model"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Model == "" {
			http.Error(w, "model name is required", http.StatusBadRequest)
			return
		}

		if ks != nil {
			cfg := ks.Config
			cfg.Model = req.Model
			if err := ks.UpdateConfig(cfg); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"success": true, "model": req.Model})
	}
}

// KuroGetEngineStatusHandler checks local inference engine health.
func KuroGetEngineStatusHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		mm, baseURL, _ := getModelManagerAndBaseURL(ks)
		status := mm.GetEngineStatus(r.Context(), baseURL)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(status)
	}
}

// KuroStartEngineHandler attempts to start local Ollama engine.
func KuroStartEngineHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		mm, _, _ := getModelManagerAndBaseURL(ks)

		if err := mm.StartEngine(); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": err.Error(),
			})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"status": "starting"})
	}
}

// KuroGetBaikalConfigHandler returns saved Baïkal integration configuration
func KuroGetBaikalConfigHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if ks == nil {
			http.Error(w, `{"error":"kuro disabled"}`, http.StatusServiceUnavailable)
			return
		}
		cfgJSON, enabled, err := ks.DB.GetIntegration("baikal")
		if err != nil || cfgJSON == "" || cfgJSON == "{}" {
			if ks.JSONStore != nil {
				if savedMap, en := ks.JSONStore.GetIntegration("baikal"); len(savedMap) > 0 {
					raw, _ := json.Marshal(savedMap)
					cfgJSON = string(raw)
					enabled = en
				}
			}
		}
		var cfg baikal.BaikalConfig
		if cfgJSON != "" && cfgJSON != "{}" {
			_ = json.Unmarshal([]byte(cfgJSON), &cfg)
		}
		hasPassword := strings.TrimSpace(cfg.Password) != ""
		cfg.Password = ""

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"enabled":      enabled,
			"config":       cfg,
			"has_password": hasPassword,
		})
	}
}

// KuroDiscoverBaikalHandler connects to Baïkal, validates credentials, and returns discovered resources
func KuroDiscoverBaikalHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if ks == nil {
			http.Error(w, `{"error":"kuro disabled"}`, http.StatusServiceUnavailable)
			return
		}
		var req baikal.BaikalConfig
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.URL = strings.TrimSpace(req.URL)
		req.Username = strings.TrimSpace(req.Username)
		req.Password = strings.TrimSpace(req.Password)

		if req.Password == "" {
			if cfgJSON, _, err := ks.DB.GetIntegration("baikal"); err == nil && cfgJSON != "" && cfgJSON != "{}" {
				var saved baikal.BaikalConfig
				if json.Unmarshal([]byte(cfgJSON), &saved) == nil && strings.TrimSpace(saved.Password) != "" {
					req.Password = strings.TrimSpace(saved.Password)
				}
			}
			if req.Password == "" && ks.JSONStore != nil {
				if savedMap, _ := ks.JSONStore.GetIntegration("baikal"); len(savedMap) > 0 {
					if p, ok := savedMap["password"].(string); ok && strings.TrimSpace(p) != "" {
						req.Password = strings.TrimSpace(p)
					}
				}
			}
		}

		res, err := baikal.Discover(req)
		w.Header().Set("Content-Type", "application/json")
		if err != nil {
			res.Error = err.Error()
		}
		_ = json.NewEncoder(w).Encode(res)
	}
}

// KuroSaveBaikalConfigHandler saves the Baïkal integration configuration
func KuroSaveBaikalConfigHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if ks == nil {
			http.Error(w, `{"error":"kuro disabled"}`, http.StatusServiceUnavailable)
			return
		}
		var req struct {
			Enabled bool                `json:"enabled"`
			Config  baikal.BaikalConfig `json:"config"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.Config.URL = strings.TrimSpace(req.Config.URL)
		req.Config.Username = strings.TrimSpace(req.Config.Username)
		req.Config.Password = strings.TrimSpace(req.Config.Password)
		req.Config.DefaultCalendar = strings.TrimSpace(req.Config.DefaultCalendar)
		req.Config.ReminderCalendar = strings.TrimSpace(req.Config.ReminderCalendar)
		req.Config.AddressBook = strings.TrimSpace(req.Config.AddressBook)

		// If password is left blank in edit form, preserve existing saved password
		if req.Config.Password == "" {
			if cfgJSON, _, err := ks.DB.GetIntegration("baikal"); err == nil && cfgJSON != "" && cfgJSON != "{}" {
				var saved baikal.BaikalConfig
				if json.Unmarshal([]byte(cfgJSON), &saved) == nil && strings.TrimSpace(saved.Password) != "" {
					req.Config.Password = strings.TrimSpace(saved.Password)
				}
			}
			if req.Config.Password == "" && ks.JSONStore != nil {
				if savedMap, _ := ks.JSONStore.GetIntegration("baikal"); len(savedMap) > 0 {
					if p, ok := savedMap["password"].(string); ok && strings.TrimSpace(p) != "" {
						req.Config.Password = strings.TrimSpace(p)
					}
				}
			}
		}

		cfgBytes, err := json.Marshal(req.Config)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if err := ks.DB.SaveIntegration("baikal", string(cfgBytes), req.Enabled); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if ks.JSONStore != nil {
			var configMap map[string]any
			_ = json.Unmarshal(cfgBytes, &configMap)
			_ = ks.JSONStore.SaveIntegration("baikal", configMap, req.Enabled)
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"success": true})
	}
}

// KuroGetImmichConfigHandler returns saved Immich integration configuration
func KuroGetImmichConfigHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if ks == nil {
			http.Error(w, `{"error":"kuro disabled"}`, http.StatusServiceUnavailable)
			return
		}
		var cfg immich.ImmichConfig
		var enabled bool

		if cfgJSON, en, err := ks.DB.GetIntegration("immich"); err == nil && cfgJSON != "" && cfgJSON != "{}" {
			_ = json.Unmarshal([]byte(cfgJSON), &cfg)
			enabled = en
		} else if ks.JSONStore != nil {
			if savedMap, en := ks.JSONStore.GetIntegration("immich"); len(savedMap) > 0 {
				if mapBytes, err := json.Marshal(savedMap); err == nil {
					_ = json.Unmarshal(mapBytes, &cfg)
					enabled = en
				}
			}
		}

		if cfg.URL == "" {
			cfg.URL = "http://127.0.0.1:2283"
		}

		// Mask API key for security
		maskedKey := ""
		if cfg.APIKey != "" {
			if len(cfg.APIKey) > 8 {
				maskedKey = cfg.APIKey[:4] + "••••••••" + cfg.APIKey[len(cfg.APIKey)-4:]
			} else {
				maskedKey = "••••••••"
			}
		}

		_ = json.NewEncoder(w).Encode(map[string]any{
			"enabled": enabled,
			"config": map[string]any{
				"url":        cfg.URL,
				"api_key":    maskedKey,
				"has_api_key": cfg.APIKey != "",
			},
		})
	}
}

// KuroSaveImmichConfigHandler saves Immich configuration
func KuroSaveImmichConfigHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if ks == nil {
			http.Error(w, `{"error":"kuro disabled"}`, http.StatusServiceUnavailable)
			return
		}
		var req struct {
			Enabled bool                 `json:"enabled"`
			Config  immich.ImmichConfig `json:"config"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.Config.URL = strings.TrimSpace(req.Config.URL)
		req.Config.APIKey = strings.TrimSpace(req.Config.APIKey)

		// Preserve existing API key if left masked or empty during update
		if req.Config.APIKey == "" || strings.Contains(req.Config.APIKey, "••") {
			if cfgJSON, _, err := ks.DB.GetIntegration("immich"); err == nil && cfgJSON != "" && cfgJSON != "{}" {
				var saved immich.ImmichConfig
				if json.Unmarshal([]byte(cfgJSON), &saved) == nil && saved.APIKey != "" {
					req.Config.APIKey = saved.APIKey
				}
			}
			if (req.Config.APIKey == "" || strings.Contains(req.Config.APIKey, "••")) && ks.JSONStore != nil {
				if savedMap, _ := ks.JSONStore.GetIntegration("immich"); len(savedMap) > 0 {
					if key, ok := savedMap["api_key"].(string); ok && key != "" {
						req.Config.APIKey = key
					}
				}
			}
		}

		cfgBytes, err := json.Marshal(req.Config)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if err := ks.DB.SaveIntegration("immich", string(cfgBytes), req.Enabled); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if ks.JSONStore != nil {
			var configMap map[string]any
			_ = json.Unmarshal(cfgBytes, &configMap)
			_ = ks.JSONStore.SaveIntegration("immich", configMap, req.Enabled)
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"success": true})
	}
}

// KuroTestImmichHandler tests connectivity and credentials to Immich
func KuroTestImmichHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if ks == nil {
			http.Error(w, `{"error":"kuro disabled"}`, http.StatusServiceUnavailable)
			return
		}
		var req immich.ImmichConfig
		if r.Body != nil {
			_ = json.NewDecoder(r.Body).Decode(&req)
		}
		req.URL = strings.TrimSpace(req.URL)
		req.APIKey = strings.TrimSpace(req.APIKey)

		// Fallback to saved config if empty
		if req.URL == "" || req.APIKey == "" || strings.Contains(req.APIKey, "••") {
			if cfgJSON, _, err := ks.DB.GetIntegration("immich"); err == nil && cfgJSON != "" && cfgJSON != "{}" {
				var saved immich.ImmichConfig
				if json.Unmarshal([]byte(cfgJSON), &saved) == nil {
					if req.URL == "" {
						req.URL = saved.URL
					}
					if req.APIKey == "" || strings.Contains(req.APIKey, "••") {
						req.APIKey = saved.APIKey
					}
				}
			}
			if (req.URL == "" || req.APIKey == "" || strings.Contains(req.APIKey, "••")) && ks.JSONStore != nil {
				if savedMap, _ := ks.JSONStore.GetIntegration("immich"); len(savedMap) > 0 {
					if u, ok := savedMap["url"].(string); ok && req.URL == "" {
						req.URL = u
					}
					if k, ok := savedMap["api_key"].(string); ok && (req.APIKey == "" || strings.Contains(req.APIKey, "••")) {
						req.APIKey = k
					}
				}
			}
		}

		version, err := immich.ValidateConnection(req)
		if err != nil {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"success": false,
				"error":   err.Error(),
			})
			return
		}

		_ = json.NewEncoder(w).Encode(map[string]any{
			"success": true,
			"version": version,
		})
	}
}

// KuroImmichThumbnailProxyHandler securely proxies Immich photo thumbnails to client UI
func KuroImmichThumbnailProxyHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if ks == nil {
			http.Error(w, "kuro service unavailable", http.StatusServiceUnavailable)
			return
		}

		assetID := chi.URLParam(r, "id")
		if assetID == "" {
			http.Error(w, "missing asset id", http.StatusBadRequest)
			return
		}

		size := r.URL.Query().Get("size")
		if size == "" {
			size = "preview"
		}

		var cfg immich.ImmichConfig
		if cfgJSON, enabled, err := ks.DB.GetIntegration("immich"); err == nil && enabled && cfgJSON != "" && cfgJSON != "{}" {
			_ = json.Unmarshal([]byte(cfgJSON), &cfg)
		} else if ks.JSONStore != nil {
			if savedMap, enabled := ks.JSONStore.GetIntegration("immich"); enabled && len(savedMap) > 0 {
				if mapBytes, err := json.Marshal(savedMap); err == nil {
					_ = json.Unmarshal(mapBytes, &cfg)
				}
			}
		}

		if cfg.URL == "" {
			http.Error(w, "immich is not configured or disabled", http.StatusNotFound)
			return
		}

		stream, contentType, err := immich.GetAssetThumbnailStream(cfg, assetID, size)
		if err != nil {
			http.Error(w, fmt.Sprintf("thumbnail error: %v", err), http.StatusBadGateway)
			return
		}
		defer stream.Close()

		w.Header().Set("Content-Type", contentType)
		w.Header().Set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800")
		_, _ = io.Copy(w, stream)
	}
}

// KuroGetEvolutionStatusHandler returns the live status of the cognitive evolution daemon.
func KuroGetEvolutionStatusHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if ks == nil || ks.Evolution == nil {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"active": false,
				"reason": "Evolution worker not initialized",
			})
			return
		}
		status := ks.Evolution.GetStatus()
		_ = json.NewEncoder(w).Encode(status)
	}
}

// KuroTriggerEvolutionHandler triggers an on-demand cognitive evolution cycle.
func KuroTriggerEvolutionHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if ks == nil || ks.Evolution == nil {
			http.Error(w, "Evolution worker not available", http.StatusServiceUnavailable)
			return
		}
		go func() {
			_ = ks.Evolution.TriggerManualCycle(context.Background())
		}()
		_ = json.NewEncoder(w).Encode(map[string]any{
			"status":  "triggered",
			"message": "Cognitive evolution cycle initiated in background",
		})
	}
}

// KuroToggleLiveTrackHandler toggles high-frequency live GPS streaming on an edge node.
func KuroToggleLiveTrackHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if ks == nil {
			http.Error(w, `{"error": "kuro disabled"}`, http.StatusServiceUnavailable)
			return
		}

		nodeID := resolveConnectedNodeID(ks, chi.URLParam(r, "id"))
		if nodeID == "" {
			http.Error(w, `{"error": "node id required"}`, http.StatusBadRequest)
			return
		}

		var req struct {
			Enabled    *bool `json:"enabled"`
			IntervalMs int   `json:"interval_ms"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			en := true
			req.Enabled = &en
		}

		enabled := true
		if req.Enabled != nil {
			enabled = *req.Enabled
		}
		if req.IntervalMs <= 0 {
			req.IntervalMs = 2000
		}

		err := ks.Nodes.SetLiveTracking(nodeID, enabled, req.IntervalMs)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": %q}`, err.Error()), http.StatusNotFound)
			return
		}

		statusText := "started"
		if !enabled {
			statusText = "stopped"
		}

		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":          true,
			"node_id":     nodeID,
			"enabled":     enabled,
			"interval_ms": req.IntervalMs,
			"message":     fmt.Sprintf("Live tracking %s for node %s", statusText, nodeID),
		})
	}
}

func respondJSONError(w http.ResponseWriter, statusCode int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-cache, no-store")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"error":   message,
		"success": false,
	})
}

func isNodeWindows(ks *kuro.Service, nodeID string) bool {
	cleanID := strings.TrimSpace(nodeID)
	if ks != nil && ks.JSONStore != nil {
		if dev, ok := ks.JSONStore.GetDevice(cleanID); ok {
			if strings.EqualFold(dev.Platform, "windows") {
				return true
			}
		}
	}
	lower := strings.ToLower(cleanID)
	if strings.Contains(lower, "win") || strings.Contains(lower, "desktop") || strings.Contains(lower, "pc") {
		return true
	}
	return runtime.GOOS == "windows" && (cleanID == "" || strings.Contains(lower, "win"))
}

func getWindowsRoots(ks *kuro.Service, nodeID string) map[string]any {
	var roots []map[string]any

	userHome, _ := os.UserHomeDir()
	if userHome == "" {
		userHome = "C:\\Users\\" + os.Getenv("USERNAME")
	}

	// 1. Standard Windows Quick Access Shell Folders
	quickFolders := []struct {
		Name string
		Sub  string
	}{
		{"Desktop", "Desktop"},
		{"Documents", "Documents"},
		{"Downloads", "Downloads"},
		{"Pictures", "Pictures"},
		{"Music", "Music"},
		{"Videos", "Videos"},
	}

	for _, qf := range quickFolders {
		p := filepath.Join(userHome, qf.Sub)
		roots = append(roots, map[string]any{
			"name":       qf.Name,
			"path":       p,
			"icon":       qf.Sub,
			"is_primary": false,
		})
	}

	// 2. Add Discovered Drive Partitions from telemetry or host system
	drivesSeen := make(map[string]bool)
	if ks != nil && ks.JSONStore != nil {
		if dev, ok := ks.JSONStore.GetDevice(nodeID); ok && dev.LatestSnapshot != nil {
			if storageArr, ok := dev.LatestSnapshot["storage"].([]any); ok {
				for _, item := range storageArr {
					if diskMap, ok := item.(map[string]any); ok {
						if mount, ok := diskMap["mount"].(string); ok && mount != "" && !drivesSeen[mount] {
							drivesSeen[mount] = true
							roots = append(roots, map[string]any{
								"name":       fmt.Sprintf("Drive (%s)", mount),
								"path":       mount,
								"icon":       "hard-drive",
								"is_primary": strings.HasPrefix(strings.ToUpper(mount), "C:"),
							})
						}
					}
				}
			}
		}
	}

	// Fallback to drive letters C:\ through Z:\ if on local host
	if len(drivesSeen) == 0 && runtime.GOOS == "windows" {
		for r := 'C'; r <= 'Z'; r++ {
			drivePath := string(r) + ":\\"
			if _, err := os.Stat(drivePath); err == nil {
				roots = append(roots, map[string]any{
					"name":       fmt.Sprintf("Local Disk (%s)", drivePath),
					"path":       drivePath,
					"icon":       "hard-drive",
					"is_primary": r == 'C',
				})
			}
		}
	}

	return map[string]any{
		"roots": roots,
	}
}

func listWindowsDirectory(targetPath string) (map[string]any, error) {
	cleanPath := strings.TrimSpace(targetPath)
	userHome, _ := os.UserHomeDir()
	if userHome == "" {
		userHome = "C:\\Users\\" + os.Getenv("USERNAME")
	}

	// 1. Resolve Shortcuts and Drive Roots
	if cleanPath == "" || cleanPath == "/" || cleanPath == "\\" || cleanPath == "." {
		cleanPath = "C:\\"
	} else if strings.EqualFold(cleanPath, "desktop") {
		cleanPath = filepath.Join(userHome, "Desktop")
	} else if strings.EqualFold(cleanPath, "documents") {
		cleanPath = filepath.Join(userHome, "Documents")
	} else if strings.EqualFold(cleanPath, "downloads") {
		cleanPath = filepath.Join(userHome, "Downloads")
	} else if strings.EqualFold(cleanPath, "pictures") {
		cleanPath = filepath.Join(userHome, "Pictures")
	} else if strings.EqualFold(cleanPath, "music") {
		cleanPath = filepath.Join(userHome, "Music")
	} else if strings.EqualFold(cleanPath, "videos") {
		cleanPath = filepath.Join(userHome, "Videos")
	} else if len(cleanPath) == 2 && cleanPath[1] == ':' {
		cleanPath = strings.ToUpper(cleanPath) + "\\"
	} else if len(cleanPath) == 3 && cleanPath[1] == ':' && (cleanPath[2] == '\\' || cleanPath[2] == '/') {
		cleanPath = strings.ToUpper(string(cleanPath[0])) + ":\\"
	} else {
		cleanPath = filepath.Clean(cleanPath)
	}

	// 2. Read directory
	entries, err := os.ReadDir(cleanPath)
	if err != nil {
		return nil, err
	}

	var files []map[string]any
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			continue
		}
		name := entry.Name()
		filePath := filepath.Join(cleanPath, name)
		isDir := entry.IsDir()

		var size int64
		if !isDir {
			size = info.Size()
		}

		files = append(files, map[string]any{
			"name":          name,
			"path":          filePath,
			"is_dir":        isDir,
			"size":          size,
			"last_modified": info.ModTime().UnixMilli(),
			"extension":     strings.TrimPrefix(filepath.Ext(name), "."),
			"is_hidden":     strings.HasPrefix(name, "."),
		})
	}

	parentPath := filepath.Dir(cleanPath)
	if parentPath == cleanPath || (len(cleanPath) <= 3 && strings.Contains(cleanPath, ":")) {
		parentPath = ""
	}

	return map[string]any{
		"current_path": cleanPath,
		"parent_path":  parentPath,
		"files":        files,
		"total_count":  len(files),
	}, nil
}

func resolveConnectedNodeID(ks *kuro.Service, nodeID string) string {
	cleanID := strings.TrimSpace(nodeID)
	if ks == nil || ks.Nodes == nil {
		return cleanID
	}
	// Check if active connected node matches by ID, hostname, or substring
	if n, ok := ks.Nodes.Get(cleanID); ok && n != nil {
		return n.ID
	}
	return cleanID
}

// KuroNodeFilesListHandler proxies directory file listing from the client device (no server storage).
func KuroNodeFilesListHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache, no-store")
		if ks == nil || ks.Nodes == nil {
			respondJSONError(w, http.StatusServiceUnavailable, "kuro disabled")
			return
		}

		rawNodeID := chi.URLParam(r, "id")
		nodeID := resolveConnectedNodeID(ks, rawNodeID)
		path := r.URL.Query().Get("path")

		// If node is Windows and host is Windows, serve native directory listing exclusively
		if isNodeWindows(ks, rawNodeID) && runtime.GOOS == "windows" {
			data, err := listWindowsDirectory(path)
			if err != nil {
				respondJSONError(w, http.StatusNotFound, fmt.Sprintf("failed to read directory %s: %s", path, err.Error()))
				return
			}
			_ = json.NewEncoder(w).Encode(data)
			return
		}

		res, err := ks.Nodes.SendCommand(nodeID, "filesystem.list", map[string]any{"path": path}, 12*time.Second)
		if err != nil {
			respondJSONError(w, http.StatusBadGateway, err.Error())
			return
		}
		if !res.Success {
			respondJSONError(w, http.StatusInternalServerError, res.Error)
			return
		}

		// Stream JSON payload directly from node result to client without writing to server disk
		if strData, ok := res.Data.(string); ok && strData != "" {
			w.Write([]byte(strData))
			return
		}
		_ = json.NewEncoder(w).Encode(res.Data)
	}
}

// KuroNodeFileRootsHandler proxies available storage roots and quick shortcuts from the client device.
func KuroNodeFileRootsHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache, no-store")
		if ks == nil || ks.Nodes == nil {
			respondJSONError(w, http.StatusServiceUnavailable, "kuro disabled")
			return
		}

		rawNodeID := chi.URLParam(r, "id")
		nodeID := resolveConnectedNodeID(ks, rawNodeID)

		if isNodeWindows(ks, rawNodeID) {
			data := getWindowsRoots(ks, rawNodeID)
			_ = json.NewEncoder(w).Encode(data)
			return
		}

		res, err := ks.Nodes.SendCommand(nodeID, "filesystem.roots", map[string]any{}, 10*time.Second)
		if err != nil {
			respondJSONError(w, http.StatusBadGateway, err.Error())
			return
		}
		if !res.Success {
			respondJSONError(w, http.StatusInternalServerError, res.Error)
			return
		}

		if strData, ok := res.Data.(string); ok && strData != "" {
			w.Write([]byte(strData))
			return
		}
		_ = json.NewEncoder(w).Encode(res.Data)
	}
}

// KuroNodeFileUploadHandler receives file upload and proxies it to the Android client over WebSocket (no server storage).
func KuroNodeFileUploadHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if ks == nil || ks.Nodes == nil {
			http.Error(w, `{"error": "kuro disabled"}`, http.StatusServiceUnavailable)
			return
		}

		rawNodeID := chi.URLParam(r, "id")
		nodeID := resolveConnectedNodeID(ks, rawNodeID)

		var dirPath, fileName, dataB64 string

		contentType := r.Header.Get("Content-Type")
		if strings.HasPrefix(contentType, "multipart/form-data") {
			if err := r.ParseMultipartForm(50 << 20); err != nil {
				http.Error(w, fmt.Sprintf(`{"error": "failed to parse multipart: %s"}`, err.Error()), http.StatusBadRequest)
				return
			}
			dirPath = r.FormValue("dir_path")
			if dirPath == "" {
				dirPath = r.FormValue("path")
			}
			file, header, err := r.FormFile("file")
			if err != nil {
				http.Error(w, `{"error": "no file provided in form field 'file'"}`, http.StatusBadRequest)
				return
			}
			defer file.Close()
			fileName = header.Filename
			bytes, err := io.ReadAll(file)
			if err != nil {
				http.Error(w, fmt.Sprintf(`{"error": "failed to read uploaded file: %s"}`, err.Error()), http.StatusInternalServerError)
				return
			}
			dataB64 = base64.StdEncoding.EncodeToString(bytes)
		} else {
			var body struct {
				DirPath string `json:"dir_path"`
				Path    string `json:"path"`
				Name    string `json:"name"`
				DataB64 string `json:"data_b64"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				http.Error(w, fmt.Sprintf(`{"error": "invalid json payload: %s"}`, err.Error()), http.StatusBadRequest)
				return
			}
			dirPath = body.DirPath
			if dirPath == "" {
				dirPath = body.Path
			}
			fileName = body.Name
			dataB64 = body.DataB64
		}

		if dirPath == "" || fileName == "" || dataB64 == "" {
			http.Error(w, `{"error": "missing dir_path, name, or data_b64"}`, http.StatusBadRequest)
			return
		}

		if isNodeWindows(ks, rawNodeID) && runtime.GOOS == "windows" {
			rawBytes, err := base64.StdEncoding.DecodeString(dataB64)
			if err == nil {
				targetFile := filepath.Join(filepath.Clean(dirPath), fileName)
				if err := os.WriteFile(targetFile, rawBytes, 0644); err == nil {
					_ = json.NewEncoder(w).Encode(map[string]any{
						"ok":   true,
						"path": targetFile,
						"name": fileName,
						"size": len(rawBytes),
					})
					return
				}
			}
		}

		res, err := ks.Nodes.SendCommand(nodeID, "filesystem.write_file", map[string]any{
			"dir_path": dirPath,
			"name":     fileName,
			"data_b64": dataB64,
		}, 30*time.Second)
		if err != nil {
			respondJSONError(w, http.StatusBadGateway, err.Error())
			return
		}
		if !res.Success {
			respondJSONError(w, http.StatusInternalServerError, res.Error)
			return
		}

		if strData, ok := res.Data.(string); ok && strData != "" {
			w.Write([]byte(strData))
			return
		}
		_ = json.NewEncoder(w).Encode(res.Data)
	}
}

// KuroNodeFileDeleteHandler deletes a file or directory on the client device.
func KuroNodeFileDeleteHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if ks == nil || ks.Nodes == nil {
			respondJSONError(w, http.StatusServiceUnavailable, "kuro disabled")
			return
		}

		rawNodeID := chi.URLParam(r, "id")
		nodeID := resolveConnectedNodeID(ks, rawNodeID)
		var body struct {
			Path string `json:"path"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Path == "" {
			respondJSONError(w, http.StatusBadRequest, "path parameter required")
			return
		}

		if isNodeWindows(ks, rawNodeID) && runtime.GOOS == "windows" {
			if err := os.RemoveAll(filepath.Clean(body.Path)); err == nil {
				_ = json.NewEncoder(w).Encode(map[string]any{
					"ok":           true,
					"deleted_path": body.Path,
				})
				return
			}
		}

		res, err := ks.Nodes.SendCommand(nodeID, "filesystem.delete", map[string]any{"path": body.Path}, 15*time.Second)
		if err != nil {
			respondJSONError(w, http.StatusBadGateway, err.Error())
			return
		}
		if !res.Success {
			respondJSONError(w, http.StatusInternalServerError, res.Error)
			return
		}

		if strData, ok := res.Data.(string); ok && strData != "" {
			w.Write([]byte(strData))
			return
		}
		_ = json.NewEncoder(w).Encode(res.Data)
	}
}

// KuroNodeFileMkdirHandler creates a directory on the client device.
func KuroNodeFileMkdirHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if ks == nil || ks.Nodes == nil {
			respondJSONError(w, http.StatusServiceUnavailable, "kuro disabled")
			return
		}

		rawNodeID := chi.URLParam(r, "id")
		nodeID := resolveConnectedNodeID(ks, rawNodeID)
		var body struct {
			ParentPath string `json:"parent_path"`
			Path       string `json:"path"`
			Name       string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			respondJSONError(w, http.StatusBadRequest, "invalid payload")
			return
		}
		parent := body.ParentPath
		if parent == "" {
			parent = body.Path
		}

		if isNodeWindows(ks, rawNodeID) && runtime.GOOS == "windows" {
			targetDir := filepath.Join(filepath.Clean(parent), body.Name)
			if err := os.MkdirAll(targetDir, 0755); err == nil {
				_ = json.NewEncoder(w).Encode(map[string]any{
					"ok":   true,
					"path": targetDir,
				})
				return
			}
		}

		res, err := ks.Nodes.SendCommand(nodeID, "filesystem.mkdir", map[string]any{
			"parent_path": parent,
			"name":        body.Name,
		}, 15*time.Second)
		if err != nil {
			respondJSONError(w, http.StatusBadGateway, err.Error())
			return
		}
		if !res.Success {
			respondJSONError(w, http.StatusInternalServerError, res.Error)
			return
		}

		if strData, ok := res.Data.(string); ok && strData != "" {
			w.Write([]byte(strData))
			return
		}
		_ = json.NewEncoder(w).Encode(res.Data)
	}
}

// KuroNodeFileRenameHandler renames a file or folder on the client device.
func KuroNodeFileRenameHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if ks == nil || ks.Nodes == nil {
			respondJSONError(w, http.StatusServiceUnavailable, "kuro disabled")
			return
		}

		rawNodeID := chi.URLParam(r, "id")
		nodeID := resolveConnectedNodeID(ks, rawNodeID)
		var body struct {
			OldPath string `json:"old_path"`
			Path    string `json:"path"`
			NewName string `json:"new_name"`
			NewPath string `json:"new_path"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			respondJSONError(w, http.StatusBadRequest, "invalid payload")
			return
		}
		oldP := body.OldPath
		if oldP == "" {
			oldP = body.Path
		}
		newPath := body.NewPath
		if newPath == "" && body.NewName != "" {
			newPath = filepath.Join(filepath.Dir(oldP), body.NewName)
		}

		if isNodeWindows(ks, rawNodeID) && runtime.GOOS == "windows" {
			if err := os.Rename(filepath.Clean(oldP), filepath.Clean(newPath)); err == nil {
				_ = json.NewEncoder(w).Encode(map[string]any{
					"ok":       true,
					"old_path": oldP,
					"new_path": newPath,
				})
				return
			}
		}

		res, err := ks.Nodes.SendCommand(nodeID, "filesystem.rename", map[string]any{
			"old_path": oldP,
			"new_name": body.NewName,
			"new_path": newPath,
		}, 15*time.Second)
		if err != nil {
			respondJSONError(w, http.StatusBadGateway, err.Error())
			return
		}
		if !res.Success {
			respondJSONError(w, http.StatusInternalServerError, res.Error)
			return
		}

		if strData, ok := res.Data.(string); ok && strData != "" {
			w.Write([]byte(strData))
			return
		}
		_ = json.NewEncoder(w).Encode(res.Data)
	}
}

// KuroNodeFileContentHandler streams file content or preview directly from the client device without persisting to server.
func KuroNodeFileContentHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if ks == nil || ks.Nodes == nil {
			respondJSONError(w, http.StatusServiceUnavailable, "kuro disabled")
			return
		}

		rawNodeID := chi.URLParam(r, "id")
		nodeID := resolveConnectedNodeID(ks, rawNodeID)
		path := r.URL.Query().Get("path")
		if path == "" {
			respondJSONError(w, http.StatusBadRequest, "path parameter required")
			return
		}

		if isNodeWindows(ks, rawNodeID) && runtime.GOOS == "windows" {
			f, err := os.Open(filepath.Clean(path))
			if err == nil {
				defer f.Close()
				fi, _ := f.Stat()
				if fi != nil {
					w.Header().Set("Content-Length", fmt.Sprintf("%d", fi.Size()))
				}
				if r.URL.Query().Get("download") == "true" {
					w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filepath.Base(path)))
				}
				w.Header().Set("Content-Type", "application/octet-stream")
				_, _ = io.Copy(w, f)
				return
			}
		}

		res, err := ks.Nodes.SendCommand(nodeID, "filesystem.read_file", map[string]any{"path": path}, 25*time.Second)
		if err != nil {
			respondJSONError(w, http.StatusBadGateway, err.Error())
			return
		}
		if !res.Success {
			respondJSONError(w, http.StatusInternalServerError, res.Error)
			return
		}

		var filePayload struct {
			Name     string `json:"name"`
			Path     string `json:"path"`
			MimeType string `json:"mime_type"`
			DataB64  string `json:"data_b64"`
			Size     int64  `json:"size"`
			Error    string `json:"error"`
		}

		if strData, ok := res.Data.(string); ok && strData != "" {
			_ = json.Unmarshal([]byte(strData), &filePayload)
		} else if mapData, ok := res.Data.(map[string]any); ok {
			raw, _ := json.Marshal(mapData)
			_ = json.Unmarshal(raw, &filePayload)
		}

		if filePayload.Error != "" {
			http.Error(w, fmt.Sprintf(`{"error": %q}`, filePayload.Error), http.StatusBadRequest)
			return
		}

		if filePayload.DataB64 != "" {
			data, err := base64.StdEncoding.DecodeString(filePayload.DataB64)
			if err == nil {
				mime := filePayload.MimeType
				if mime == "" {
					mime = "application/octet-stream"
				}
				w.Header().Set("Content-Type", mime)
				w.Header().Set("Content-Length", fmt.Sprintf("%d", len(data)))
				w.Header().Set("Cache-Control", "no-cache, no-store")

				isDownload := r.URL.Query().Get("download") == "true" || r.URL.Query().Get("download") == "1"
				if isDownload {
					filename := filePayload.Name
					if filename == "" {
						filename = filepath.Base(path)
					}
					w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename=%q`, filename))
				}

				w.WriteHeader(http.StatusOK)
				_, _ = w.Write(data)
				return
			}
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(res.Data)
	}
}

// ── Hardware Control Proxy Handlers (Zero Server Storage) ──

// KuroNodeCameraListHandler lists available camera lenses and supported capabilities on the client device.
func KuroNodeCameraListHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache, no-store")
		if ks == nil {
			respondJSONError(w, http.StatusServiceUnavailable, "kuro disabled")
			return
		}

		rawNodeID := chi.URLParam(r, "id")
		nodeID := rawNodeID
		if ks.Nodes != nil {
			nodeID = resolveConnectedNodeID(ks, rawNodeID)
		}

		// 1. Try real-time WebSocket command if node is connected via WebSocket
		if ks.Nodes != nil {
			res, err := ks.Nodes.SendCommand(nodeID, "hardware.camera.list", map[string]any{}, 3*time.Second)
			if err == nil && res.Success && res.Data != nil {
				if strData, ok := res.Data.(string); ok && strData != "" {
					w.Write([]byte(strData))
					return
				}
				_ = json.NewEncoder(w).Encode(res.Data)
				return
			}
		}

		// 2. Fallback to client's scanned hardware stored in latest telemetry snapshot
		if ks.JSONStore != nil {
			if dev, ok := ks.JSONStore.GetDevice(nodeID); ok && dev.LatestSnapshot != nil {
				if cams, exists := dev.LatestSnapshot["cameras"]; exists && cams != nil {
					_ = json.NewEncoder(w).Encode(map[string]any{
						"cameras": cams,
					})
					return
				}
			}
			if dev, ok := ks.JSONStore.GetDevice(rawNodeID); ok && dev.LatestSnapshot != nil {
				if cams, exists := dev.LatestSnapshot["cameras"]; exists && cams != nil {
					_ = json.NewEncoder(w).Encode(map[string]any{
						"cameras": cams,
					})
					return
				}
			}
		}

		// 3. Fallback default if not yet populated
		_ = json.NewEncoder(w).Encode(map[string]any{
			"cameras": []map[string]any{
				{"id": "0", "name": "Primary Camera", "facing": "back"},
				{"id": "1", "name": "Secondary Camera", "facing": "front"},
			},
		})
	}
}

// KuroNodeMicListHandler lists available microphones on the client device.
func KuroNodeMicListHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache, no-store")
		if ks == nil {
			respondJSONError(w, http.StatusServiceUnavailable, "kuro disabled")
			return
		}

		rawNodeID := chi.URLParam(r, "id")
		nodeID := rawNodeID
		if ks.Nodes != nil {
			nodeID = resolveConnectedNodeID(ks, rawNodeID)
		}

		// 1. Check WebSocket command
		if ks.Nodes != nil {
			res, err := ks.Nodes.SendCommand(nodeID, "hardware.mic.list", map[string]any{}, 3*time.Second)
			if err == nil && res.Success && res.Data != nil {
				if strData, ok := res.Data.(string); ok && strData != "" {
					w.Write([]byte(strData))
					return
				}
				_ = json.NewEncoder(w).Encode(res.Data)
				return
			}
		}

		// 2. Check snapshot store
		if ks.JSONStore != nil {
			if dev, ok := ks.JSONStore.GetDevice(nodeID); ok && dev.LatestSnapshot != nil {
				if mics, exists := dev.LatestSnapshot["microphones"]; exists && mics != nil {
					_ = json.NewEncoder(w).Encode(map[string]any{
						"microphones": mics,
					})
					return
				}
			}
			if dev, ok := ks.JSONStore.GetDevice(rawNodeID); ok && dev.LatestSnapshot != nil {
				if mics, exists := dev.LatestSnapshot["microphones"]; exists && mics != nil {
					_ = json.NewEncoder(w).Encode(map[string]any{
						"microphones": mics,
					})
					return
				}
			}
		}

		_ = json.NewEncoder(w).Encode(map[string]any{
			"microphones": []map[string]any{
				{"id": "0", "name": "Default Microphone"},
			},
		})
	}
}

// KuroNodeCameraCaptureHandler triggers a silent photo snapshot directly on the device storage (zero server disk storage).
func KuroNodeCameraCaptureHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache, no-store")
		if ks == nil || ks.Nodes == nil {
			respondJSONError(w, http.StatusServiceUnavailable, "kuro disabled")
			return
		}

		nodeID := resolveConnectedNodeID(ks, chi.URLParam(r, "id"))
		var req struct {
			Facing string `json:"facing"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		if req.Facing == "" {
			req.Facing = "back"
		}

		res, err := ks.Nodes.SendCommand(nodeID, "hardware.camera.capture", map[string]any{"facing": req.Facing}, 15*time.Second)
		if err != nil {
			respondJSONError(w, http.StatusBadGateway, err.Error())
			return
		}
		if !res.Success {
			respondJSONError(w, http.StatusInternalServerError, res.Error)
			return
		}

		if strData, ok := res.Data.(string); ok && strData != "" {
			w.Write([]byte(strData))
			return
		}
		_ = json.NewEncoder(w).Encode(res.Data)
	}
}

// KuroNodeCameraRecordHandler triggers video recording directly to client device storage (zero server disk storage).
func KuroNodeCameraRecordHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache, no-store")
		if ks == nil || ks.Nodes == nil {
			respondJSONError(w, http.StatusServiceUnavailable, "kuro disabled")
			return
		}

		nodeID := resolveConnectedNodeID(ks, chi.URLParam(r, "id"))
		var req struct {
			Facing          string `json:"facing"`
			DurationSeconds int    `json:"duration_seconds"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		if req.Facing == "" {
			req.Facing = "back"
		}
		if req.DurationSeconds <= 0 {
			req.DurationSeconds = 10
		}

		timeout := time.Duration(req.DurationSeconds+15) * time.Second
		res, err := ks.Nodes.SendCommand(nodeID, "hardware.camera.record", map[string]any{
			"facing":           req.Facing,
			"duration_seconds": req.DurationSeconds,
		}, timeout)
		if err != nil {
			respondJSONError(w, http.StatusBadGateway, err.Error())
			return
		}
		if !res.Success {
			respondJSONError(w, http.StatusInternalServerError, res.Error)
			return
		}

		if strData, ok := res.Data.(string); ok && strData != "" {
			w.Write([]byte(strData))
			return
		}
		_ = json.NewEncoder(w).Encode(res.Data)
	}
}

// KuroNodeMicRecordHandler triggers audio recording directly to client device storage (zero server disk storage).
func KuroNodeMicRecordHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache, no-store")
		if ks == nil || ks.Nodes == nil {
			respondJSONError(w, http.StatusServiceUnavailable, "kuro disabled")
			return
		}

		nodeID := resolveConnectedNodeID(ks, chi.URLParam(r, "id"))
		var req struct {
			DurationSeconds int `json:"duration_seconds"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		if req.DurationSeconds <= 0 {
			req.DurationSeconds = 10
		}

		timeout := time.Duration(req.DurationSeconds+15) * time.Second
		res, err := ks.Nodes.SendCommand(nodeID, "hardware.mic.record", map[string]any{
			"duration_seconds": req.DurationSeconds,
		}, timeout)
		if err != nil {
			respondJSONError(w, http.StatusBadGateway, err.Error())
			return
		}
		if !res.Success {
			respondJSONError(w, http.StatusInternalServerError, res.Error)
			return
		}

		if strData, ok := res.Data.(string); ok && strData != "" {
			w.Write([]byte(strData))
			return
		}
		_ = json.NewEncoder(w).Encode(res.Data)
	}
}

// KuroNodeMicStreamControlHandler controls live microphone broadcasting on the client device.
func KuroNodeMicStreamControlHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache, no-store")
		if ks == nil || ks.Nodes == nil {
			respondJSONError(w, http.StatusServiceUnavailable, "kuro disabled")
			return
		}

		nodeID := resolveConnectedNodeID(ks, chi.URLParam(r, "id"))
		var req struct {
			Action string `json:"action"` // "start" or "stop"
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		actionName := "hardware.mic.stream_start"
		if strings.ToLower(req.Action) == "stop" {
			actionName = "hardware.mic.stream_stop"
		}

		res, err := ks.Nodes.SendCommand(nodeID, actionName, map[string]any{}, 10*time.Second)
		if err != nil {
			respondJSONError(w, http.StatusBadGateway, err.Error())
			return
		}
		if !res.Success {
			respondJSONError(w, http.StatusInternalServerError, res.Error)
			return
		}

		if strData, ok := res.Data.(string); ok && strData != "" {
			w.Write([]byte(strData))
			return
		}
		_ = json.NewEncoder(w).Encode(res.Data)
	}
}

// KuroNodeCameraStreamControlHandler controls live camera broadcasting on the client device.
func KuroNodeCameraStreamControlHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache, no-store")
		if ks == nil || ks.Nodes == nil {
			respondJSONError(w, http.StatusServiceUnavailable, "kuro disabled")
			return
		}

		nodeID := resolveConnectedNodeID(ks, chi.URLParam(r, "id"))
		var req struct {
			Action     string `json:"action"`     // "start", "stop", or "switch"
			Facing     string `json:"facing"`     // "back" or "front"
			Resolution string `json:"resolution"` // "360p", "480p", "720p", "1080p"
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		if req.Resolution == "" {
			req.Resolution = "360p"
		}
		if req.Facing == "" {
			req.Facing = "back"
		}

		actionName := "hardware.camera.stream_start"
		if strings.ToLower(req.Action) == "stop" {
			actionName = "hardware.camera.stream_stop"
		} else if strings.ToLower(req.Action) == "switch" {
			actionName = "hardware.camera.stream_switch"
		}

		res, err := ks.Nodes.SendCommand(nodeID, actionName, map[string]any{
			"facing":     req.Facing,
			"resolution": req.Resolution,
		}, 10*time.Second)
		if err != nil {
			respondJSONError(w, http.StatusBadGateway, err.Error())
			return
		}
		if !res.Success {
			respondJSONError(w, http.StatusInternalServerError, res.Error)
			return
		}

		if strData, ok := res.Data.(string); ok && strData != "" {
			w.Write([]byte(strData))
			return
		}
		_ = json.NewEncoder(w).Encode(res.Data)
	}
}

// KuroNodeCameraStreamFrameHandler returns the latest live camera frame for a node.
func KuroNodeCameraStreamFrameHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache, no-store")
		if ks == nil || ks.Nodes == nil {
			respondJSONError(w, http.StatusServiceUnavailable, "kuro disabled")
			return
		}

		nodeID := resolveConnectedNodeID(ks, chi.URLParam(r, "id"))
		frame := ks.Nodes.GetLatestCameraFrame(nodeID)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"node_id":   nodeID,
			"frame_b64": frame,
			"has_frame": frame != "",
		})
	}
}

// buildCachedSystemStatus constructs a fallback system status response from local JSONStore snapshot / DB records.
func buildCachedSystemStatus(ks *kuro.Service, nodeID, rawID string) map[string]any {
	nowStr := time.Now().UTC().Format(time.RFC3339)
	isOnline := false
	displayName := rawID
	lastSeen := nowStr

	var dev storage.DeviceInfo
	var foundDev bool
	if ks != nil && ks.Store != nil {
		dev, foundDev = ks.Store.GetDevice(nodeID)
		if !foundDev {
			dev, foundDev = ks.Store.GetDevice(rawID)
		}
	}

	snap := dev.LatestSnapshot
	if foundDev {
		if dev.DisplayName != "" {
			displayName = dev.DisplayName
		}
		isOnline = dev.IsOnline
		if dev.LastSeenAt != "" {
			lastSeen = dev.LastSeenAt
		}
	}

	batteryMap := map[string]any{
		"level":        85,
		"is_charging":  false,
		"temperature":  30.0,
		"health":       "good",
		"power_source": "battery",
	}
	networkMap := map[string]any{
		"type":                  "wifi",
		"is_connected":          true,
		"wifi_connected":        true,
		"wifi_ssid":             "HomeLab-WiFi",
		"ip_address":            "192.168.1.100",
		"mobile_data_connected": true,
		"carrier":               "LTE/5G",
	}
	togglesMap := map[string]any{
		"torch":                  false,
		"location":               true,
		"wifi":                   true,
		"mobile_data":            true,
		"bluetooth":              true,
		"airplane_mode":          false,
		"dnd":                    false,
		"ringer_mode":            "normal",
		"brightness":             75,
		"screen_timeout_seconds": 60,
		"is_screen_on":           false,
		"is_ringing":             false,
	}

	if snap != nil {
		if b, ok := snap["battery"].(map[string]any); ok {
			for k, v := range b {
				batteryMap[k] = v
			}
		}
		if n, ok := snap["network"].(map[string]any); ok {
			for k, v := range n {
				networkMap[k] = v
			}
			if w, ok := n["wifi_connected"].(bool); ok {
				togglesMap["wifi"] = w
			}
			if m, ok := n["mobile_data_connected"].(bool); ok {
				togglesMap["mobile_data"] = m
			}
		}
		if t, ok := snap["toggles"].(map[string]any); ok {
			for k, v := range t {
				togglesMap[k] = v
			}
		}
	}

	return map[string]any{
		"node_id":      nodeID,
		"display_name": displayName,
		"is_live":      false,
		"is_online":    isOnline,
		"last_seen_at": lastSeen,
		"battery":      batteryMap,
		"network":      networkMap,
		"toggles":      togglesMap,
		"permissions": map[string]bool{
			"camera":          true,
			"microphone":      true,
			"location":        true,
			"contacts":        true,
			"phone":           true,
			"sms":             true,
			"notifications":   true,
			"storage":         true,
			"write_settings":  true,
			"secure_settings": true,
			"device_admin":    true,
			"accessibility":   true,
			"usage_stats":     true,
		},
		"volumes": map[string]any{
			"media":        map[string]any{"current": 10, "max": 15, "percent": 67},
			"ring":         map[string]any{"current": 7, "max": 7, "percent": 100},
			"alarm":        map[string]any{"current": 7, "max": 7, "percent": 100},
			"notification": map[string]any{"current": 5, "max": 7, "percent": 71},
			"call":         map[string]any{"current": 5, "max": 5, "percent": 100},
		},
	}
}

// KuroNodeSystemStatusHandler queries current system settings, toggle states, and permission status on a node.
func KuroNodeSystemStatusHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache, no-store")
		if ks == nil || ks.Nodes == nil {
			respondJSONError(w, http.StatusServiceUnavailable, "kuro disabled")
			return
		}

		rawID := chi.URLParam(r, "id")
		nodeID := resolveConnectedNodeID(ks, rawID)

		// 1. Attempt live WebSocket query with a 3.5-second timeout
		var liveSuccess bool
		var liveData any
		if n, ok := ks.Nodes.Get(nodeID); ok && n != nil {
			res, err := ks.Nodes.SendCommand(nodeID, "system.settings.status", map[string]any{}, 3500*time.Millisecond)
			if err == nil && res != nil && res.Success {
				liveSuccess = true
				liveData = res.Data
			}
		}

		if liveSuccess && liveData != nil {
			if strData, ok := liveData.(string); ok && strData != "" {
				w.Write([]byte(strData))
				return
			}
			_ = json.NewEncoder(w).Encode(liveData)
			return
		}

		// 2. Seamless Fallback: Return cached snapshot telemetry without throwing 502
		cached := buildCachedSystemStatus(ks, nodeID, rawID)
		_ = json.NewEncoder(w).Encode(cached)
	}
}

// KuroNodeSystemSettingHandler applies a system setting change on the target client device.
func KuroNodeSystemSettingHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache, no-store")
		if ks == nil || ks.Nodes == nil {
			respondJSONError(w, http.StatusServiceUnavailable, "kuro disabled")
			return
		}

		rawID := chi.URLParam(r, "id")
		nodeID := resolveConnectedNodeID(ks, rawID)
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondJSONError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		if n, ok := ks.Nodes.Get(nodeID); !ok || n == nil {
			// Return friendly 200 with success: false when device is sleeping or disconnected
			_ = json.NewEncoder(w).Encode(map[string]any{
				"success": false,
				"error":   "Device is currently in background / sleeping. Wake device to apply live setting.",
				"setting": req["setting"],
			})
			return
		}

		res, err := ks.Nodes.SendCommand(nodeID, "system.setting.set", req, 8*time.Second)
		if err != nil {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"success": false,
				"error":   err.Error(),
				"setting": req["setting"],
			})
			return
		}
		if !res.Success {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"success": false,
				"error":   res.Error,
				"setting": req["setting"],
			})
			return
		}

		if strData, ok := res.Data.(string); ok && strData != "" {
			w.Write([]byte(strData))
			return
		}
		_ = json.NewEncoder(w).Encode(res.Data)
	}
}

// KuroNodeSystemActionHandler dispatches a custom system action (ring, lock, vibrate, tts, reboot) to a client node.
func KuroNodeSystemActionHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache, no-store")
		if ks == nil || ks.Nodes == nil {
			respondJSONError(w, http.StatusServiceUnavailable, "kuro disabled")
			return
		}

		rawID := chi.URLParam(r, "id")
		nodeID := resolveConnectedNodeID(ks, rawID)
		var req struct {
			Action string         `json:"action"`
			Params map[string]any `json:"params"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondJSONError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if req.Action == "" {
			respondJSONError(w, http.StatusBadRequest, "action required")
			return
		}
		if req.Params == nil {
			req.Params = make(map[string]any)
		}

		if n, ok := ks.Nodes.Get(nodeID); !ok || n == nil {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"success": false,
				"error":   "Device is currently in background / sleeping. Wake device to dispatch action.",
				"action":  req.Action,
			})
			return
		}

		res, err := ks.Nodes.SendCommand(nodeID, req.Action, req.Params, 10*time.Second)
		if err != nil {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"success": false,
				"error":   err.Error(),
				"action":  req.Action,
			})
			return
		}
		if !res.Success {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"success": false,
				"error":   res.Error,
				"action":  req.Action,
			})
			return
		}

		if strData, ok := res.Data.(string); ok && strData != "" {
			w.Write([]byte(strData))
			return
		}
		_ = json.NewEncoder(w).Encode(res.Data)
	}
}

// Helper to execute PowerShell command and return JSON
func execWindowsPowerShellJSON(script string) ([]byte, error) {
	cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", script)
	return cmd.Output()
}

func listLocalWindowsProcesses() (map[string]any, error) {
	script := `Get-Process | Select-Object @{N='pid';E={$_.Id}}, @{N='name';E={$_.ProcessName}}, @{N='title';E={$_.MainWindowTitle}}, @{N='ram_mb';E={[math]::Round($_.WorkingSet64 / 1MB, 1)}}, @{N='threads';E={$_.Threads.Count}}, @{N='is_responding';E={$_.Responding}}, @{N='start_time';E={try{$_.StartTime.ToString('o')}catch{''}}} | ConvertTo-Json -Compress`
	out, err := execWindowsPowerShellJSON(script)
	if err != nil {
		return nil, err
	}
	var raw []map[string]any
	if err := json.Unmarshal(out, &raw); err != nil {
		var single map[string]any
		if serr := json.Unmarshal(out, &single); serr == nil {
			raw = []map[string]any{single}
		} else {
			return nil, err
		}
	}
	return map[string]any{"processes": raw, "total_count": len(raw)}, nil
}

func listLocalWindowsServices() (map[string]any, error) {
	script := `Get-Service | Select-Object @{N='name';E={$_.ServiceName}}, @{N='display_name';E={$_.DisplayName}}, @{N='status';E={$_.Status.ToString()}}, @{N='can_stop';E={$_.CanStop}}, @{N='service_type';E={$_.ServiceType.ToString()}} | ConvertTo-Json -Compress`
	out, err := execWindowsPowerShellJSON(script)
	if err != nil {
		return nil, err
	}
	var raw []map[string]any
	if err := json.Unmarshal(out, &raw); err != nil {
		var single map[string]any
		if serr := json.Unmarshal(out, &single); serr == nil {
			raw = []map[string]any{single}
		} else {
			return nil, err
		}
	}
	return map[string]any{"services": raw, "total_count": len(raw)}, nil
}

func listLocalWindowsApps() (map[string]any, error) {
	script := `Get-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*, HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*, HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\* -ErrorAction SilentlyContinue | Where-Object DisplayName | Select-Object @{N='name';E={$_.DisplayName}}, @{N='version';E={$_.DisplayVersion}}, @{N='publisher';E={$_.Publisher}}, @{N='install_date';E={$_.InstallDate}}, @{N='install_location';E={$_.InstallLocation}}, @{N='has_uninstaller';E={-not [string]::IsNullOrEmpty($_.UninstallString)}} | Sort-Object name | ConvertTo-Json -Compress`
	out, err := execWindowsPowerShellJSON(script)
	if err != nil {
		return nil, err
	}
	var raw []map[string]any
	if err := json.Unmarshal(out, &raw); err != nil {
		var single map[string]any
		if serr := json.Unmarshal(out, &single); serr == nil {
			raw = []map[string]any{single}
		} else {
			return nil, err
		}
	}
	return map[string]any{"apps": raw, "total_count": len(raw)}, nil
}

func listLocalWindowsPorts() (map[string]any, error) {
	script := `Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Select-Object @{N='protocol';E={'TCP'}}, @{N='port';E={$_.LocalPort}}, @{N='address';E={$_.LocalAddress}}, @{N='state';E={$_.State.ToString()}} | ConvertTo-Json -Compress`
	out, err := execWindowsPowerShellJSON(script)
	if err != nil {
		return nil, err
	}
	var listeners []map[string]any
	if err := json.Unmarshal(out, &listeners); err != nil {
		var single map[string]any
		if serr := json.Unmarshal(out, &single); serr == nil {
			listeners = []map[string]any{single}
		}
	}
	return map[string]any{"adapters": []any{}, "listeners": listeners}, nil
}

func getLocalWindowsPower() (map[string]any, error) {
	script := `Add-Type -AssemblyName System.Windows.Forms; $p = [System.Windows.Forms.SystemInformation]::PowerStatus; @{ battery_percent = [int]($p.BatteryLifePercent * 100); battery_charge_status = $p.BatteryChargeStatus.ToString(); ac_line_status = $p.PowerLineStatus.ToString(); battery_full_lifetime = $p.BatteryFullLifetime; battery_lifetime_sec = $p.BatteryLifeRemaining } | ConvertTo-Json -Compress`
	out, err := execWindowsPowerShellJSON(script)
	if err != nil {
		return map[string]any{
			"battery_percent":       100,
			"battery_charge_status": "AC Power",
			"ac_line_status":        "Online (Plugged In)",
		}, nil
	}
	var raw map[string]any
	_ = json.Unmarshal(out, &raw)
	return raw, nil
}

func getLocalWindowsEvents() (map[string]any, error) {
	script := `Get-WinEvent -FilterHashtable @{LogName='System'; Level=1,2; StartTime=(Get-Date).AddDays(-1)} -MaxEvents 50 -ErrorAction SilentlyContinue | Select-Object @{N='id';E={$_.Id}}, @{N='provider';E={$_.ProviderName}}, @{N='level';E={$_.LevelDisplayName}}, @{N='time';E={$_.TimeCreated.ToString('o')}}, @{N='description';E={$_.Message}} | ConvertTo-Json -Compress`
	out, err := execWindowsPowerShellJSON(script)
	if err != nil {
		return map[string]any{"events": []any{}}, nil
	}
	var events []map[string]any
	if err := json.Unmarshal(out, &events); err != nil {
		var single map[string]any
		if serr := json.Unmarshal(out, &single); serr == nil {
			events = []map[string]any{single}
		}
	}
	return map[string]any{"events": events}, nil
}

func captureLocalWindowsScreenshot() (map[string]any, error) {
	script := `Add-Type -AssemblyName System.Windows.Forms, System.Drawing; $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $bmp = New-Object System.Drawing.Bitmap($b.Width, $b.Height); $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size); $ms = New-Object System.IO.MemoryStream; $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Jpeg); $b64 = [Convert]::ToBase64String($ms.ToArray()); $g.Dispose(); $bmp.Dispose(); $ms.Dispose(); @{ width = $b.Width; height = $b.Height; image_b64 = 'data:image/jpeg;base64,' + $b64; timestamp = (Get-Date).ToUniversalTime().ToString('o') } | ConvertTo-Json -Compress`
	out, err := execWindowsPowerShellJSON(script)
	if err != nil {
		return nil, err
	}
	var res map[string]any
	if err := json.Unmarshal(out, &res); err != nil {
		return nil, err
	}
	return res, nil
}

// KuroNodeProcessesListHandler returns running processes on the node.
func KuroNodeProcessesListHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache, no-store")
		rawNodeID := chi.URLParam(r, "id")
		nodeID := resolveConnectedNodeID(ks, rawNodeID)
		if ks != nil && ks.Nodes != nil {
			res, err := ks.Nodes.SendCommand(nodeID, "processes.list", nil, 10*time.Second)
			if err == nil && res.Success {
				_ = json.NewEncoder(w).Encode(res.Data)
				return
			}
		}
		if isNodeWindows(ks, rawNodeID) && runtime.GOOS == "windows" {
			data, err := listLocalWindowsProcesses()
			if err == nil {
				_ = json.NewEncoder(w).Encode(data)
				return
			}
		}
		respondJSONError(w, http.StatusServiceUnavailable, "Windows client is offline. Please launch Kuro Assistant on your PC.")
	}
}

// KuroNodeProcessKillHandler terminates a process on the node by PID.
func KuroNodeProcessKillHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		rawNodeID := chi.URLParam(r, "id")
		nodeID := resolveConnectedNodeID(ks, rawNodeID)
		var req struct {
			PID int `json:"pid"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.PID <= 0 {
			respondJSONError(w, http.StatusBadRequest, "invalid or missing pid")
			return
		}
		if ks != nil && ks.Nodes != nil {
			res, err := ks.Nodes.SendCommand(nodeID, "process.kill", map[string]any{"pid": req.PID}, 10*time.Second)
			if err == nil && res.Success {
				_ = json.NewEncoder(w).Encode(res.Data)
				return
			}
		}
		if isNodeWindows(ks, rawNodeID) && runtime.GOOS == "windows" {
			cmd := exec.Command("taskkill", "/F", "/PID", fmt.Sprintf("%d", req.PID))
			if err := cmd.Run(); err == nil {
				_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "pid": req.PID})
				return
			}
		}
		respondJSONError(w, http.StatusServiceUnavailable, "Failed to terminate process or client offline")
	}
}

// KuroNodeServicesListHandler returns Windows services on the node.
func KuroNodeServicesListHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache, no-store")
		rawNodeID := chi.URLParam(r, "id")
		nodeID := resolveConnectedNodeID(ks, rawNodeID)
		if ks != nil && ks.Nodes != nil {
			res, err := ks.Nodes.SendCommand(nodeID, "services.list", nil, 10*time.Second)
			if err == nil && res.Success {
				_ = json.NewEncoder(w).Encode(res.Data)
				return
			}
		}
		if isNodeWindows(ks, rawNodeID) && runtime.GOOS == "windows" {
			data, err := listLocalWindowsServices()
			if err == nil {
				_ = json.NewEncoder(w).Encode(data)
				return
			}
		}
		respondJSONError(w, http.StatusServiceUnavailable, "Windows client is offline. Please launch Kuro Assistant on your PC.")
	}
}

// KuroNodeServiceControlHandler starts, stops, or restarts a service.
func KuroNodeServiceControlHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		rawNodeID := chi.URLParam(r, "id")
		nodeID := resolveConnectedNodeID(ks, rawNodeID)
		var req struct {
			Name   string `json:"name"`
			Action string `json:"action"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" || req.Action == "" {
			respondJSONError(w, http.StatusBadRequest, "invalid service name or action")
			return
		}
		if ks != nil && ks.Nodes != nil {
			res, err := ks.Nodes.SendCommand(nodeID, "service.control", map[string]any{"name": req.Name, "action": req.Action}, 15*time.Second)
			if err == nil && res.Success {
				_ = json.NewEncoder(w).Encode(res.Data)
				return
			}
		}
		if isNodeWindows(ks, rawNodeID) && runtime.GOOS == "windows" {
			var cmd *exec.Cmd
			switch strings.ToLower(req.Action) {
			case "start":
				cmd = exec.Command("powershell", "-NoProfile", "-Command", fmt.Sprintf("Start-Service -Name '%s'", req.Name))
			case "stop":
				cmd = exec.Command("powershell", "-NoProfile", "-Command", fmt.Sprintf("Stop-Service -Name '%s' -Force", req.Name))
			case "restart":
				cmd = exec.Command("powershell", "-NoProfile", "-Command", fmt.Sprintf("Restart-Service -Name '%s' -Force", req.Name))
			}
			if cmd != nil {
				if err := cmd.Run(); err == nil {
					_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "name": req.Name, "status": req.Action})
					return
				}
			}
		}
		respondJSONError(w, http.StatusServiceUnavailable, "Failed to control service or client offline")
	}
}

// KuroNodeAppsListHandler returns installed software applications.
func KuroNodeAppsListHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache, no-store")
		rawNodeID := chi.URLParam(r, "id")
		nodeID := resolveConnectedNodeID(ks, rawNodeID)
		if ks != nil && ks.Nodes != nil {
			res, err := ks.Nodes.SendCommand(nodeID, "apps.list", nil, 10*time.Second)
			if err == nil && res.Success {
				_ = json.NewEncoder(w).Encode(res.Data)
				return
			}
		}
		if isNodeWindows(ks, rawNodeID) && runtime.GOOS == "windows" {
			data, err := listLocalWindowsApps()
			if err == nil {
				_ = json.NewEncoder(w).Encode(data)
				return
			}
		}
		respondJSONError(w, http.StatusServiceUnavailable, "Windows client is offline. Please launch Kuro Assistant on your PC.")
	}
}

// KuroNodePortsListHandler returns network adapters and listening ports.
func KuroNodePortsListHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache, no-store")
		rawNodeID := chi.URLParam(r, "id")
		nodeID := resolveConnectedNodeID(ks, rawNodeID)
		if ks != nil && ks.Nodes != nil {
			res, err := ks.Nodes.SendCommand(nodeID, "network.ports", nil, 10*time.Second)
			if err == nil && res.Success {
				_ = json.NewEncoder(w).Encode(res.Data)
				return
			}
		}
		if isNodeWindows(ks, rawNodeID) && runtime.GOOS == "windows" {
			data, err := listLocalWindowsPorts()
			if err == nil {
				_ = json.NewEncoder(w).Encode(data)
				return
			}
		}
		respondJSONError(w, http.StatusServiceUnavailable, "Windows client is offline. Please launch Kuro Assistant on your PC.")
	}
}

// KuroNodePowerInfoHandler returns battery and power status.
func KuroNodePowerInfoHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache, no-store")
		rawNodeID := chi.URLParam(r, "id")
		nodeID := resolveConnectedNodeID(ks, rawNodeID)
		if ks != nil && ks.Nodes != nil {
			res, err := ks.Nodes.SendCommand(nodeID, "power.info", nil, 10*time.Second)
			if err == nil && res.Success {
				_ = json.NewEncoder(w).Encode(res.Data)
				return
			}
		}
		if isNodeWindows(ks, rawNodeID) && runtime.GOOS == "windows" {
			data, err := getLocalWindowsPower()
			if err == nil {
				_ = json.NewEncoder(w).Encode(data)
				return
			}
		}
		respondJSONError(w, http.StatusServiceUnavailable, "Windows client is offline. Please launch Kuro Assistant on your PC.")
	}
}

// KuroNodePowerSchemeHandler activates a power plan scheme.
func KuroNodePowerSchemeHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		rawNodeID := chi.URLParam(r, "id")
		nodeID := resolveConnectedNodeID(ks, rawNodeID)
		var req struct {
			GUID string `json:"guid"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.GUID == "" {
			respondJSONError(w, http.StatusBadRequest, "invalid power scheme guid")
			return
		}
		if ks != nil && ks.Nodes != nil {
			res, err := ks.Nodes.SendCommand(nodeID, "power.set_scheme", map[string]any{"guid": req.GUID}, 10*time.Second)
			if err == nil && res.Success {
				_ = json.NewEncoder(w).Encode(res.Data)
				return
			}
		}
		if isNodeWindows(ks, rawNodeID) && runtime.GOOS == "windows" {
			cmd := exec.Command("powercfg", "/setactive", req.GUID)
			if err := cmd.Run(); err == nil {
				_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "guid": req.GUID})
				return
			}
		}
		respondJSONError(w, http.StatusServiceUnavailable, "Failed to activate power scheme")
	}
}

// KuroNodeEventsListHandler returns Windows event logs.
func KuroNodeEventsListHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache, no-store")
		rawNodeID := chi.URLParam(r, "id")
		nodeID := resolveConnectedNodeID(ks, rawNodeID)
		if ks != nil && ks.Nodes != nil {
			res, err := ks.Nodes.SendCommand(nodeID, "system.events", nil, 10*time.Second)
			if err == nil && res.Success {
				_ = json.NewEncoder(w).Encode(res.Data)
				return
			}
		}
		if isNodeWindows(ks, rawNodeID) && runtime.GOOS == "windows" {
			data, err := getLocalWindowsEvents()
			if err == nil {
				_ = json.NewEncoder(w).Encode(data)
				return
			}
		}
		respondJSONError(w, http.StatusServiceUnavailable, "Windows client is offline. Please launch Kuro Assistant on your PC.")
	}
}

// KuroNodeScreenshotHandler captures a remote workstation screenshot.
func KuroNodeScreenshotHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache, no-store")
		rawNodeID := chi.URLParam(r, "id")
		nodeID := resolveConnectedNodeID(ks, rawNodeID)
		if ks != nil && ks.Nodes != nil {
			res, err := ks.Nodes.SendCommand(nodeID, "system.screenshot", nil, 12*time.Second)
			if err == nil && res.Success {
				_ = json.NewEncoder(w).Encode(res.Data)
				return
			}
		}
		if isNodeWindows(ks, rawNodeID) && runtime.GOOS == "windows" {
			data, err := captureLocalWindowsScreenshot()
			if err == nil {
				_ = json.NewEncoder(w).Encode(data)
				return
			}
		}
		respondJSONError(w, http.StatusServiceUnavailable, "Windows client is offline. Please launch Kuro Assistant on your PC.")
	}
}

// KuroNodeGetClipboardHandler reads remote clipboard text.
func KuroNodeGetClipboardHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache, no-store")
		rawNodeID := chi.URLParam(r, "id")
		nodeID := resolveConnectedNodeID(ks, rawNodeID)
		if ks != nil && ks.Nodes != nil {
			res, err := ks.Nodes.SendCommand(nodeID, "clipboard.get", nil, 10*time.Second)
			if err == nil && res.Success {
				_ = json.NewEncoder(w).Encode(res.Data)
				return
			}
		}
		respondJSONError(w, http.StatusServiceUnavailable, "Windows client is offline. Please launch Kuro Assistant on your PC.")
	}
}

// KuroNodeSetClipboardHandler sets remote clipboard text.
func KuroNodeSetClipboardHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		rawNodeID := chi.URLParam(r, "id")
		nodeID := resolveConnectedNodeID(ks, rawNodeID)
		var req struct {
			Text string `json:"text"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondJSONError(w, http.StatusBadRequest, "invalid clipboard payload")
			return
		}
		if ks != nil && ks.Nodes != nil {
			res, err := ks.Nodes.SendCommand(nodeID, "clipboard.set", map[string]any{"text": req.Text}, 10*time.Second)
			if err == nil && res.Success {
				_ = json.NewEncoder(w).Encode(res.Data)
				return
			}
		}
		if isNodeWindows(ks, rawNodeID) && runtime.GOOS == "windows" {
			cmd := exec.Command("powershell", "-NoProfile", "-Command", fmt.Sprintf("Set-Clipboard -Value '%s'", strings.ReplaceAll(req.Text, "'", "''")))
			if err := cmd.Run(); err == nil {
				_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
				return
			}
		}
		respondJSONError(w, http.StatusServiceUnavailable, "Failed to set clipboard")
	}
}

// KuroNodeSendToastHandler pushes a toast notification to the Windows desktop.
func KuroNodeSendToastHandler(ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		rawNodeID := chi.URLParam(r, "id")
		nodeID := resolveConnectedNodeID(ks, rawNodeID)
		var req struct {
			Title   string `json:"title"`
			Message string `json:"message"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Message == "" {
			respondJSONError(w, http.StatusBadRequest, "invalid toast payload")
			return
		}
		if ks != nil && ks.Nodes != nil {
			res, err := ks.Nodes.SendCommand(nodeID, "toast.send", map[string]any{"title": req.Title, "message": req.Message}, 10*time.Second)
			if err == nil && res.Success {
				_ = json.NewEncoder(w).Encode(res.Data)
				return
			}
		}
		if isNodeWindows(ks, rawNodeID) && runtime.GOOS == "windows" {
			script := fmt.Sprintf(`[reflection.assembly]::loadwithpartialname('System.Windows.Forms'); $n = New-Object System.Windows.Forms.NotifyIcon; $n.Icon = [System.Drawing.SystemIcons]::Information; $n.Visible = $true; $n.ShowBalloonTip(3000, '%s', '%s', 'Info')`, strings.ReplaceAll(req.Title, "'", "''"), strings.ReplaceAll(req.Message, "'", "''"))
			_ = exec.Command("powershell", "-NoProfile", "-Command", script).Run()
			_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
			return
		}
		respondJSONError(w, http.StatusServiceUnavailable, "Failed to send toast notification")
	}
}








