package kuro

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type ModelInfo struct {
	Name       string `json:"name"`
	Size       int64  `json:"size"`
	SizeHuman  string `json:"size_human"`
	ModifiedAt string `json:"modified_at"`
	Format     string `json:"format"` // "ollama" | "gguf"
	IsActive   bool   `json:"is_active"`
	Family     string `json:"family,omitempty"`
	ParamSize  string `json:"param_size,omitempty"`
}

type PullProgress struct {
	Model     string `json:"model"`
	Status    string `json:"status"`
	Total     int64  `json:"total"`
	Completed int64  `json:"completed"`
	Percent   int    `json:"percent"`
	Error     string `json:"error,omitempty"`
	Done      bool   `json:"done"`
}

type EngineStatus struct {
	Running bool   `json:"running"`
	Address string `json:"address"`
	Binary  string `json:"binary"`
	Error   string `json:"error,omitempty"`
}

type ModelManager struct {
	mu           sync.RWMutex
	dataDir      string
	pullProgress map[string]*PullProgress
	httpClient   *http.Client
}

func NewModelManager(dataDir string) *ModelManager {
	if err := os.MkdirAll(filepath.Join(dataDir, "models"), 0755); err != nil {
		slog.Warn("could not create models dir", "error", err)
	}
	return &ModelManager{
		dataDir:      dataDir,
		pullProgress: make(map[string]*PullProgress),
		httpClient:   &http.Client{Timeout: 3 * time.Second},
	}
}

