package memory

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/ullashroy/poco-server/backend/internal/kuro/db"
)

type Manager struct {
	db          *db.DB
	maxRetrieve int
	dataDir     string
}

func New(database *db.DB, maxRetrieve int) *Manager {
	if maxRetrieve <= 0 {
		maxRetrieve = 15
	}
	mgr := &Manager{
		db:          database,
		maxRetrieve: maxRetrieve,
		dataDir:     "data/kuro",
	}
	return mgr
}

func (m *Manager) SetDataDir(dir string) {
	if dir != "" {
		m.dataDir = dir
	}
}

func (m *Manager) Store(username, content, category string, importance int, sourceConvID string) error {
	if content = strings.TrimSpace(content); content == "" {
		return fmt.Errorf("memory content cannot be empty")
	}
	if category == "" {
		category = "general"
	}
	if importance < 1 || importance > 10 {
		importance = 5
	}
	err := m.db.SaveOrUpdateMemoryByContent(username, content, category, importance, sourceConvID)
	if err == nil {
		go m.syncToDisk(username)
	}
	return err
}

func (m *Manager) Update(id, username, content, category string, importance int) error {
	if content = strings.TrimSpace(content); content == "" {
		return fmt.Errorf("memory content cannot be empty")
	}
	if category == "" {
		category = "general"
	}
	if importance < 1 || importance > 10 {
		importance = 5
	}
	err := m.db.UpdateMemory(id, username, content, category, importance)
	if err == nil {
		go m.syncToDisk(username)
	}
	return err
}

func (m *Manager) Delete(id, username string) error {
	err := m.db.DeleteMemory(id, username)
	if err == nil {
		go m.syncToDisk(username)
	}
	return err
}

func (m *Manager) List(username string) ([]db.Memory, error) {
	mems, err := m.db.ListMemories(username)
	if err == nil && len(mems) > 0 {
		go m.syncToDisk(username)
	}
	return mems, err
}

func (m *Manager) Retrieve(username, query string) ([]db.Memory, error) {
	// Always fetch high-importance instructions & rules (up to 60)
	allInstructions, _ := m.db.GetRecentMemories(username, 10)
	
	if query == "" {
		if len(allInstructions) > 6 {
			return allInstructions[:6], nil
		}
		return allInstructions, nil
	}

	// Search for query-specific relevant memories
	searchResults, _ := m.db.SearchMemories(username, query, 6)

	// Merge search results and instructions, deduplicating by ID
	seen := make(map[string]bool)
	var merged []db.Memory

	// Query-specific matches first
	for _, mem := range searchResults {
		if !seen[mem.ID] {
			seen[mem.ID] = true
			merged = append(merged, mem)
		}
	}

	// High priority core instructions next
	for _, mem := range allInstructions {
		if !seen[mem.ID] {
			seen[mem.ID] = true
			merged = append(merged, mem)
		}
	}

	if len(merged) > 6 {
		merged = merged[:6]
	}

	return merged, nil
}

func (m *Manager) FormatForContext(memories []db.Memory) string {
	if len(memories) == 0 {
		return ""
	}

	var sb strings.Builder
	var directives []string
	var runbooks []string
	var baselines []string

	for _, mem := range memories {
		cat := strings.ToLower(mem.Category)
		if cat == "runbook" {
			runbooks = append(runbooks, fmt.Sprintf("- 📘 [RUNBOOK] %s", mem.Content))
		} else if cat == "server_baseline" {
			baselines = append(baselines, fmt.Sprintf("- 📊 [BASELINE] %s", mem.Content))
		} else {
			catLabel := strings.ToUpper(strings.ReplaceAll(mem.Category, "_", " "))
			directives = append(directives, fmt.Sprintf("- [%s (Priority %d/10)] %s", catLabel, mem.Importance, mem.Content))
		}
	}

	if len(directives) > 0 {
		sb.WriteString("## Active Core Directives & Permissions:\n")
		sb.WriteString(strings.Join(directives, "\n"))
		sb.WriteString("\n\n")
	}

	if len(runbooks) > 0 {
		sb.WriteString("## Autonomous Troubleshooting Runbooks & Solutions:\n")
		sb.WriteString(strings.Join(runbooks, "\n"))
		sb.WriteString("\n\n")
	}

	if len(baselines) > 0 {
		sb.WriteString("## Learned Server Baselines & Hardware Patterns:\n")
		sb.WriteString(strings.Join(baselines, "\n"))
		sb.WriteString("\n\n")
	}

	return strings.TrimSpace(sb.String())
}

func (m *Manager) syncToDisk(username string) {
	mems, err := m.db.ListMemories(username)
	if err != nil {
		return
	}
	_ = os.MkdirAll(m.dataDir, 0755)

	// 1. JSON Export
	jsonPath := filepath.Join(m.dataDir, "memories.json")
	if data, err := json.MarshalIndent(mems, "", "  "); err == nil {
		_ = os.WriteFile(jsonPath, data, 0644)
	}

	// 2. Markdown Export: memories.md
	mdPath := filepath.Join(m.dataDir, "memories.md")
	var sb strings.Builder
	sb.WriteString("# Kuro AI Assistant Knowledge Base & Trained Memories\n\n")
	sb.WriteString(fmt.Sprintf("*Auto-synchronized on %s*\n\n", time.Now().Format("2006-01-02 15:04:05 MST")))

	byCat := make(map[string][]db.Memory)
	var runbookList []db.Memory
	for _, mem := range mems {
		cat := strings.ToLower(mem.Category)
		if cat == "" {
			cat = "general"
		}
		if cat == "runbook" {
			runbookList = append(runbookList, mem)
		}
		byCat[cat] = append(byCat[cat], mem)
	}

	catOrder := []string{"instruction", "server_baseline", "user_habit", "server_layout", "preference", "fact", "general"}
	for _, cat := range catOrder {
		items := byCat[cat]
		if len(items) == 0 {
			continue
		}
		title := strings.Title(strings.ReplaceAll(cat, "_", " "))
		sb.WriteString(fmt.Sprintf("## %s\n\n", title))
		for _, it := range items {
			sb.WriteString(fmt.Sprintf("- **[%d/10]** %s\n", it.Importance, it.Content))
		}
		sb.WriteString("\n")
	}

	_ = os.WriteFile(mdPath, []byte(sb.String()), 0644)

	// 3. Markdown Export: runbooks.md
	if len(runbookList) > 0 {
		runbookPath := filepath.Join(m.dataDir, "runbooks.md")
		var rbsb strings.Builder
		rbsb.WriteString("# Kuro Autonomous Troubleshooting Runbooks\n\n")
		rbsb.WriteString("*Generated via Live Web Documentation Research & Anomaly Analysis*\n")
		rbsb.WriteString(fmt.Sprintf("*Last updated: %s*\n\n", time.Now().Format("2006-01-02 15:04:05 MST")))

		for i, rb := range runbookList {
			rbsb.WriteString(fmt.Sprintf("### %d. Runbook [Priority %d/10]\n", i+1, rb.Importance))
			rbsb.WriteString(fmt.Sprintf("%s\n\n---\n\n", rb.Content))
		}
		_ = os.WriteFile(runbookPath, []byte(rbsb.String()), 0644)
	}
}

