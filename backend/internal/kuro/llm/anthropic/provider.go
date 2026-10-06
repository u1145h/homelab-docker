package anthropic

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/ullashroy/poco-server/backend/internal/kuro/llm"
)

const (
	defaultBaseURL        = "https://api.anthropic.com"
	anthropicVersion      = "2023-06-01"
	defaultMaxTokens      = 2048
	defaultTimeout        = 120 * time.Second
)

// Config holds the configuration for the Anthropic Claude provider.
type Config struct {
	APIKey    string
	Model     string        // e.g. "claude-haiku-4-5", "claude-sonnet-4-5"
	MaxTokens int           // required by Claude API, defaults to 2048
	Timeout   time.Duration
}

// Provider implements llm.Provider for Anthropic Claude.
type Provider struct {
	cfg    Config
	client *http.Client
}

// New creates a new Anthropic provider.
func New(cfg Config) *Provider {
	if cfg.MaxTokens <= 0 {
		cfg.MaxTokens = defaultMaxTokens
	}
	if cfg.Timeout <= 0 {
		cfg.Timeout = defaultTimeout
	}
	if cfg.Model == "" {
		cfg.Model = "claude-haiku-4-5"
	}
	return &Provider{
		cfg:    cfg,
		client: &http.Client{Timeout: cfg.Timeout},
	}
}

func (p *Provider) ModelName() string    { return p.cfg.Model }
func (p *Provider) ProviderName() string { return "anthropic" }

// Health checks connectivity by hitting the models endpoint.
func (p *Provider) Health() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, defaultBaseURL+"/v1/models", nil)
	if err != nil {
		return err
	}
	req.Header.Set("x-api-key", p.cfg.APIKey)
	req.Header.Set("anthropic-version", anthropicVersion)
	resp, err := p.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusUnauthorized {
		return fmt.Errorf("anthropic: invalid API key")
	}
	if resp.StatusCode >= 500 {
		return fmt.Errorf("anthropic: server error %d", resp.StatusCode)
	}
	return nil
}

// ── Request / Response types ──────────────────────────────────────────────

type anthropicMessage struct {
	Role    string `json:"role"`
	Content any    `json:"content"` // string or []contentBlock
}

type contentBlock struct {
	Type      string          `json:"type"`
	Text      string          `json:"text,omitempty"`
	ID        string          `json:"id,omitempty"`
	Name      string          `json:"name,omitempty"`
	Input     json.RawMessage `json:"input,omitempty"`
	ToolUseID string          `json:"tool_use_id,omitempty"`
	Content   string          `json:"content,omitempty"`
}

type anthropicTool struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	InputSchema map[string]any `json:"input_schema"`
}

type anthropicRequest struct {
	Model     string             `json:"model"`
	MaxTokens int                `json:"max_tokens"`
	System    string             `json:"system,omitempty"`
	Messages  []anthropicMessage `json:"messages"`
	Tools     []anthropicTool    `json:"tools,omitempty"`
	Stream    bool               `json:"stream,omitempty"`
}

type anthropicResponse struct {
	ID      string         `json:"id"`
	Type    string         `json:"type"`
	Role    string         `json:"role"`
	Content []contentBlock `json:"content"`
	Model   string         `json:"model"`
	Usage   struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
}

// ── Message conversion ────────────────────────────────────────────────────

// convertMessages converts llm.Message slice to Anthropic's format.
// Separates the system message from the rest and returns it.
func convertMessages(msgs []llm.Message) (system string, out []anthropicMessage) {
	for _, m := range msgs {
		switch m.Role {
		case llm.RoleSystem:
			system = m.Content
		case llm.RoleTool:
			// Tool result — wrap as user message with tool_result block
			out = append(out, anthropicMessage{
				Role: "user",
				Content: []contentBlock{{
					Type:      "tool_result",
					ToolUseID: m.ToolCallID,
					Content:   m.Content,
				}},
			})
		default:
			out = append(out, anthropicMessage{
				Role:    m.Role,
				Content: m.Content,
			})
		}
	}
	return
}

// convertTools converts llm.Tool slice to Anthropic's tool format.
func convertTools(tools []llm.Tool) []anthropicTool {
	out := make([]anthropicTool, 0, len(tools))
	for _, t := range tools {
		out = append(out, anthropicTool{
			Name:        t.Function.Name,
			Description: t.Function.Description,
			InputSchema: t.Function.Parameters,
		})
	}
	return out
}

// parseResponse converts an Anthropic response to llm.Response.
func parseResponse(resp *anthropicResponse) *llm.Response {
	var text strings.Builder
	var toolCalls []llm.ToolCall

	for _, block := range resp.Content {
		switch block.Type {
		case "text":
			text.WriteString(block.Text)
		case "tool_use":
			inputStr := "{}"
			if len(block.Input) > 0 {
				inputStr = string(block.Input)
			}
			toolCalls = append(toolCalls, llm.ToolCall{
				ID:   block.ID,
				Type: "function",
				Function: llm.ToolCallFunction{
					Name:      block.Name,
					Arguments: inputStr,
				},
			})
		}
	}

	return &llm.Response{
		Content:   text.String(),
		ToolCalls: toolCalls,
		Model:     resp.Model,
		Usage: llm.Usage{
			PromptTokens:     resp.Usage.InputTokens,
			CompletionTokens: resp.Usage.OutputTokens,
			TotalTokens:      resp.Usage.InputTokens + resp.Usage.OutputTokens,
		},
	}
}

