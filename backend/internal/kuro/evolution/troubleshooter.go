package evolution

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/ullashroy/poco-server/backend/internal/kuro/llm"
	"github.com/ullashroy/poco-server/backend/internal/kuro/tools"
)

type TroubleshootingRunbook struct {
	ID          string    `json:"id"`
	Signature   string    `json:"signature"`
	Title       string    `json:"title"`
	ErrorSample string    `json:"error_sample"`
	RootCause   string    `json:"root_cause"`
	Remediation string    `json:"remediation"`
	SourceURL   string    `json:"source_url,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

type AutonomousTroubleshooter struct {
	llmProvider llm.Provider
}

func NewAutonomousTroubleshooter(provider llm.Provider) *AutonomousTroubleshooter {
	return &AutonomousTroubleshooter{
		llmProvider: provider,
	}
}

// InvestigateAnomaly executes live web documentation search and uses minimal LLM reasoning
// to produce a structured, reusable troubleshooting runbook for the server.
func (t *AutonomousTroubleshooter) InvestigateAnomaly(ctx context.Context, anomaly DetectedAnomaly) (*TroubleshootingRunbook, error) {
	slog.Info("🔍 Autonomous Troubleshooter investigating anomaly", "source", anomaly.Source, "signature", anomaly.Signature)

	// Step 1: Formulate targeted tech search query
	searchQuery := fmt.Sprintf("%s %s fix documentation solution", anomaly.Source, anomaly.Signature)
	if strings.Contains(anomaly.Signature, "oom_137") {
		searchQuery = "docker container exit code 137 oom killed memory limit fix"
	} else if strings.Contains(anomaly.Signature, "port_collision") {
		searchQuery = "linux bind address already in use docker find process kill port"
	} else if strings.Contains(anomaly.Signature, "permission_denied") {
		searchQuery = "docker permission denied linux volume chown chmod fix"
	}

	searchCtx, cancelSearch := context.WithTimeout(ctx, 10*time.Second)
	defer cancelSearch()

	webResults, err := tools.SearchDuckDuckGo(searchCtx, searchQuery, 3)
	if err != nil {
		slog.Warn("Web search for troubleshooting failed", "query", searchQuery, "error", err)
	}

	// Step 2: Minimal LLM Synthesis (< 300 token budget)
	var prompt strings.Builder
	prompt.WriteString("You are an autonomous server diagnostic engineer.\n")
	prompt.WriteString("Synthesize a concise, verified troubleshooting runbook based on the error and documentation below:\n\n")
	prompt.WriteString(fmt.Sprintf("Error Source: %s\n", anomaly.Source))
	prompt.WriteString(fmt.Sprintf("Error Description: %s\n", anomaly.RawError))
	if webResults != "" {
		prompt.WriteString(fmt.Sprintf("\nDocumentation Reference:\n%s\n", webResults))
	}
	prompt.WriteString("\nFormat your response STRICTLY as follows:\n")
	prompt.WriteString("TITLE: <Clear title of problem>\n")
	prompt.WriteString("CAUSE: <1-2 sentences on technical root cause>\n")
	prompt.WriteString("FIX: <Exact commands or config fix to resolve and prevent recurrence>\n")

	messages := []llm.Message{
		{
			Role:    llm.RoleUser,
			Content: prompt.String(),
		},
	}

	llmCtx, cancelLLM := context.WithTimeout(ctx, 15*time.Second)
	defer cancelLLM()

	resp, err := t.llmProvider.Chat(llmCtx, messages, nil)
	if err != nil {
		// Fallback rule-based runbook without LLM
		return &TroubleshootingRunbook{
			ID:          fmt.Sprintf("rb-%d", time.Now().Unix()),
			Signature:   anomaly.Signature,
			Title:       fmt.Sprintf("Troubleshooting: %s", anomaly.Signature),
			ErrorSample: anomaly.RawError,
			RootCause:   "Automated signature detected matching server anomaly pattern.",
			Remediation: "Inspect service configuration and host system logs for detailed diagnosis.",
			CreatedAt:   time.Now(),
		}, nil
	}

	title, cause, fix := parseRunbookResponse(resp.Content)

	return &TroubleshootingRunbook{
		ID:          fmt.Sprintf("rb-%d", time.Now().Unix()),
		Signature:   anomaly.Signature,
		Title:       title,
		ErrorSample: anomaly.RawError,
		RootCause:   cause,
		Remediation: fix,
		CreatedAt:   time.Now(),
	}, nil
}

func parseRunbookResponse(raw string) (title, cause, fix string) {
	lines := strings.Split(raw, "\n")
	for _, l := range lines {
		trimmed := strings.TrimSpace(l)
		if strings.HasPrefix(trimmed, "TITLE:") {
			title = strings.TrimSpace(strings.TrimPrefix(trimmed, "TITLE:"))
		} else if strings.HasPrefix(trimmed, "CAUSE:") {
			cause = strings.TrimSpace(strings.TrimPrefix(trimmed, "CAUSE:"))
		} else if strings.HasPrefix(trimmed, "FIX:") {
			fix = strings.TrimSpace(strings.TrimPrefix(trimmed, "FIX:"))
		}
	}

	if title == "" {
		title = "System Anomaly Remediation"
	}
	if cause == "" {
		cause = "Service encountered unexpected runtime state."
	}
	if fix == "" {
		fix = strings.TrimSpace(raw)
	}

	return title, cause, fix
}
