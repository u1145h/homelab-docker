package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/ullashroy/poco-server/backend/internal/kuro/db"
	"github.com/ullashroy/poco-server/backend/internal/kuro/integrations/immich"
	"github.com/ullashroy/poco-server/backend/internal/kuro/llm"
	"github.com/ullashroy/poco-server/backend/internal/kuro/memory"
	"github.com/ullashroy/poco-server/backend/internal/kuro/node"
	"github.com/ullashroy/poco-server/backend/internal/kuro/tools"
)

const (
	maxToolIterations = 6
	commandTimeout    = 30 * time.Second
)

type PreemptionNotifier interface {
	NotifyUserActivity()
	NotifyUserComplete()
}

type Config struct {
	LLM         llm.Provider
	Memory      *memory.Manager
	Nodes       *node.Manager
	PocoTools   *tools.PocoToolHandler
	DB          *db.DB
	MaxContext  int
	DefaultUser string
	Preempt     PreemptionNotifier
	// Mode controls which processing path is used: "llm" | "direct" | "cloud"
	Mode         string
	CloudProvider string
}

type ActiveEntity struct {
	Type      string                 `json:"type"`       // "calendar" | "call_log" | "sms" | "photos" | "notes" | "docker" | "server"
	Query     string                 `json:"query"`
	Filter    string                 `json:"filter"`
	Offset    int                    `json:"offset"`
	Metadata  map[string]any         `json:"metadata"`
	UpdatedAt time.Time              `json:"updated_at"`
}

type Agent struct {
	cfg          Config
	mu           sync.Mutex
	activeEntity map[string]*ActiveEntity // Keyed by Username or ConversationID
}

func New(cfg Config) *Agent {
	if cfg.MaxContext <= 0 {
		cfg.MaxContext = 30
	}
	return &Agent{
		cfg:          cfg,
		activeEntity: make(map[string]*ActiveEntity),
	}
}

func (a *Agent) SetLLM(l llm.Provider) {
	a.cfg.LLM = l
}

// SetMode updates the agent's operating mode and cloud provider tag.
func (a *Agent) SetMode(mode, cloudProvider string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if mode != "" {
		a.cfg.Mode = mode
	}
	a.cfg.CloudProvider = cloudProvider
}

type ChatRequest struct {
	Username       string
	Role           string
	ConversationID string
	Content        string
	InputMode      string // "text" | "voice"
	NodeID         string
}

type ChatResponse struct {
	MessageID string
	Content   string
	ModelUsed string
}

func (a *Agent) Chat(ctx context.Context, req ChatRequest) (*ChatResponse, error) {
	if a.cfg.Preempt != nil {
		a.cfg.Preempt.NotifyUserActivity()
		defer a.cfg.Preempt.NotifyUserComplete()
	}

	a.mu.Lock()
	defer a.mu.Unlock()

	if req.InputMode == "" {
		req.InputMode = "text"
	}

	slog.Debug("kuro agent chat",
		"conv", req.ConversationID,
		"user", req.Username,
		"role", req.Role,
		"mode", req.InputMode,
	)

	userMsg := &db.Message{
		ConversationID: req.ConversationID,
		Role:           "user",
		Content:        req.Content,
		InputMode:      req.InputMode,
		NodeID:         nullIfEmpty(req.NodeID),
	}
	if err := a.cfg.DB.SaveMessage(userMsg); err != nil {
		return nil, fmt.Errorf("saving user message: %w", err)
	}

	model := a.cfg.LLM.ModelName()

	// ─── 1. ZERO-LATENCY DIRECT ACTION EXECUTION (Instant Fast-Path) ───
	// If the user's request is an unambiguous core command (e.g. camera stream, calendar, photos, docker, telemetry, notes, papra),
	// execute the tool directly in < 10ms without waiting for a slow LLM round-trip on ARM CPU.
	if directCalls := a.inferDirectAction(req.Content, req.Role, req.Username); len(directCalls) > 0 {
		slog.Info("⚡ Zero-latency direct action executed", "query", req.Content, "tool", directCalls[0].Function.Name)
		var collectedTokens []string
		var toolOutputs []string

		for _, tc := range directCalls {
			res, execErr := a.executeTool(ctx, req.Username, req.Role, tc)
			if execErr != nil {
				res = fmt.Sprintf("Error executing %s: %v", tc.Function.Name, execErr)
			}
			tokens := extractCustomUITokens(res)
			collectedTokens = append(collectedTokens, tokens...)
			toolOutputs = append(toolOutputs, cleanCustomUITokens(res))
			a.updateActiveEntityFromTool(req.Username, tc.Function.Name, tc.Function.Arguments, req.Content)
		}

		finalContent := a.formatFinalResponse(strings.Join(toolOutputs, "\n\n"), collectedTokens)

		assistantMsg := &db.Message{
			ConversationID: req.ConversationID,
			Role:           "assistant",
			Content:        finalContent,
			InputMode:      "text",
			ModelUsed:      &model,
		}
		_ = a.cfg.DB.SaveMessage(assistantMsg)
		_ = a.maybeSetTitle(req.ConversationID, req.Content)

		return &ChatResponse{
			MessageID: assistantMsg.ID,
			Content:   finalContent,
			ModelUsed: model,
		}, nil
	}

	// ─── 2. LLM REASONING LOOP (Full Multi-Hop Tool Calling & Autonomous Execution) ──
	messages, allTools, err := a.buildContext(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("building context: %w", err)
	}

	loopCtx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()

	finalContent, usedIterations, err := a.runLoop(loopCtx, req.Username, req.Role, messages, allTools)
	if err != nil {
		slog.Warn("agent loop error, attempting live knowledge fallback", "error", err, "query", req.Content)
		if strings.Contains(err.Error(), "404") || strings.Contains(err.Error(), "not found") {
			finalContent = "⚠️ **Model Not Found**: The configured LLM model was not found in your Ollama / local provider. Please ensure the model is pulled (`ollama pull <model>`) or update the model name in **Assistant Settings**."
		} else {
			// Intelligent Live Knowledge Search Fallback (Retrieves real web & wiki data even if local LLM is under 100% CPU load)
			if isKnowledgeQuery(req.Content) {
				if webRes, wErr := tools.SearchDuckDuckGo(ctx, req.Content, 4); wErr == nil && webRes != "" {
					finalContent = fmt.Sprintf("⚡ *Direct Web & Wiki Retrieval (Offline LLM Fallback):*\n\n%s", webRes)
				}
			}

			if finalContent == "" {
				finalContent = fmt.Sprintf("The LLM took too long or was unavailable (%v). Here is the live server health:\n", err)
				if req.Role == "admin" {
					if statusRes, sErr := a.cfg.PocoTools.Execute(ctx, req.Username, req.Role, "poco_get_server_status", ""); sErr == nil && statusRes != "" {
						finalContent += statusRes
					} else {
						finalContent += "Server is online and responding."
					}
				} else {
					finalContent += "Server is online and responding."
				}
			}
		}
	}

	assistantMsg := &db.Message{
		ConversationID: req.ConversationID,
		Role:           "assistant",
		Content:        finalContent,
		InputMode:      "text",
		ModelUsed:      &model,
	}
	_ = a.cfg.DB.SaveMessage(assistantMsg)

	// Background tasks: Memory Extraction & Thread Title generation
	go func() {
		_ = a.maybeSetTitle(req.ConversationID, req.Content)
		a.extractMemories(req.Username, req.ConversationID, req.Content, finalContent)
	}()

	slog.Info("kuro agent response complete",
		"conv", req.ConversationID,
		"model", model,
		"iterations", usedIterations,
		"len", len(finalContent),
	)

	return &ChatResponse{
		MessageID: assistantMsg.ID,
		Content:   finalContent,
		ModelUsed: model,
	}, nil
}

