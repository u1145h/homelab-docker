package needle

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/ullashroy/poco-server/backend/internal/kuro/llm"
)

// Provider implements llm.Provider for the lightweight Cactus Needle agentic engine.
type Provider struct {
	baseURL    string
	model      string
	httpClient *http.Client
}

type Config struct {
	BaseURL string
	Model   string
	Timeout time.Duration
}

func New(cfg Config) *Provider {
	baseURL := strings.TrimRight(cfg.BaseURL, "/")
	if baseURL == "" {
		baseURL = "http://localhost:8088/v1"
	}
	model := cfg.Model
	if model == "" {
		model = "cactus-needle-2"
	}
	timeout := cfg.Timeout
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	return &Provider{
		baseURL: baseURL,
		model:   model,
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}
}

func (p *Provider) ModelName() string    { return p.model }
func (p *Provider) ProviderName() string { return "cactus-needle" }

func (p *Provider) Health() error {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, p.baseURL+"/models", nil)
	if err != nil {
		return fmt.Errorf("creating health request: %w", err)
	}
	resp, err := p.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("connecting to cactus engine: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("cactus engine returned status: %d", resp.StatusCode)
	}
	return nil
}

type chatCompletionRequest struct {
	Model       string        `json:"model"`
	Messages    []llm.Message `json:"messages"`
	Tools       []llm.Tool    `json:"tools,omitempty"`
	Temperature float32       `json:"temperature"`
	Stream      bool          `json:"stream"`
}

type chatCompletionResponse struct {
	ID      string `json:"id"`
	Choices []struct {
		Message struct {
			Role      string         `json:"role"`
			Content   string         `json:"content"`
			ToolCalls []llm.ToolCall `json:"tool_calls,omitempty"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Usage llm.Usage `json:"usage"`
}

func (p *Provider) Chat(ctx context.Context, messages []llm.Message, tools []llm.Tool) (*llm.Response, error) {
	reqBody := chatCompletionRequest{
		Model:       p.model,
		Messages:    messages,
		Tools:       tools,
		Temperature: 0.1, // Low temperature for deterministic tool calling
		Stream:      false,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshaling request: %w", err)
	}

	url := p.baseURL + "/chat/completions"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("creating http request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("executing cactus request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("cactus needle error (status %d): %s", resp.StatusCode, string(body))
	}

	var res chatCompletionResponse
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return nil, fmt.Errorf("decoding cactus response: %w", err)
	}

	if len(res.Choices) == 0 {
		return &llm.Response{
			Content: "",
			Model:   p.model,
		}, nil
	}

	firstChoice := res.Choices[0]
	return &llm.Response{
		Content:   firstChoice.Message.Content,
		ToolCalls: firstChoice.Message.ToolCalls,
		Model:     p.model,
		Usage:     res.Usage,
	}, nil
}

func (p *Provider) Stream(ctx context.Context, messages []llm.Message, tools []llm.Tool) (<-chan llm.StreamChunk, error) {
	out := make(chan llm.StreamChunk, 10)
	go func() {
		defer close(out)
		resp, err := p.Chat(ctx, messages, tools)
		if err != nil {
			out <- llm.StreamChunk{Error: err, Done: true}
			return
		}
		out <- llm.StreamChunk{
			Content:   resp.Content,
			ToolCalls: resp.ToolCalls,
			Done:      true,
		}
	}()
	return out, nil
}