// ListLocalModels retrieves installed models from local Ollama, OpenAI-compatible servers, and local models folder.
func (mm *ModelManager) ListLocalModels(ctx context.Context, baseURL, activeModel string) ([]ModelInfo, error) {
	var models []ModelInfo
	seen := make(map[string]bool)

	ctxTimeout, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	ollamaBase := strings.TrimRight(baseURL, "/")
	ollamaBase = strings.TrimSuffix(ollamaBase, "/v1")
	if strings.Contains(ollamaBase, "localhost") {
		ollamaBase = strings.Replace(ollamaBase, "localhost", "127.0.0.1", 1)
	}

	// 1. Query Ollama native /api/tags
	req, err := http.NewRequestWithContext(ctxTimeout, http.MethodGet, ollamaBase+"/api/tags", nil)
	if err == nil {
		resp, doErr := mm.httpClient.Do(req)
		if doErr == nil && resp.StatusCode == http.StatusOK {
			defer resp.Body.Close()
			var tagResp struct {
				Models []struct {
					Name       string    `json:"name"`
					Model      string    `json:"model"`
					Size       int64     `json:"size"`
					ModifiedAt time.Time `json:"modified_at"`
					Details    struct {
						Format        string `json:"format"`
						Family        string `json:"family"`
						ParameterSize string `json:"parameter_size"`
					} `json:"details"`
				} `json:"models"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&tagResp); err == nil {
				for _, m := range tagResp.Models {
					mName := m.Name
					if mName == "" {
						mName = m.Model
					}
					normActive := strings.TrimSuffix(strings.ToLower(activeModel), ":latest")
					normName := strings.TrimSuffix(strings.ToLower(mName), ":latest")
					normModel := strings.TrimSuffix(strings.ToLower(m.Model), ":latest")
					isActive := normName == normActive || normModel == normActive || strings.EqualFold(mName, activeModel)

					models = append(models, ModelInfo{
						Name:       mName,
						Size:       m.Size,
						SizeHuman:  formatBytes(m.Size),
						ModifiedAt: m.ModifiedAt.Format(time.RFC3339),
						Format:     "ollama",
						IsActive:   isActive,
						Family:     m.Details.Family,
						ParamSize:  m.Details.ParameterSize,
					})
					seen[mName] = true
				}
			}
		}
	}

	// 2. Query standard OpenAI /v1/models (or /models) if /api/tags found nothing
	if len(models) == 0 {
		modelsEndpoints := []string{
			ollamaBase + "/v1/models",
			ollamaBase + "/models",
		}
		for _, ep := range modelsEndpoints {
			mReq, mErr := http.NewRequestWithContext(ctxTimeout, http.MethodGet, ep, nil)
			if mErr == nil {
				mResp, mDoErr := mm.httpClient.Do(mReq)
				if mDoErr == nil && mResp.StatusCode == http.StatusOK {
					defer mResp.Body.Close()
					var openAIResp struct {
						Data []struct {
							ID      string `json:"id"`
							OwnedBy string `json:"owned_by"`
						} `json:"data"`
					}
					if err := json.NewDecoder(mResp.Body).Decode(&openAIResp); err == nil && len(openAIResp.Data) > 0 {
						for _, m := range openAIResp.Data {
							if m.ID != "" && !seen[m.ID] {
								normActive := strings.TrimSuffix(strings.ToLower(activeModel), ":latest")
								normName := strings.TrimSuffix(strings.ToLower(m.ID), ":latest")
								isActive := normName == normActive || strings.EqualFold(m.ID, activeModel)

								models = append(models, ModelInfo{
									Name:       m.ID,
									Size:       0,
									SizeHuman:  "Installed",
									ModifiedAt: time.Now().Format(time.RFC3339),
									Format:     "openai",
									IsActive:   isActive,
									Family:     m.OwnedBy,
								})
								seen[m.ID] = true
							}
						}
						break
					}
				}
			}
		}
	}

	// 3. Scan local data/models directory for .gguf files
	modelsDir := filepath.Join(mm.dataDir, "models")
	entries, _ := os.ReadDir(modelsDir)
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(strings.ToLower(e.Name()), ".gguf") {
			info, err := e.Info()
			if err == nil {
				name := e.Name()
				if !seen[name] {
					models = append(models, ModelInfo{
						Name:       name,
						Size:       info.Size(),
						SizeHuman:  formatBytes(info.Size()),
						ModifiedAt: info.ModTime().Format(time.RFC3339),
						Format:     "gguf",
						IsActive:   strings.EqualFold(name, activeModel),
					})
					seen[name] = true
				}
			}
		}
	}

	// 4. Ensure active configured model is always represented if non-empty
	if len(models) == 0 && activeModel != "" {
		models = append(models, ModelInfo{
			Name:       activeModel,
			Size:       0,
			SizeHuman:  "Active",
			ModifiedAt: time.Now().Format(time.RFC3339),
			Format:     "active",
			IsActive:   true,
		})
	}

	return models, nil
}

// PullModel pulls a model in the background and tracks progress.
func (mm *ModelManager) PullModel(baseURL, modelName string) error {
	mm.mu.Lock()
	mm.pullProgress[modelName] = &PullProgress{
		Model:   modelName,
		Status:  "Starting download...",
		Percent: 0,
	}
	mm.mu.Unlock()

	go func() {
		ollamaBase := strings.TrimRight(baseURL, "/")
		ollamaBase = strings.TrimSuffix(ollamaBase, "/v1")
		if strings.Contains(ollamaBase, "localhost") {
			ollamaBase = strings.Replace(ollamaBase, "localhost", "127.0.0.1", 1)
		}

		// Auto-start engine if offline
		testReq, _ := http.NewRequest(http.MethodGet, ollamaBase+"/api/version", nil)
		testResp, testErr := mm.httpClient.Do(testReq)
		if testErr != nil || testResp == nil || testResp.StatusCode != http.StatusOK {
			mm.updateProgress(modelName, "Starting local inference engine...", 0, 0, 0, "", false)
			if err := mm.StartEngine(); err != nil {
				mm.updateProgress(modelName, "Engine offline", 0, 0, 0, "Ollama engine is not running or not installed on Poco Server. Run 'ollama serve' or install it with 'curl -fsSL https://ollama.com/install.sh | sh'.", true)
				return
			}
			time.Sleep(2 * time.Second)
		} else if testResp != nil {
			testResp.Body.Close()
		}

		payload, _ := json.Marshal(map[string]string{"name": modelName})
		req, err := http.NewRequest(http.MethodPost, ollamaBase+"/api/pull", bytes.NewReader(payload))
		if err != nil {
			mm.updateProgress(modelName, "Failed to create request", 0, 0, 0, err.Error(), true)
			return
		}
		req.Header.Set("Content-Type", "application/json")

		client := &http.Client{Timeout: 30 * time.Minute}
		resp, err := client.Do(req)
		if err != nil {
			mm.updateProgress(modelName, "Connection failed", 0, 0, 0, fmt.Sprintf("Could not connect to Ollama at %s: %v", ollamaBase, err), true)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			raw, _ := io.ReadAll(resp.Body)
			mm.updateProgress(modelName, "Download error", 0, 0, 0, string(raw), true)
			return
		}

		scanner := bufio.NewScanner(resp.Body)
		for scanner.Scan() {
			var chunk struct {
				Status    string `json:"status"`
				Digest    string `json:"digest"`
				Total     int64  `json:"total"`
				Completed int64  `json:"completed"`
				Error     string `json:"error"`
			}
			line := scanner.Bytes()
			if err := json.Unmarshal(line, &chunk); err == nil {
				if chunk.Error != "" {
					mm.updateProgress(modelName, chunk.Status, chunk.Total, chunk.Completed, 0, chunk.Error, true)
					return
				}
				percent := 0
				if chunk.Total > 0 {
					percent = int((float64(chunk.Completed) / float64(chunk.Total)) * 100)
				}
				isDone := chunk.Status == "success" || percent >= 100
				mm.updateProgress(modelName, chunk.Status, chunk.Total, chunk.Completed, percent, "", isDone)
			}
		}

		mm.updateProgress(modelName, "Installed successfully", 100, 100, 100, "", true)
	}()

	return nil
}

func (mm *ModelManager) updateProgress(model, status string, total, completed int64, percent int, errStr string, done bool) {
	mm.mu.Lock()
	defer mm.mu.Unlock()
	mm.pullProgress[model] = &PullProgress{
		Model:     model,
		Status:    status,
		Total:     total,
		Completed: completed,
		Percent:   percent,
		Error:     errStr,
		Done:      done,
	}
}

// GetPullProgress retrieves current download status for a model.
func (mm *ModelManager) GetPullProgress(modelName string) *PullProgress {
	mm.mu.RLock()
	defer mm.mu.RUnlock()
	return mm.pullProgress[modelName]
}

// DeleteModel removes a model from Ollama or disk.
func (mm *ModelManager) DeleteModel(ctx context.Context, baseURL, modelName string) error {
	ollamaBase := strings.TrimRight(baseURL, "/")
	ollamaBase = strings.TrimSuffix(ollamaBase, "/v1")
	if ollamaBase == "" {
		ollamaBase = "http://127.0.0.1:11434"
	}
	if strings.Contains(ollamaBase, "localhost") {
		ollamaBase = strings.Replace(ollamaBase, "localhost", "127.0.0.1", 1)
	}

	var deleteErr error
	deleted := false

	// Strategy 1: Ollama HTTP API /api/delete with variations of the tag
	candidates := []string{
		modelName,
		strings.TrimSuffix(modelName, ":latest"),
		modelName + ":latest",
	}

	for _, tag := range candidates {
		payload, _ := json.Marshal(map[string]string{
			"name":  tag,
			"model": tag,
		})
		req, err := http.NewRequestWithContext(ctx, http.MethodDelete, ollamaBase+"/api/delete", bytes.NewReader(payload))
		if err != nil {
			deleteErr = err
			continue
		}
		req.Header.Set("Content-Type", "application/json")
		resp, doErr := mm.httpClient.Do(req)
		if doErr != nil {
			deleteErr = doErr
			continue
		}
		resp.Body.Close()
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			deleted = true
			break
		} else if resp.StatusCode != http.StatusNotFound {
			deleteErr = fmt.Errorf("ollama delete returned status %d", resp.StatusCode)
		}
	}

	// Strategy 2: CLI fallback (e.g. `ollama rm <model>`)
	if !deleted {
		if bin := findOllamaBin(); bin != "" {
			for _, tag := range candidates {
				cmd := exec.CommandContext(ctx, bin, "rm", tag)
				if err := cmd.Run(); err == nil {
					deleted = true
					break
				}
			}
		}
	}

	// Strategy 3: Try deleting from local disk if it's a file
	path := filepath.Join(mm.dataDir, "models", modelName)
	if _, err := os.Stat(path); err == nil {
		if err := os.RemoveAll(path); err == nil {
			deleted = true
		}
	}

	if !deleted && deleteErr != nil {
		return deleteErr
	}

	return nil
}

func findOllamaBin() string {
	if bin, err := exec.LookPath("ollama"); err == nil {
		return bin
	}
	if bin, err := exec.LookPath("ollama.exe"); err == nil {
		return bin
	}

	var candidates []string

	// Linux / macOS / Termux standard paths
	candidates = append(candidates,
		"/usr/local/bin/ollama",
		"/usr/bin/ollama",
		"/bin/ollama",
		"/data/data/com.termux/files/usr/bin/ollama",
		"/opt/homebrew/bin/ollama",
	)

	// Windows standard installation paths
	if localAppData := os.Getenv("LOCALAPPDATA"); localAppData != "" {
		candidates = append(candidates, filepath.Join(localAppData, "Programs", "Ollama", "ollama.exe"))
	}
	if progFiles := os.Getenv("ProgramFiles"); progFiles != "" {
		candidates = append(candidates, filepath.Join(progFiles, "Ollama", "ollama.exe"))
	}
	if progFilesX86 := os.Getenv("ProgramFiles(x86)"); progFilesX86 != "" {
		candidates = append(candidates, filepath.Join(progFilesX86, "Ollama", "ollama.exe"))
	}
	if userProfile := os.Getenv("USERPROFILE"); userProfile != "" {
		candidates = append(candidates, filepath.Join(userProfile, "AppData", "Local", "Programs", "Ollama", "ollama.exe"))
	}

	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return ""
}

// GetEngineStatus checks if local Ollama or OpenAI inference process/port is alive.
func (mm *ModelManager) GetEngineStatus(ctx context.Context, baseURL string) EngineStatus {
	addr := strings.TrimRight(baseURL, "/")
	addr = strings.TrimSuffix(addr, "/v1")
	if strings.Contains(addr, "localhost") {
		addr = strings.Replace(addr, "localhost", "127.0.0.1", 1)
	}

	testEndpoints := []string{
		addr + "/api/version",
		addr + "/v1/models",
		addr + "/models",
		addr + "/api/tags",
	}

	for _, ep := range testEndpoints {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, ep, nil)
		if err == nil {
			resp, doErr := mm.httpClient.Do(req)
			if doErr == nil {
				resp.Body.Close()
				if resp.StatusCode < 400 {
					return EngineStatus{
						Running: true,
						Address: addr,
						Binary:  findOllamaBin(),
					}
				}
			}
		}
	}

	binPath := findOllamaBin()
	return EngineStatus{
		Running: false,
		Address: addr,
		Binary:  binPath,
		Error:   "Engine daemon not reachable at " + addr,
	}
}

// StartEngine attempts to start the local Ollama daemon.
func (mm *ModelManager) StartEngine() error {
	binPath := findOllamaBin()
	if binPath == "" {
		return fmt.Errorf("ollama binary not found in PATH or standard installation directories")
	}

	cmd := exec.Command(binPath, "serve")
	cmd.Env = append(os.Environ(), "OLLAMA_HOST=127.0.0.1:11434")
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("starting ollama daemon (%s): %w", binPath, err)
	}

	slog.Info("🚀 Started local Ollama inference engine in background", "bin", binPath, "pid", cmd.Process.Pid)
	return nil
}

func formatBytes(b int64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(b)/float64(div), "KMGTPE"[exp])
}