func (a *Agent) buildContext(ctx context.Context, req ChatRequest) ([]llm.Message, []llm.Tool, error) {
	memories, _ := a.cfg.Memory.Retrieve(req.Username, req.Content)
	deviceContext := a.cfg.Nodes.DeviceContextSummary(req.Username, req.Role)

	// Privacy Firewall Layer 2: cloud providers receive a stripped system prompt.
	// Zero personal context, zero memories, zero device state sent to 3rd parties.
	var systemPrompt string
	if a.cfg.Mode == "cloud" {
		systemPrompt = "You are a helpful AI assistant. You have access to web search and Wikipedia. " +
			"You have NO access to the user's personal data: no contacts, no call logs, no SMS messages, " +
			"no calendar events, no photos, no notes, no server infrastructure, and no device information. " +
			"If asked about personal data, politely explain you cannot access it and offer to search the web instead."
	} else {
		systemPrompt = a.buildSystemPrompt(memories, deviceContext)
	}


	history, err := a.cfg.DB.GetMessages(req.ConversationID, a.cfg.MaxContext)
	if err != nil {
		return nil, nil, err
	}

	var messages []llm.Message
	messages = append(messages, llm.Message{
		Role:    llm.RoleSystem,
		Content: systemPrompt,
	})

	for _, m := range history {
		if m.Role == "user" && m.Content == req.Content {
			continue
		}
		messages = append(messages, llm.Message{
			Role:    m.Role,
			Content: m.Content,
		})
	}

	messages = append(messages, llm.Message{
		Role:    llm.RoleUser,
		Content: req.Content,
	})

	// Collect tools: 1) Native Poco tools (filtered by role + mode) + 2) Node tools (blocked for cloud)
	isCloudMode := a.cfg.Mode == "cloud"

	// privateTools: personal data tools that are NEVER sent to 3rd party cloud providers.
	// Layer 1 of the privacy firewall — cloud LLM never even knows these tools exist.
	cloudPrivateTools := map[string]bool{
		// Device personal data
		"poco_get_device_calls": true, "poco_get_device_messages": true,
		"poco_locate_device": true, "poco_ring_device": true, "poco_get_device_telemetry": true,
		// Contacts
		"poco_contacts_search": true, "poco_contacts_list": true,
		// Calendar & reminders
		"poco_calendar_list_events": true, "poco_calendar_create_event": true,
		"poco_reminder_list": true, "poco_reminder_create": true,
		// Photos
		"poco_immich_search_assets": true, "poco_immich_list_albums": true,
		"poco_immich_get_asset_info": true, "poco_immich_search_by_person": true,
		"poco_immich_list_people": true, "poco_immich_search_photos": true,
		// Notes
		"poco_create_note": true, "poco_list_notes": true, "poco_get_note": true,
		"poco_update_note": true, "poco_delete_note": true,
		"poco_toggle_checklist_item": true, "poco_append_checklist": true, "poco_notes_stats": true,
		// Server internals
		"poco_get_server_status": true, "poco_get_top_processes": true,
		"poco_get_network_info": true, "poco_get_tailscale_status": true,
		"poco_run_read_only_command": true, "poco_execute_mutating_command": true,
		"poco_list_docker_containers": true, "poco_get_docker_logs": true,
		"poco_restart_docker_container": true, "poco_start_docker_container": true,
		"poco_stop_docker_container": true,
		// Filesystem
		"poco_read_file": true, "poco_list_directory": true,
		"poco_search_files": true, "poco_write_file": true, "poco_delete_file": true,
		// Camera
		"poco_access_camera": true,
	}

	var allTools []llm.Tool
	if a.cfg.PocoTools != nil {
		adminOnlyTools := map[string]bool{
			"poco_immich_search_assets": true, "poco_immich_list_albums": true, "poco_immich_get_asset_info": true, "poco_immich_search_by_person": true, "poco_immich_list_people": true,
			"poco_calendar_list_events": true, "poco_calendar_create_event": true, "poco_contacts_search": true, "poco_contacts_list": true, "poco_reminder_list": true, "poco_reminder_create": true,
			"poco_create_note": true, "poco_list_notes": true, "poco_get_note": true, "poco_update_note": true, "poco_delete_note": true, "poco_toggle_checklist_item": true, "poco_append_checklist": true, "poco_notes_stats": true,
			"poco_access_camera": true, "poco_list_docker_containers": true, "poco_get_docker_logs": true, "poco_restart_docker_container": true, "poco_start_docker_container": true, "poco_stop_docker_container": true,
			"poco_get_server_status": true, "poco_get_top_processes": true, "poco_get_network_info": true, "poco_get_tailscale_status": true, "poco_run_read_only_command": true, "poco_execute_mutating_command": true,
			"poco_read_file": true, "poco_list_directory": true, "poco_search_files": true, "poco_write_file": true, "poco_delete_file": true,
		}
		for _, t := range a.cfg.PocoTools.BuiltinTools() {
			// Privacy Firewall Layer 1: cloud providers only get public internet tools
			if isCloudMode && cloudPrivateTools[t.Function.Name] {
				continue // ⛔ blocked — personal data never sent to 3rd party cloud
			}
			if req.Role != "admin" && adminOnlyTools[t.Function.Name] {
				continue
			}
			allTools = append(allTools, t)
		}
	}

	// Privacy Firewall: node tools (contacts, calls, messages, device data) are
	// completely excluded for cloud provider mode.
	if !isCloudMode {
		for _, t := range a.cfg.Nodes.BuildToolList(req.Username, req.Role) {
			raw, _ := json.Marshal(t)
			var tool llm.Tool
			if err := json.Unmarshal(raw, &tool); err == nil {
				allTools = append(allTools, tool)
			}
		}
	}

	// Dynamically scope tools by domain to prevent context saturation on smaller models (e.g. 0.5b, 3b)
	scopedTools := a.scopeTools(req.Content, allTools)

	return messages, scopedTools, nil
}

