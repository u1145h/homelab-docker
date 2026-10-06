package papra

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// PapraConfig holds connection settings for the Papra Document Management instance
type PapraConfig struct {
	URL      string `json:"url"`       // e.g. "http://127.0.0.1:3005"
	APIToken string `json:"api_token"` // API Token for authentication
}

type DocumentItem struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Description string   `json:"description,omitempty"`
	Category    string   `json:"category"` // 'invoice' | 'receipt' | 'contract' | 'warranty' | 'doc'
	Tags        []string `json:"tags"`
	OCRText     string   `json:"ocr_text,omitempty"`
	FileName    string   `json:"file_name"`
	FileSize    int64    `json:"file_size"`
	CreatedAt   string   `json:"created_at"`
	UpdatedAt   string   `json:"updated_at"`
}

type SearchDocumentsFilter struct {
	Query    string `json:"query,omitempty"`
	Category string `json:"category,omitempty"`
	Tag      string `json:"tag,omitempty"`
	Limit    int    `json:"limit,omitempty"`
}

type Client struct {
	cfg        PapraConfig
	httpClient *http.Client
}

func NewClient(cfg PapraConfig) *Client {
	return &Client{
		cfg: cfg,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (c *Client) SearchDocuments(ctx context.Context, filter SearchDocumentsFilter) ([]DocumentItem, error) {
	if c.cfg.URL == "" {
		return nil, fmt.Errorf("papra URL not configured")
	}

	url := fmt.Sprintf("%s/api/documents/search", strings.TrimRight(c.cfg.URL, "/"))
	bodyBytes, _ := json.Marshal(filter)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.cfg.APIToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.cfg.APIToken)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("papra request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("papra API error (%d): %s", resp.StatusCode, string(respBody))
	}

	var results []DocumentItem
	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		return nil, fmt.Errorf("decoding papra response: %w", err)
	}

	if filter.Limit > 0 && len(results) > filter.Limit {
		results = results[:filter.Limit]
	}

	return results, nil
}
