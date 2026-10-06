package openai_compat

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

type Config struct {
	BaseURL     string
	APIKey      string
	Model       string
	ProviderTag string
	Timeout     time.Duration
	MaxTokens   int
	Temperature float64
}

type Provider struct {
	cfg    Config
	client *http.Client
}

func New(cfg Config) *Provider {
	if cfg.Timeout == 0 {
		cfg.Timeout = 120 * time.Second
	}
	return &Provider{
		cfg:    cfg,
		client: &http.Client{Timeout: cfg.Timeout},
	}
}

func (p *Provider) ModelName() string    { return p.cfg.Model }
func (p *Provider) ProviderName() string { return p.cfg.ProviderTag }

func normalizeBaseURL(url string) string {
	base := strings.TrimRight(strings.TrimSpace(url), "/")
	base = strings.Replace(base, "://localhost:", "://127.0.0.1:", 1)
	base = strings.Replace(base, "://localhost/", "://127.0.0.1/", 1)
	if strings.HasSuffix(base, "://localhost") {
		base = strings.Replace(base, "://localhost", "://127.0.0.1", 1)
	}
	return base
}

func (p *Provider) chatURL() string {
	base := normalizeBaseURL(p.cfg.BaseURL)
	if strings.HasSuffix(base, "/v1") {
		return base + "/chat/completions"
	}
	return base + "/v1/chat/completions"
}

func (p *Provider) modelsURL() string {
	base := normalizeBaseURL(p.cfg.BaseURL)
	if strings.HasSuffix(base, "/v1") {
		return base + "/models"
	}
	return base + "/v1/models"
}

func (p *Provider) Health() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 1. Try standard OpenAI /v1/models endpoint
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, p.modelsURL(), nil)
	if err == nil {
		if p.cfg.APIKey != "" {
			req.Header.Set("Authorization", "Bearer "+p.cfg.APIKey)
		}
		resp, doErr := p.client.Do(req)
		if doErr == nil {
			defer resp.Body.Close()
			if resp.StatusCode < 400 {
				return nil
			}
		}
	}

	// 2. Fallback check for Ollama native /api/tags
	base := normalizeBaseURL(p.cfg.BaseURL)
	base = strings.TrimSuffix(base, "/v1")
	ollamaReq, _ := http.NewRequestWithContext(ctx, http.MethodGet, base+"/api/tags", nil)
	if ollamaReq != nil {
		if oResp, oErr := p.client.Do(ollamaReq); oErr == nil {
			defer oResp.Body.Close()
			if oResp.StatusCode < 400 {
				return nil
			}
		}
	}

	if err != nil {
		return fmt.Errorf("unreachable at %s: %w", p.cfg.BaseURL, err)
	}
	return fmt.Errorf("health check returned unreachable for %s", p.cfg.BaseURL)
}

func (p *Provider) Chat(ctx context.Context, messages []llm.Message, tools []llm.Tool) (*llm.Response, error) {
	body, err := p.buildRequest(messages, tools, false)
	if err != nil {
		return nil, err
	}

	req, err := p.newRequest(ctx, body)
	if err != nil {
		return nil, err
	}

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("LLM request failed (%s): %w", p.cfg.BaseURL, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		// If tools were provided and the model/server rejected with 400, retry without tools
		if len(tools) > 0 && resp.StatusCode == http.StatusBadRequest {
			slog.Warn("⚠️ LLM rejected tools payload, retrying plain chat completion", "model", p.cfg.Model, "raw", string(raw))
			return p.Chat(ctx, messages, nil)
		}
		return nil, fmt.Errorf("LLM returned HTTP %d: %s", resp.StatusCode, string(raw))
	}

	var cr chatResponse
	if err := json.NewDecoder(resp.Body).Decode(&cr); err != nil {
		return nil, fmt.Errorf("decoding LLM response: %w", err)
	}

	if len(cr.Choices) == 0 {
		return nil, fmt.Errorf("LLM returned no choices")
	}

	choice := cr.Choices[0]
	result := &llm.Response{
		Content: choice.Message.Content,
		Model:   cr.Model,
		Usage: llm.Usage{
			PromptTokens:     cr.Usage.PromptTokens,
			CompletionTokens: cr.Usage.CompletionTokens,
			TotalTokens:      cr.Usage.TotalTokens,
		},
	}

	for _, tc := range choice.Message.ToolCalls {
		result.ToolCalls = append(result.ToolCalls, llm.ToolCall{
			ID:   tc.ID,
			Type: tc.Type,
			Function: llm.ToolCallFunction{
				Name:      tc.Function.Name,
				Arguments: tc.Function.Arguments,
			},
		})
	}

	slog.Debug("LLM response",
		"model", cr.Model,
		"content_len", len(result.Content),
		"tool_calls", len(result.ToolCalls),
		"tokens", cr.Usage.TotalTokens,
	)

	return result, nil
}