func (a *Agent) scopeTools(query string, allTools []llm.Tool) []llm.Tool {
	q := strings.ToLower(query)

	var allowedPrefixes []string
	switch {
	case strings.Contains(q, "calendar") || strings.Contains(q, "meeting") || strings.Contains(q, "schedule") ||
		strings.Contains(q, "event") || strings.Contains(q, "agenda") || strings.Contains(q, "birthday") || strings.Contains(q, "anniversary"):
		allowedPrefixes = []string{"poco_calendar_", "poco_contacts_"}

	case strings.Contains(q, "note") || strings.Contains(q, "memo") || strings.Contains(q, "list") ||
		strings.Contains(q, "checklist") || strings.Contains(q, "todo") || strings.Contains(q, "task") ||
		strings.Contains(q, "shopping") || strings.Contains(q, "grocery") || strings.Contains(q, "scratchpad") ||
		strings.Contains(q, "write down") || strings.Contains(q, "remember this") || strings.Contains(q, "anchor") ||
		strings.Contains(q, "mark done") || strings.Contains(q, "check off"):
		allowedPrefixes = []string{"poco_create_note", "poco_list_notes", "poco_get_note", "poco_update_note", "poco_toggle_checklist_item", "poco_delete_note", "poco_reminder_"}

	case strings.Contains(q, "camera") || strings.Contains(q, "webcam") || strings.Contains(q, "live feed") ||
		strings.Contains(q, "video stream") || strings.Contains(q, "feed"):
		allowedPrefixes = []string{"poco_access_camera"}

	case strings.Contains(q, "photo") || strings.Contains(q, "picture") || strings.Contains(q, "image") ||
		strings.Contains(q, "gallery") || strings.Contains(q, "immich") || strings.Contains(q, "album") ||
		strings.Contains(q, "snapshot") || strings.Contains(q, "2024") || strings.Contains(q, "2025") ||
		strings.Contains(q, "sunset") || strings.Contains(q, "cat") || strings.Contains(q, "dog"):
		allowedPrefixes = []string{"poco_immich_"}

	case strings.Contains(q, "docker") || strings.Contains(q, "container"):
		allowedPrefixes = []string{"poco_list_docker_containers", "poco_get_docker_logs", "poco_restart_docker_container", "poco_start_docker_container", "poco_stop_docker_container"}

	case strings.Contains(q, "cpu") || strings.Contains(q, "ram") || strings.Contains(q, "battery") ||
		strings.Contains(q, "storage") || strings.Contains(q, "thermal") || strings.Contains(q, "temperature") ||
		strings.Contains(q, "status") || strings.Contains(q, "uptime") || strings.Contains(q, "process") ||
		strings.Contains(q, "tailscale") || strings.Contains(q, "network") || strings.Contains(q, "server"):
		allowedPrefixes = []string{"poco_get_server_status", "poco_get_top_processes", "poco_get_network_info", "poco_get_tailscale_status", "poco_run_read_only_command"}

	case strings.Contains(q, "phone") || strings.Contains(q, "call") || strings.Contains(q, "sms") ||
		strings.Contains(q, "text") || strings.Contains(q, "message") || strings.Contains(q, "where is my") ||
		strings.Contains(q, "locate") || strings.Contains(q, "ring"):
		allowedPrefixes = []string{"poco_locate_device", "poco_get_device_calls", "poco_get_device_messages", "poco_get_device_telemetry", "poco_ring_device"}

	case isKnowledgeQuery(query):
		allowedPrefixes = []string{"poco_wiki_search", "poco_web_search", "poco_read_web_page"}

	case strings.Contains(q, "file") || strings.Contains(q, "directory") || strings.Contains(q, "folder"):
		allowedPrefixes = []string{"poco_read_file", "poco_list_directory", "poco_search_files", "poco_write_file", "poco_delete_file"}
	}

	if len(allowedPrefixes) == 0 {
		return allTools // If domain is general/unknown, keep all tools
	}

	var scoped []llm.Tool
	for _, t := range allTools {
		for _, prefix := range allowedPrefixes {
			if strings.HasPrefix(t.Function.Name, prefix) {
				scoped = append(scoped, t)
				break
			}
		}
	}

	if len(scoped) == 0 {
		return allTools
	}
	return scoped
}