// ── Chat (non-streaming) ──────────────────────────────────────────────────

func (p *Provider) Chat(ctx context.Context, messages []llm.Message, tools []llm.Tool) (*llm.Response, error) {
	system, converted := convertMessages(messages)

	body := anthropicRequest{
		Model:     p.cfg.Model,
		MaxTokens: p.cfg.MaxTokens,
		System:    system,
		Messages:  converted,
	}
	if len(tools) > 0 {
		body.Tools = convertTools(tools)
	}

	data, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("anthropic: marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, defaultBaseURL+"/v1/messages", bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("content-type", "application/json")
	req.Header.Set("x-api-key", p.cfg.APIKey)
	req.Header.Set("anthropic-version", anthropicVersion)

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("anthropic: request failed: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("anthropic: HTTP %d: %s", resp.StatusCode, string(raw))
	}

	var aResp anthropicResponse
	if err := json.Unmarshal(raw, &aResp); err != nil {
		return nil, fmt.Errorf("anthropic: decode response: %w", err)
	}

	return parseResponse(&aResp), nil
}

// ── Stream ────────────────────────────────────────────────────────────────

func (p *Provider) Stream(ctx context.Context, messages []llm.Message, tools []llm.Tool) (<-chan llm.StreamChunk, error) {
	system, converted := convertMessages(messages)

	body := anthropicRequest{
		Model:     p.cfg.Model,
		MaxTokens: p.cfg.MaxTokens,
		System:    system,
		Messages:  converted,
		Stream:    true,
	}
	if len(tools) > 0 {
		body.Tools = convertTools(tools)
	}

	data, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("anthropic: marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, defaultBaseURL+"/v1/messages", bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("content-type", "application/json")
	req.Header.Set("x-api-key", p.cfg.APIKey)
	req.Header.Set("anthropic-version", anthropicVersion)

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("anthropic: stream request failed: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("anthropic: HTTP %d: %s", resp.StatusCode, string(raw))
	}

	ch := make(chan llm.StreamChunk, 32)

	go func() {
		defer close(ch)
		defer resp.Body.Close()

		scanner := bufio.NewScanner(resp.Body)
		var pendingToolID, pendingToolName string
		var pendingToolInput strings.Builder

		for scanner.Scan() {
			line := scanner.Text()
			if !strings.HasPrefix(line, "data: ") {
				continue
			}
			payload := strings.TrimPrefix(line, "data: ")
			if payload == "[DONE]" {
				ch <- llm.StreamChunk{Done: true}
				return
			}

			var event map[string]any
			if err := json.Unmarshal([]byte(payload), &event); err != nil {
				continue
			}

			evType, _ := event["type"].(string)
			switch evType {
			case "content_block_delta":
				delta, _ := event["delta"].(map[string]any)
				deltaType, _ := delta["type"].(string)
				switch deltaType {
				case "text_delta":
					text, _ := delta["text"].(string)
					if text != "" {
						ch <- llm.StreamChunk{Content: text}
					}
				case "input_json_delta":
					partial, _ := delta["partial_json"].(string)
					pendingToolInput.WriteString(partial)
				}
			case "content_block_start":
				block, _ := event["content_block"].(map[string]any)
				blockType, _ := block["type"].(string)
				if blockType == "tool_use" {
					pendingToolID, _ = block["id"].(string)
					pendingToolName, _ = block["name"].(string)
					pendingToolInput.Reset()
				}
			case "content_block_stop":
				if pendingToolID != "" {
					ch <- llm.StreamChunk{
						ToolCalls: []llm.ToolCall{{
							ID:   pendingToolID,
							Type: "function",
							Function: llm.ToolCallFunction{
								Name:      pendingToolName,
								Arguments: pendingToolInput.String(),
							},
						}},
					}
					pendingToolID = ""
					pendingToolName = ""
					pendingToolInput.Reset()
				}
			case "message_stop":
				ch <- llm.StreamChunk{Done: true}
				return
			case "error":
				errMsg, _ := event["error"].(map[string]any)
				msg, _ := errMsg["message"].(string)
				slog.Error("anthropic stream error", "message", msg)
				ch <- llm.StreamChunk{Error: fmt.Errorf("anthropic: %s", msg), Done: true}
				return
			}
		}

		if err := scanner.Err(); err != nil {
			ch <- llm.StreamChunk{Error: err, Done: true}
		} else {
			ch <- llm.StreamChunk{Done: true}
		}
	}()

	return ch, nil
}
