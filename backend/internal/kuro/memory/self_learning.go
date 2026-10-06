package memory

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/ullashroy/poco-server/backend/internal/kuro/llm"
)

type ExtractedMemory struct {
	Content    string `json:"content"`
	Category   string `json:"category"`   // "preference", "rule", "fact", "alias", "routine"
	Importance int    `json:"importance"` // 1 - 10
	Action     string `json:"action"`     // "add", "update", "correct"
}

type LearningResult struct {
	Memories []ExtractedMemory `json:"memories"`
}

const memoryExtractionSystemPrompt = `You are the Kuro Self-Learning & Memory Distillation Engine.
Your task is to analyze user-assistant dialogues and extract durable facts, user preferences, corrections, and explicit rules.

GUIDELINES:
1. Extract ONLY long-term facts, user preferences, corrections to previous actions, or explicit rules (e.g. "I prefer 24h format", "My home camera is Driveway", "Sister's birthday is June 4", "No, use camera 2 instead").
2. DO NOT extract transient conversation, weather checks, temporary questions, or one-off greetings.
3. If the user is correcting the assistant ("No, that's wrong, do X instead"), set action="correct", category="rule", importance=9 or 10.
4. Categories allowed: "preference", "rule", "fact", "alias", "routine".
5. Return JSON ONLY matching: {"memories": [{"content": "...", "category": "...", "importance": 1-10, "action": "add"|"update"|"correct"}]}. If nothing to learn, return {"memories": []}.`

// ExtractAndLearn runs an asynchronous extraction pass over a completed dialogue turn.
func (m *Manager) ExtractAndLearn(ctx context.Context, provider llm.Provider, username, userMessage, assistantResponse, sourceConvID string) {
	if provider == nil || strings.TrimSpace(userMessage) == "" {
		return
	}

	// Quick filter to skip queries with zero durable memory value (simple single-word acknowledgments, etc.)
	u := strings.ToLower(strings.TrimSpace(userMessage))
	if len(u) < 3 || u == "hi" || u == "hello" || u == "thanks" || u == "ok" || u == "okay" {
		return
	}

	go func() {
		learnCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		messages := []llm.Message{
			{
				Role:    llm.RoleSystem,
				Content: memoryExtractionSystemPrompt,
			},
			{
				Role:    llm.RoleUser,
				Content: fmt.Sprintf("User: %s\nAssistant: %s", userMessage, assistantResponse),
			},
		}

		resp, err := provider.Chat(learnCtx, messages, nil)
		if err != nil {
			slog.Debug("self-learning extraction skipped or failed", "err", err)
			return
		}

		rawJSON := strings.TrimSpace(resp.Content)
		if start := strings.Index(rawJSON, "{"); start != -1 {
			if end := strings.LastIndex(rawJSON, "}"); end != -1 && end > start {
				rawJSON = rawJSON[start : end+1]
			}
		}

		var result LearningResult
		if err := json.Unmarshal([]byte(rawJSON), &result); err != nil {
			slog.Debug("could not parse learning result json", "raw", rawJSON, "err", err)
			return
		}

		for _, item := range result.Memories {
			if strings.TrimSpace(item.Content) == "" {
				continue
			}
			imp := item.Importance
			if imp < 1 {
				imp = 5
			}
			if item.Action == "correct" && imp < 8 {
				imp = 9
			}

			slog.Info("🧠 Self-learning captured new memory",
				"user", username,
				"content", item.Content,
				"category", item.Category,
				"importance", imp,
				"action", item.Action,
			)

			_ = m.Store(username, item.Content, item.Category, imp, sourceConvID)
		}
	}()
}