func (a *Agent) runLoop(ctx context.Context, username, role string, messages []llm.Message, tools []llm.Tool) (string, int, error) {
	iterations := 0
	var collectedUITokens []string
	var lastToolResults []string

	lastUserQuery := ""
	for i := len(messages) - 1; i >= 0; i-- {
		if messages[i].Role == llm.RoleUser {
			lastUserQuery = messages[i].Content
			break
		}
	}

	for iterations < maxToolIterations {
		resp, err := a.cfg.LLM.Chat(ctx, messages, tools)
		if err != nil {
			return "", iterations, fmt.Errorf("LLM call: %w", err)
		}

		toolCalls := resp.ToolCalls

		// Fallback 1: Text-formatted tool calls (e.g. ```json {"tool": ...})
		if len(toolCalls) == 0 {
			if extracted := a.parseTextToolCalls(resp.Content); len(extracted) > 0 {
				toolCalls = extracted
				slog.Debug("⚡ Intercepted text tool calls from small model", "count", len(toolCalls))
			}
		}

		// Fallback 2: Intent-based tool execution for smaller models (e.g. 0.5B) that describe actions in natural language
		if len(toolCalls) == 0 && iterations == 0 {
			if inferred := a.inferToolCalls(lastUserQuery, resp.Content, role); len(inferred) > 0 {
				toolCalls = inferred
				slog.Info("⚡ Inferred tool action from model intent", "tools", len(toolCalls))
			}
		}

		if len(toolCalls) == 0 {
			return a.formatFinalResponse(resp.Content, collectedUITokens), iterations, nil
		}

		iterations++

		messages = append(messages, llm.Message{
			Role:    llm.RoleAssistant,
			Content: resp.Content,
		})

		for _, tc := range toolCalls {
			result, execErr := a.executeTool(ctx, username, role, tc)
			resultContent := result
			if execErr != nil {
				resultContent = fmt.Sprintf("Error executing tool %s: %v", tc.Function.Name, execErr)
				slog.Warn("tool error", "tool", tc.Function.Name, "error", execErr)
			}

			// Extract and preserve all custom UI tokens ([EVENT_CARD], [PHOTO_GRID], CAMERA_ACCESS_GRANTED, etc.)
			tokens := extractCustomUITokens(resultContent)
			collectedUITokens = append(collectedUITokens, tokens...)
			lastToolResults = append(lastToolResults, cleanCustomUITokens(resultContent))
			a.updateActiveEntityFromTool(username, tc.Function.Name, tc.Function.Arguments, lastUserQuery)

			messages = append(messages, llm.Message{
				Role:       llm.RoleTool,
				Content:    resultContent,
				Name:       tc.Function.Name,
				ToolCallID: tc.ID,
			})
		}
	}

	// Final synthesis step: Ask LLM for natural response, then append preserved UI tokens
	messages = append(messages, llm.Message{
		Role:    llm.RoleUser,
		Content: "Provide a brief, natural response based on the tool results above.",
	})

	resp, err := a.cfg.LLM.Chat(ctx, messages, nil)
	if err != nil || strings.TrimSpace(resp.Content) == "" {
		if len(lastToolResults) > 0 {
			return a.formatFinalResponse(strings.Join(lastToolResults, "\n\n"), collectedUITokens), iterations, nil
		}
		return "", iterations, fmt.Errorf("final summary: %w", err)
	}

	return a.formatFinalResponse(resp.Content, collectedUITokens), iterations, nil
}

func (a *Agent) formatFinalResponse(summaryText string, customUITokens []string) string {
	cleanSummary := strings.TrimSpace(summaryText)
	if len(customUITokens) == 0 {
		return cleanSummary
	}

	// Deduplicate UI tokens
	seen := make(map[string]bool)
	var uniqueTokens []string
	for _, tok := range customUITokens {
		t := strings.TrimSpace(tok)
		if t != "" && !seen[t] {
			seen[t] = true
			uniqueTokens = append(uniqueTokens, t)
		}
	}

	if len(uniqueTokens) == 0 {
		return cleanSummary
	}

	tokenBlock := strings.Join(uniqueTokens, "\n\n")
	if cleanSummary == "" {
		return tokenBlock
	}

	return cleanSummary + "\n\n" + tokenBlock
}

func extractCustomUITokens(toolOutput string) []string {
	var tokens []string
	lines := strings.Split(toolOutput, "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "CAMERA_ACCESS_GRANTED:") ||
			strings.HasPrefix(trimmed, "[EVENT_CARD:") ||
			strings.HasPrefix(trimmed, "[PHOTO_GRID:") ||
			strings.HasPrefix(trimmed, "[NOTE_CARD:") ||
			strings.HasPrefix(trimmed, "[ANCHOR_NOTE:") ||
			strings.HasPrefix(trimmed, "[DOCUMENT_CARD:") ||
			strings.HasPrefix(trimmed, "[CALL_LOG_LIST:") ||
			strings.HasPrefix(trimmed, "[SMS_MESSAGE_LIST:") ||
			strings.HasPrefix(trimmed, "[MESSAGE_LIST:") {
			tokens = append(tokens, trimmed)
		}
	}
	return tokens
}

func cleanCustomUITokens(toolOutput string) string {
	var cleanLines []string
	lines := strings.Split(toolOutput, "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "CAMERA_ACCESS_GRANTED:") ||
			strings.HasPrefix(trimmed, "[EVENT_CARD:") ||
			strings.HasPrefix(trimmed, "[PHOTO_GRID:") ||
			strings.HasPrefix(trimmed, "[NOTE_CARD:") ||
			strings.HasPrefix(trimmed, "[ANCHOR_NOTE:") ||
			strings.HasPrefix(trimmed, "[DOCUMENT_CARD:") ||
			strings.HasPrefix(trimmed, "[CALL_LOG_LIST:") ||
			strings.HasPrefix(trimmed, "[SMS_MESSAGE_LIST:") ||
			strings.HasPrefix(trimmed, "[MESSAGE_LIST:") {
			continue
		}
		cleanLines = append(cleanLines, line)
	}
	return strings.TrimSpace(strings.Join(cleanLines, "\n"))
}

func (a *Agent) updateActiveEntityFromTool(username, toolName, argsJSON, userQuery string) {
	if username == "" {
		return
	}
	var metadata map[string]any
	if argsJSON != "" {
		_ = json.Unmarshal([]byte(argsJSON), &metadata)
	}

	entityType := ""
	switch toolName {
	case "poco_calendar_list_events":
		entityType = "calendar"
	case "poco_immich_search_photos", "poco_immich_search_assets":
		entityType = "photos"
	case "poco_get_device_calls":
		entityType = "call_log"
	case "poco_get_device_messages":
		entityType = "sms"
	case "poco_list_notes", "poco_create_note", "poco_get_note":
		entityType = "notes"
	case "poco_papra_search":
		entityType = "documents"
	case "poco_personal_search_all":
		entityType = "personal_search"
	case "poco_list_docker_containers":
		entityType = "docker"
	case "poco_get_server_status":
		entityType = "server"
	}

	if entityType != "" {
		offset := 0
		if oVal, ok := metadata["offset"].(float64); ok {
			offset = int(oVal)
		}
		a.activeEntity[username] = &ActiveEntity{
			Type:      entityType,
			Query:     userQuery,
			Offset:    offset,
			Metadata:  metadata,
			UpdatedAt: time.Now(),
		}
	}
}