func (p *Provider) Stream(ctx context.Context, messages []llm.Message, tools []llm.Tool) (<-chan llm.StreamChunk, error) {
	body, err := p.buildRequest(messages, tools, true)
	if err != nil {
		return nil, err
	}

	req, err := p.newRequest(ctx, body)
	if err != nil {
		return nil, err
	}

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("LLM stream request: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, fmt.Errorf("LLM stream returned HTTP %d", resp.StatusCode)
	}

	ch := make(chan llm.StreamChunk, 64)
	go func() {
		defer close(ch)
		defer resp.Body.Close()
		p.readSSEStream(resp.Body, ch)
	}()

	return ch, nil
}

func (p *Provider) newRequest(ctx context.Context, body []byte) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.chatURL(), bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if p.cfg.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+p.cfg.APIKey)
	}
	return req, nil
}

func (p *Provider) buildRequest(messages []llm.Message, tools []llm.Tool, stream bool) ([]byte, error) {
	type apiMessage struct {
		Role       string `json:"role"`
		Content    string `json:"content"`
		Name       string `json:"name,omitempty"`
		ToolCallID string `json:"tool_call_id,omitempty"`
	}

	apiMsgs := make([]apiMessage, len(messages))
	for i, m := range messages {
		apiMsgs[i] = apiMessage{
			Role:       m.Role,
			Content:    m.Content,
			Name:       m.Name,
			ToolCallID: m.ToolCallID,
		}
	}

	reqBody := map[string]any{
		"model":    p.cfg.Model,
		"messages": apiMsgs,
		"stream":   stream,
	}

	if p.cfg.Temperature > 0 {
		reqBody["temperature"] = p.cfg.Temperature
	}
	if p.cfg.MaxTokens > 0 {
		reqBody["max_tokens"] = p.cfg.MaxTokens
	}
	if len(tools) > 0 {
		reqBody["tools"] = tools
		reqBody["tool_choice"] = "auto"
	}

	// Ollama / llama.cpp performance optimizations for Snapdragon 845 & mobile ARM CPUs
	numPredict := p.cfg.MaxTokens
	if numPredict <= 0 {
		numPredict = 512
	}

	reqBody["options"] = map[string]any{
		"num_thread":     4,    // Target Snapdragon 845 Big Gold cores (Kryo 385 @ 2.8GHz)
		"num_predict":    numPredict,
		"num_ctx":        2048, // 2048 is the high-speed sweet spot for Snapdragon 845 (~1s eval vs 60s freeze)
		"temperature":    p.cfg.Temperature,
		"use_mmap":       true,
		"repeat_penalty": 1.1,
	}

	return json.Marshal(reqBody)

}

func (p *Provider) readSSEStream(body io.Reader, ch chan<- llm.StreamChunk) {
	scanner := bufio.NewScanner(body)
	scanner.Buffer(make([]byte, 1024*64), 1024*64)

	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}

		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			ch <- llm.StreamChunk{Done: true}
			return
		}

		var delta streamDelta
		if err := json.Unmarshal([]byte(data), &delta); err != nil {
			continue
		}

		if len(delta.Choices) == 0 {
			continue
		}

		choice := delta.Choices[0]
		chunk := llm.StreamChunk{
			Content: choice.Delta.Content,
		}
		for _, tc := range choice.Delta.ToolCalls {
			chunk.ToolCalls = append(chunk.ToolCalls, llm.ToolCall{
				ID:   tc.ID,
				Type: tc.Type,
				Function: llm.ToolCallFunction{
					Name:      tc.Function.Name,
					Arguments: tc.Function.Arguments,
				},
			})
		}

		ch <- chunk

		if choice.FinishReason != "" && choice.FinishReason != "null" {
			ch <- llm.StreamChunk{Done: true}
			return
		}
	}

	if err := scanner.Err(); err != nil {
		ch <- llm.StreamChunk{Error: err, Done: true}
	}
}

type chatResponse struct {
	ID      string `json:"id"`
	Model   string `json:"model"`
	Choices []struct {
		Message struct {
			Role    string `json:"role"`
			Content string `json:"content"`
			ToolCalls []struct {
				ID   string `json:"id"`
				Type string `json:"type"`
				Function struct {
					Name      string `json:"name"`
					Arguments string `json:"arguments"`
				} `json:"function"`
			} `json:"tool_calls"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
}

type streamDelta struct {
	Choices []struct {
		Delta struct {
			Content   string `json:"content"`
			ToolCalls []struct {
				ID   string `json:"id"`
				Type string `json:"type"`
				Function struct {
					Name      string `json:"name"`
					Arguments string `json:"arguments"`
				} `json:"function"`
			} `json:"tool_calls"`
		} `json:"delta"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
}