// inferDirectAction detects unambiguous core action commands for instant zero-latency (<10ms) execution
func (a *Agent) inferDirectAction(userQuery, role, username string) []llm.ToolCall {
	q := strings.ToLower(strings.TrimSpace(userQuery))

	makeCall := func(name, args string) []llm.ToolCall {
		return []llm.ToolCall{
			{
				ID:   "fast-direct-" + fmt.Sprint(time.Now().UnixNano()),
				Type: "function",
				Function: llm.ToolCallFunction{
					Name:      name,
					Arguments: args,
				},
			},
		}
	}

	// Helper to extract offset from query like "offset 10" or "offset 20"
	extractOffset := func() int {
		if strings.Contains(q, "offset") {
			parts := strings.Fields(q)
			for i, p := range parts {
				if p == "offset" && i+1 < len(parts) {
					numStr := strings.Trim(parts[i+1], ",.;:?!")
					if val, err := strconv.Atoi(numStr); err == nil && val >= 0 {
						return val
					}
				}
			}
		}
		return 0
	}

	// ─── 0. SHORT-TERM CONTEXTUAL MEMORY & FOLLOW-UP RESOLUTION (< 2 min window) ───
	var lastEntity *ActiveEntity
	if username != "" {
		if ent, ok := a.activeEntity[username]; ok && time.Since(ent.UpdatedAt) < 2*time.Minute {
			lastEntity = ent
		}
	}

	if lastEntity != nil {
		// Contextual Calendar Follow-ups: "what about sunday?", "and tomorrow?", "how about friday?"
		if lastEntity.Type == "calendar" {
			days := []string{"sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "today", "tomorrow", "week"}
			for _, d := range days {
				if strings.Contains(q, d) && (strings.Contains(q, "what about") || strings.Contains(q, "how about") || strings.Contains(q, "and ") || strings.HasPrefix(q, d) || q == d) {
					return makeCall("poco_calendar_list_events", fmt.Sprintf(`{"filter_mode":"%s"}`, d))
				}
			}
		}

		// Contextual Call / SMS Pagination Follow-ups: "show more", "older", "next 10", "more calls", "more texts"
		if (lastEntity.Type == "call_log" || lastEntity.Type == "sms") && (q == "show more" || q == "more" || q == "older" || q == "next" || q == "next 10" || strings.Contains(q, "more")) {
			newOffset := lastEntity.Offset + 10
			if lastEntity.Type == "call_log" {
				return makeCall("poco_get_device_calls", fmt.Sprintf(`{"limit":10,"offset":%d}`, newOffset))
			}
			return makeCall("poco_get_device_messages", fmt.Sprintf(`{"limit":10,"offset":%d}`, newOffset))
		}

		// Contextual Photo Follow-ups: "from 2025", "show more photos", "in tokyo"
		if lastEntity.Type == "photos" && (strings.HasPrefix(q, "from ") || strings.HasPrefix(q, "in ") || q == "show more" || q == "more photos") {
			filter := immich.ParseDateFilter(q)
			argsMap := map[string]any{"limit": 8}
			if filter.Year > 0 {
				argsMap["year"] = filter.Year
			}
			if filter.Query != "" {
				argsMap["query"] = filter.Query
			}
			argsBytes, _ := json.Marshal(argsMap)
			return makeCall("poco_immich_search_photos", string(argsBytes))
		}
	}

	// ─── ADMIN-ONLY DIRECT SERVER INTEGRATIONS & ACTIONS ───
	if role == "admin" {
		// 1. Camera Intent (with typo tolerance: camrea, camra, etc.)
		isCameraWord := strings.Contains(q, "camera") || strings.Contains(q, "camrea") || strings.Contains(q, "camra") ||
			strings.Contains(q, "webcam") || strings.Contains(q, "live feed") || strings.Contains(q, "video stream") ||
			strings.Contains(q, "stream camera") || strings.Contains(q, "camera feed")

		if isCameraWord && (strings.Contains(q, "access") || strings.Contains(q, "open") || strings.Contains(q, "show") ||
			strings.Contains(q, "view") || strings.Contains(q, "start") || strings.Contains(q, "server") || strings.Contains(q, "feed") || q == "camera" || q == "camrea") {
			return makeCall("poco_access_camera", `{"action":"stream"}`)
		}

		// 2. Calendar Intent (with typo tolerance: calender, calander, etc.)
		isCalWord := strings.Contains(q, "calendar") || strings.Contains(q, "calender") || strings.Contains(q, "calander") ||
			strings.Contains(q, "whats on my") || strings.Contains(q, "what's on my") || strings.Contains(q, "what is on my") ||
			strings.Contains(q, "my schedule") || strings.Contains(q, "my meetings") || strings.Contains(q, "my agenda")

		if isCalWord {
			fMode := "all"
			if strings.Contains(q, "today") {
				fMode = "today"
			} else if strings.Contains(q, "tomorrow") {
				fMode = "tomorrow"
			} else if strings.Contains(q, "week") {
				fMode = "week"
			}
			return makeCall("poco_calendar_list_events", fmt.Sprintf(`{"filter_mode":"%s"}`, fMode))
		}

		// 3. Photo Intent
		isPhotoWord := strings.Contains(q, "photo") || strings.Contains(q, "photos") || strings.Contains(q, "picture") ||
			strings.Contains(q, "pictures") || strings.Contains(q, "image") || strings.Contains(q, "images") ||
			strings.Contains(q, "gallery") || strings.Contains(q, "immich")

		if isPhotoWord && (strings.Contains(q, "show") || strings.Contains(q, "find") || strings.Contains(q, "get") ||
			strings.Contains(q, "display") || strings.Contains(q, "view") || strings.Contains(q, "19") || strings.Contains(q, "20") ||
			strings.Contains(q, "recent") || strings.Contains(q, "jan") || strings.Contains(q, "feb") || strings.Contains(q, "mar") ||
			strings.Contains(q, "apr") || strings.Contains(q, "may") || strings.Contains(q, "jun") || strings.Contains(q, "jul") ||
			strings.Contains(q, "aug") || strings.Contains(q, "sep") || strings.Contains(q, "oct") || strings.Contains(q, "nov") || strings.Contains(q, "dec")) {

			filter := immich.ParseDateFilter(q)

			isSingle := strings.Contains(q, " a photo") || strings.Contains(q, " one photo") || strings.Contains(q, " 1 photo") ||
				strings.Contains(q, "single photo") || strings.Contains(q, "a picture") || strings.Contains(q, "one picture") ||
				strings.Contains(q, "latest photo") || strings.Contains(q, "last photo") || strings.Contains(q, "newest photo") ||
				q == "show me a photo" || q == "show photo"

			limit := 8
			if isSingle {
				limit = 1
			}

			argsMap := map[string]any{
				"limit": limit,
			}
			if filter.Year > 0 {
				argsMap["year"] = filter.Year
			}
			if filter.Month > 0 {
				argsMap["month"] = filter.Month
			}
			if filter.Day > 0 {
				argsMap["day"] = filter.Day
			}
			if filter.Date != "" {
				argsMap["date"] = filter.Date
			}
			if filter.Query != "" {
				argsMap["query"] = filter.Query
			}
			argsBytes, _ := json.Marshal(argsMap)
			return makeCall("poco_immich_search_photos", string(argsBytes))
		}

		// 4. Papra Documents & Invoices Intent
		isDocsWord := strings.Contains(q, "my receipts") || strings.Contains(q, "show receipts") || strings.Contains(q, "find receipt") ||
			strings.Contains(q, "my invoices") || strings.Contains(q, "find invoice") || strings.Contains(q, "scanned documents") ||
			strings.Contains(q, "my bills") || strings.Contains(q, "utility bill") || strings.Contains(q, "search docs") ||
			strings.Contains(q, "find document")

		if isDocsWord {
			cleanQuery := strings.TrimPrefix(strings.TrimPrefix(strings.TrimPrefix(q, "find "), "search "), "show ")
			return makeCall("poco_papra_search", fmt.Sprintf(`{"query":"%s","limit":10}`, cleanQuery))
		}

		// 5. Cross-Source Federated Personal Search ("search all for X", "search everything for X")
		if strings.HasPrefix(q, "search all for ") || strings.HasPrefix(q, "search everything for ") || strings.HasPrefix(q, "find everything about ") || strings.HasPrefix(q, "search personal data for ") {
			term := strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(strings.TrimPrefix(strings.TrimPrefix(q, "search all for "), "search everything for "), "find everything about "), "search personal data for "))
			if term != "" {
				return makeCall("poco_personal_search_all", fmt.Sprintf(`{"query":"%s","limit":5}`, term))
			}
		}

		// 6. Docker Intent
		if strings.Contains(q, "docker") || strings.Contains(q, "container") {
			if strings.Contains(q, "list") || strings.Contains(q, "show") || strings.Contains(q, "running") ||
				strings.Contains(q, "status") || strings.Contains(q, "all") || strings.Contains(q, "containers") {
				return makeCall("poco_list_docker_containers", `{}`)
			}
		}

		// 8. Server Status Intent
		if q == "server status" || q == "status" || q == "system status" || q == "cpu" || q == "battery" ||
			strings.Contains(q, "server status") || strings.Contains(q, "cpu usage") || strings.Contains(q, "battery status") ||
			strings.Contains(q, "server health") {
			return makeCall("poco_get_server_status", `{}`)
		}
	}

	// ─── USER-SCOPED CLIENT DEVICE DIRECT ACTIONS ───
	// 9. Phone Location
	if strings.Contains(q, "where is my phone") || strings.Contains(q, "find my phone") || strings.Contains(q, "locate phone") || strings.Contains(q, "locate device") {
		return makeCall("poco_locate_device", `{}`)
	}

	// 10. Phone Calls (with 10-item limit and Load More offset support)
	isCallQuery := strings.Contains(q, "call log") || strings.Contains(q, "call logs") || strings.Contains(q, "calls") ||
		strings.Contains(q, "who called") || strings.Contains(q, "missed call") || strings.Contains(q, "call history") ||
		strings.Contains(q, "recent calls") || strings.Contains(q, "my calls") || (strings.Contains(q, "call") && strings.Contains(q, "show"))
	if isCallQuery {
		offset := extractOffset()
		return makeCall("poco_get_device_calls", fmt.Sprintf(`{"limit":10,"offset":%d}`, offset))
	}

	// 11. Phone SMS / Messages (with 10-item limit and Load More offset support)
	isMessageQuery := strings.Contains(q, "my texts") || strings.Contains(q, "recent texts") || strings.Contains(q, "sms messages") ||
		strings.Contains(q, "text messages") || strings.Contains(q, "my messages") || strings.Contains(q, "show texts") || strings.Contains(q, "show sms")
	if isMessageQuery {
		offset := extractOffset()
		return makeCall("poco_get_device_messages", fmt.Sprintf(`{"limit":10,"offset":%d}`, offset))
	}

	// 12. Direct Wikipedia / Web Search Intent
	if strings.HasPrefix(q, "wiki ") || strings.HasPrefix(q, "wikipedia ") {
		topic := strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(q, "wikipedia "), "wiki "))
		return makeCall("poco_wiki_search", fmt.Sprintf(`{"query":"%s"}`, topic))
	}
	if strings.HasPrefix(q, "search ") || strings.HasPrefix(q, "google ") {
		searchQuery := strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(q, "google "), "search "))
		return makeCall("poco_web_search", fmt.Sprintf(`{"query":"%s"}`, searchQuery))
	}

	return nil
}

func isKnowledgeQuery(query string) bool {
	q := strings.ToLower(strings.TrimSpace(query))
	indicators := []string{
		"search", "wiki", "wikipedia", "google", "web", "internet",
		"who is", "who was", "who are", "who were",
		"what is", "what was", "what are", "what were",
		"tell me about", "tell me who", "tell me what", "explain",
		"where is", "where was", "when did", "when was",
		"how does", "how do", "how to", "how did",
		"president", "prime minister", "capital of", "population of",
		"founder of", "ceo of", "author of", "director of",
		"history of", "definition of", "meaning of", "news",
		"documentation", "docs", "api reference", "lookup", "find out",
	}
	for _, ind := range indicators {
		if strings.Contains(q, ind) {
			return true
		}
	}
	return false
}

func (a *Agent) inferToolCalls(userQuery, modelResp, role string) []llm.ToolCall {
	q := strings.ToLower(userQuery)
	m := strings.ToLower(modelResp)

	var calls []llm.ToolCall
	makeCall := func(name, args string) llm.ToolCall {
		return llm.ToolCall{
			ID:   "inferred-" + fmt.Sprint(time.Now().UnixNano()),
			Type: "function",
			Function: llm.ToolCallFunction{
				Name:      name,
				Arguments: args,
			},
		}
	}

	if role == "admin" {
		if strings.Contains(q, "calendar") || strings.Contains(m, "baïkal") {
			calls = append(calls, makeCall("poco_calendar_list_events", `{"filter_mode":"all"}`))
			return calls
		}
		if strings.Contains(q, "camera") || strings.Contains(m, "/camera") {
			calls = append(calls, makeCall("poco_access_camera", `{"action":"stream"}`))
			return calls
		}
		if strings.Contains(q, "photo") || strings.Contains(m, "immich") {
			calls = append(calls, makeCall("poco_immich_search_photos", `{"limit":8}`))
			return calls
		}
		if strings.Contains(q, "docker") || strings.Contains(m, "docker") {
			calls = append(calls, makeCall("poco_list_docker_containers", `{}`))
			return calls
		}
		if strings.Contains(q, "server status") {
			calls = append(calls, makeCall("poco_get_server_status", `{}`))
			return calls
		}
	}

	if strings.Contains(q, "where is my phone") || strings.Contains(q, "locate") {
		calls = append(calls, makeCall("poco_locate_device", `{}`))
		return calls
	}
	if strings.Contains(q, "who called") || strings.Contains(q, "missed call") {
		calls = append(calls, makeCall("poco_get_device_calls", `{}`))
		return calls
	}
	if strings.Contains(q, "sms") || strings.Contains(q, "text message") {
		calls = append(calls, makeCall("poco_get_device_messages", `{}`))
		return calls
	}

	if isKnowledgeQuery(userQuery) || strings.Contains(m, "i do not know") || strings.Contains(m, "i don't have real-time") ||
		strings.Contains(m, "as an ai") || strings.Contains(m, "browse the web") || strings.Contains(m, "search online") {
		if strings.Contains(q, "who is") || strings.Contains(q, "what is") || strings.Contains(q, "explain") || strings.Contains(q, "wiki") {
			calls = append(calls, makeCall("poco_wiki_search", fmt.Sprintf(`{"query":"%s"}`, userQuery)))
		} else {
			calls = append(calls, makeCall("poco_web_search", fmt.Sprintf(`{"query":"%s"}`, userQuery)))
		}
		return calls
	}

	return nil
}

// parseTextToolCalls intercepts text commands emitted by small models (e.g. ```json {"tool": ...} or run: ...)
func (a *Agent) parseTextToolCalls(content string) []llm.ToolCall {
	var calls []llm.ToolCall

	// Pattern 1: JSON blocks {"name": "poco_...", "arguments": {...}} or {"tool": "...", "command": "..."}
	if strings.Contains(content, "poco_") {
		lines := strings.Split(content, "\n")
		for _, l := range lines {
			lTrim := strings.TrimSpace(l)
			if strings.HasPrefix(lTrim, "poco_run_read_only_command(") && strings.HasSuffix(lTrim, ")") {
				cmdArg := strings.TrimSuffix(strings.TrimPrefix(lTrim, "poco_run_read_only_command("), ")")
				cmdArg = strings.Trim(cmdArg, "\"'`")
				if cmdArg != "" {
					calls = append(calls, llm.ToolCall{
						ID:   "call-" + fmt.Sprint(time.Now().UnixNano()),
						Type: "function",
						Function: llm.ToolCallFunction{
							Name:      "poco_run_read_only_command",
							Arguments: fmt.Sprintf(`{"command":"%s"}`, cmdArg),
						},
					})
				}
			}
		}
	}

	return calls
}

func (a *Agent) executeTool(ctx context.Context, username, role string, tc llm.ToolCall) (string, error) {
	name := tc.Function.Name

	// 1. Memory storage
	if name == "memory_store" {
		var args struct {
			Content    string `json:"content"`
			Category   string `json:"category"`
			Importance int    `json:"importance"`
		}
		if err := json.Unmarshal([]byte(tc.Function.Arguments), &args); err != nil {
			return "", err
		}
		if err := a.cfg.Memory.Store(username, args.Content, args.Category, args.Importance, ""); err != nil {
			return "", err
		}
		return `{"status": "stored", "memory": "` + args.Content + `"}`, nil
	}

	// 2. Native Poco tools (starts with "poco_")
	if strings.HasPrefix(name, "poco_") {
		if a.cfg.PocoTools != nil {
			return a.cfg.PocoTools.Execute(ctx, username, role, name, tc.Function.Arguments)
		}
		return "", fmt.Errorf("native poco tools not configured")
	}

	// 3. External device tools: format "nodeID__capability_name"
	parts := strings.SplitN(name, "__", 2)
	if len(parts) == 2 {
		nodeID := parts[0]
		capability := strings.ReplaceAll(parts[1], "_", ".")

		// Authorization guard for dynamic device commands
		if a.cfg.Nodes != nil && !a.cfg.Nodes.IsNodeOwnedBy(nodeID, username, role) {
			return "Sorry, I can't do that. You do not have authorization.", nil
		}

		var params map[string]any
		if tc.Function.Arguments != "" {
			json.Unmarshal([]byte(tc.Function.Arguments), &params)
		}

		res, err := a.cfg.Nodes.SendCommand(nodeID, capability, params, commandTimeout)
		if err != nil {
			return "", err
		}
		if !res.Success {
			return "", fmt.Errorf("node error: %s", res.Error)
		}

		raw, _ := json.Marshal(res.Data)
		return string(raw), nil
	}

	return "", fmt.Errorf("unknown tool: %s", name)
}

func (a *Agent) buildSystemPrompt(memories []db.Memory, deviceContext string) string {
	now := time.Now().Format("02 Jan 15:04 MST")
	memorySection := a.cfg.Memory.FormatForContext(memories)

	return fmt.Sprintf(`You are Kuro, the sovereign AI operating system and autonomous orchestrator for the Poco Linux home server and connected personal nodes.

Context:
- Current Time: %s
%s
%s

Sovereign Authority & Native Permissions:
- You operate with FULL ROOT PERMISSIONS and direct programmatic control over server hardware, Docker services, filesystems, and personal telemetry.
- NEVER ask the user for passwords, credentials, API keys, or photo URLs; you are already connected with root privileges.
- Single-Domain Precision: Select ONLY the single tool matching the user's domain. Do NOT execute unrelated tools (e.g. never call Immich for calendar questions, never call camera for system stats).

Domain-Specific Execution Directives:
1. Calendar & Schedule Domain ("meetings", "schedule", "events", "agenda", "today", "tomorrow"):
   - Call 'poco_calendar_list_events' immediately. Pass filter_mode="today" for today, "tomorrow" for tomorrow, "week" for the week. Leave calendar empty to aggregate all user calendars.
   - Call 'poco_reminder_list' for to-dos/reminders.
   - STRICT: Never scan Immich, files, or cameras for calendar queries.

2. Photos, Videos & Gallery Domain ("photos", "pictures", "images", "gallery", "2024", "sunset"):
   - Call 'poco_immich_search_photos' immediately with appropriate filter (e.g. year=2024, location="Tokyo", query="sunset").
   - Call 'poco_immich_search_albums' for albums, or 'poco_immich_search_people' for recognized people.
   - STRICT: NEVER claim you cannot view photos or ask for URLs. Always return the Immich search results.

3. Live Camera & Vision Domain ("camera", "live feed", "webcam", "video stream"):
   - Call 'poco_access_camera' immediately.
   - STRICT: NEVER ask for credentials or RTSP/HTTP links.

4. Server Telemetry & Docker Domain ("cpu", "ram", "battery", "storage", "docker", "containers"):
   - Call 'poco_get_server_status', 'poco_get_top_processes', 'poco_list_docker_containers', or 'poco_get_docker_logs'.

5. Connected Phone Domain ("where is my phone", "who called me", "my texts", "sms"):
   - Call 'poco_locate_device', 'poco_get_device_calls', 'poco_get_device_messages', or 'poco_get_device_telemetry'.

6. Live Web, Encyclopedic Knowledge & Documentation Domain:
   - You have FULL, UNRESTRICTED INTERNET ACCESS through native live tools.
   - For encyclopedic definitions, biographies, concepts, places, people, and history (e.g. "who is the President of India", "what is quantum computing"): Call 'poco_wiki_search' or 'poco_web_search'.
   - For live news, software documentation, web references, and current events: Call 'poco_web_search'.
   - For reading any specific web link or article: Call 'poco_read_web_page'.
   - NEVER claim you cannot browse the internet, lack real-time access, or have a knowledge cutoff. Always run the tool to fetch verified up-to-date results.

7. Guarded Write & Mutation Actions (Requires User Confirmation):
   - For mutating actions ('poco_calendar_create_event', 'poco_reminder_create', 'poco_calendar_delete_event', 'poco_restart_docker_container', 'poco_stop_docker_container', 'poco_start_docker_container', 'poco_write_file', 'poco_delete_file', 'poco_execute_mutating_command', 'poco_ring_device'):
     a. Formulate and describe the exact action.
     b. Show the parameters or command.
     c. Ask for explicit user confirmation before executing.

General Rules:
- Keep all responses concise, direct, and factual.
- The UI automatically renders rich interactive widgets for tool results (photo grids, calendar cards, document cards, camera players).`,
		now,
		deviceContext,
		memorySection,
	)
}

func (a *Agent) extractMemories(username, convID, userMsg, assistantMsg string) {
	if a.cfg.Memory == nil {
		return
	}

	// 1. Autonomous Self-Learning & Extraction via Needle/LLM
	if a.cfg.LLM != nil {
		a.cfg.Memory.ExtractAndLearn(context.Background(), a.cfg.LLM, username, userMsg, assistantMsg, convID)
	}

	lower := strings.ToLower(userMsg)

	// 2. Explicit memory triggers (Instant local fast-path)
	cues := []string{
		"remember that", "remember this", "don't forget", "keep in mind",
		"my name is", "i prefer", "i like", "i hate", "i always", "i never",
		"located at", "is stored in", "my docker compose is in", "path is",
	}
	for _, cue := range cues {
		if strings.Contains(lower, cue) {
			cat := "preference"
			if strings.Contains(lower, "/") || strings.Contains(lower, "path") || strings.Contains(lower, "folder") || strings.Contains(lower, "directory") {
				cat = "server_layout"
			}
			_ = a.cfg.Memory.Store(username, userMsg, cat, 8, convID)
			return
		}
	}

	// 3. Server paths or directory declarations
	if (strings.Contains(lower, "folder") || strings.Contains(lower, "directory") || strings.Contains(lower, "path")) &&
		(strings.Contains(userMsg, "/") || strings.Contains(userMsg, `\`)) {
		_ = a.cfg.Memory.Store(username, userMsg, "server_layout", 7, convID)
	}
}

func (a *Agent) maybeSetTitle(convID, firstMessage string) error {
	conv, err := a.cfg.DB.GetConversation(convID)
	if err != nil || conv == nil || (conv.Title != "" && !strings.HasPrefix(conv.Title, "Chat ") && conv.Title != "New Conversation" && conv.Title != "New Thread") {
		return err
	}

	clean := strings.TrimSpace(firstMessage)
	clean = strings.TrimPrefix(clean, "what is the ")
	clean = strings.TrimPrefix(clean, "what is ")
	clean = strings.TrimPrefix(clean, "what are ")
	clean = strings.TrimPrefix(clean, "how to ")
	clean = strings.TrimPrefix(clean, "can you ")
	clean = strings.TrimPrefix(clean, "could you ")
	clean = strings.TrimPrefix(clean, "please ")
	clean = strings.TrimPrefix(clean, "show me ")
	clean = strings.TrimPrefix(clean, "check ")
	clean = strings.TrimPrefix(clean, "tell me ")
	clean = strings.TrimSpace(clean)

	if len(clean) == 0 {
		clean = firstMessage
	}

	// Capitalize first character
	runes := []rune(clean)
	if len(runes) > 0 {
		runes[0] = unicode.ToUpper(runes[0])
		clean = string(runes)
	}

	if len(clean) > 36 {
		clean = clean[:36] + "..."
	}

	return a.cfg.DB.UpdateConversationTitle(convID, clean)
}

func nullIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
