package kuro

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"github.com/ullashroy/poco-server/backend/internal/camera"
	"github.com/ullashroy/poco-server/backend/internal/config"
	"github.com/ullashroy/poco-server/backend/internal/docker"
	"github.com/ullashroy/poco-server/backend/internal/kuro/agent"
	"github.com/ullashroy/poco-server/backend/internal/kuro/crypto"
	"github.com/ullashroy/poco-server/backend/internal/kuro/db"
	"github.com/ullashroy/poco-server/backend/internal/kuro/evolution"
	"github.com/ullashroy/poco-server/backend/internal/kuro/llm"
	"github.com/ullashroy/poco-server/backend/internal/kuro/llm/anthropic"
	"github.com/ullashroy/poco-server/backend/internal/kuro/llm/needle"
	"github.com/ullashroy/poco-server/backend/internal/kuro/llm/openai_compat"
	"github.com/ullashroy/poco-server/backend/internal/kuro/memory"
	"github.com/ullashroy/poco-server/backend/internal/kuro/node"
	"github.com/ullashroy/poco-server/backend/internal/kuro/storage"
	"github.com/ullashroy/poco-server/backend/internal/kuro/tools"
	"github.com/ullashroy/poco-server/backend/internal/state"
)

// Service is the unified Kuro AI engine running inside poco-serverd.
type Service struct {
	DB          *db.DB
	JSONStore   *storage.JSONStore
	Store       *storage.JSONStore
	LLM         llm.Provider
	Memory      *memory.Manager
	Nodes       *node.Manager
	Models      *ModelManager
	Agent       *agent.Agent
	PocoTools   *tools.PocoToolHandler
	Evolution   *evolution.EvolutionWorker
	Config      config.KuroConfig
	DefaultUser string
}

func NewService(cfg config.KuroConfig, defaultUser string, st *state.State, ds *docker.Service, cs *camera.Service) (*Service, error) {
	dataDir := filepath.Dir(cfg.DBPath)
	if dataDir == "" || dataDir == "." {
		dataDir = "data"
	}
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		slog.Warn("could not create data directory for kuro", "path", dataDir, "error", err)
	}

	// 1. Initialize local JSON persistence store (100% device-only)
	jsonStore, err := storage.NewJSONStore(dataDir)
	if err != nil {
		slog.Warn("initializing local json store warning", "error", err)
	}

	// Restore persisted mode/cloud settings so they survive server restarts
	if jsonStore != nil {
		var modeConfig struct {
			AssistantMode string `json:"assistant_mode"`
			CloudEnabled  bool   `json:"cloud_enabled"`
			CloudProvider string `json:"cloud_provider"`
			CloudModel    string `json:"cloud_model"`
			CloudAPIKey   string `json:"cloud_api_key"` // already encrypted
			CloudBaseURL  string `json:"cloud_base_url"`
		}
		if getErr := jsonStore.Get("kuro_mode_config", &modeConfig); getErr == nil {
			if modeConfig.AssistantMode != "" {
				cfg.AssistantMode = modeConfig.AssistantMode
			}
			cfg.CloudEnabled = modeConfig.CloudEnabled
			if modeConfig.CloudProvider != "" {
				cfg.CloudProvider = modeConfig.CloudProvider
			}
			if modeConfig.CloudModel != "" {
				cfg.CloudModel = modeConfig.CloudModel
			}
			if modeConfig.CloudAPIKey != "" {
				cfg.CloudAPIKey = modeConfig.CloudAPIKey
			}
			if modeConfig.CloudBaseURL != "" {
				cfg.CloudBaseURL = modeConfig.CloudBaseURL
			}
			slog.Info("🔄 Restored persisted mode config", "mode", cfg.AssistantMode, "cloud_enabled", cfg.CloudEnabled, "cloud_provider", cfg.CloudProvider)
		}
	}

	// 2. Initialize SQLite database
	database, err := db.New(cfg.DBPath)
	if err != nil {
		slog.Error("kuro database init error, attempting fallback in-memory database", "db_path", cfg.DBPath, "error", err)
		fallbackDB, fbErr := db.New(":memory:")
		if fbErr == nil {
			database = fallbackDB
		}
	}

	// 3. Initialize swappable LLM provider
	var llmProvider llm.Provider
	if cfg.Provider == "needle" || cfg.Provider == "cactus" {
		llmProvider = needle.New(needle.Config{
			BaseURL: cfg.BaseURL,
			Model:   cfg.Model,
			Timeout: cfg.Timeout,
		})
	} else {
		llmProvider = openai_compat.New(openai_compat.Config{
			BaseURL:     cfg.BaseURL,
			APIKey:      cfg.APIKey,
			Model:       cfg.Model,
			ProviderTag: cfg.Provider,
			Timeout:     cfg.Timeout,
			MaxTokens:   cfg.MaxTokens,
			Temperature: cfg.Temperature,
		})
	}

	if err := llmProvider.Health(); err != nil {
		slog.Warn("⚠️ Kuro LLM provider not reachable on startup (offline inference engine)",
			"provider", cfg.Provider,
			"model", cfg.Model,
			"error", err,
		)
	} else {
		slog.Info("✅ Kuro LLM provider ready",
			"provider", llmProvider.ProviderName(),
			"model", llmProvider.ModelName(),
		)
	}

	// 4. Subsystems & Preemption
	preemptCoord := evolution.NewPreemptionCoordinator(30 * time.Second)
	memManager := memory.New(database, cfg.MemoryRetrieve)
	nodeManager := node.NewManager(cfg.NodeSecret, 90*time.Second, database)
	pocoTools := tools.NewPocoToolHandler(st, ds, cs, database, nodeManager, jsonStore)
	modelManager := NewModelManager(dataDir)

	// 5. Agent Engine
	agentEngine := agent.New(agent.Config{
		LLM:         llmProvider,
		Memory:      memManager,
		Nodes:       nodeManager,
		PocoTools:   pocoTools,
		DB:          database,
		MaxContext:  cfg.ContextMsgs,
		DefaultUser: defaultUser,
		Preempt:     preemptCoord,
	})

	// 6. Background Cognitive Evolution Worker (Daemon)
	evolutionWorker := evolution.NewWorker(st, database, memManager, llmProvider, preemptCoord, defaultUser)
	evolutionWorker.Start(context.Background())

	slog.Info("🧠 Kuro AI subsystem initialized with Cognitive Evolution", "db", cfg.DBPath, "model", cfg.Model)

	return &Service{
		DB:          database,
		JSONStore:   jsonStore,
		Store:       jsonStore,
		LLM:         llmProvider,
		Memory:      memManager,
		Nodes:       nodeManager,
		Models:      modelManager,
		Agent:       agentEngine,
		PocoTools:   pocoTools,
		Evolution:   evolutionWorker,
		Config:      cfg,
		DefaultUser: defaultUser,
	}, nil
}

func (s *Service) UpdateConfig(cfg config.KuroConfig) error {
	s.Config = cfg

	var activeLLM llm.Provider
	agentMode := cfg.AssistantMode
	if agentMode == "" {
		agentMode = "llm"
	}

	if cfg.CloudEnabled && cfg.CloudAPIKey != "" {
		apiKey, err := crypto.DecryptAPIKey(cfg.CloudAPIKey, cfg.NodeSecret)
		if err != nil || apiKey == "" {
			slog.Warn("⚠️ Cloud API key decrypt failed, falling back to local LLM", "error", err)
			goto localLLM
		}

		switch cfg.CloudProvider {
		case "anthropic":
			activeLLM = anthropic.New(anthropic.Config{
				APIKey:    apiKey,
				Model:     cfg.CloudModel,
				MaxTokens: cfg.MaxTokens,
			})
		case "custom":
			activeLLM = openai_compat.New(openai_compat.Config{
				BaseURL:     cfg.CloudBaseURL,
				APIKey:      apiKey,
				Model:       cfg.CloudModel,
				ProviderTag: "custom",
			})
		default: // openai, groq, nvidia, gemini — all OpenAI-compat
			cloudBaseURLs := map[string]string{
				"openai": "https://api.openai.com/v1",
				"groq":   "https://api.groq.com/openai/v1",
				"nvidia": "https://integrate.api.nvidia.com/v1",
				"gemini": "https://generativelanguage.googleapis.com/v1beta/openai",
			}
			base, ok := cloudBaseURLs[cfg.CloudProvider]
			if !ok {
				base = "https://api.openai.com/v1"
			}
			activeLLM = openai_compat.New(openai_compat.Config{
				BaseURL:     base,
				APIKey:      apiKey,
				Model:       cfg.CloudModel,
				ProviderTag: cfg.CloudProvider,
			})
		}
		agentMode = "cloud"
		slog.Info("☁️ Kuro switched to cloud provider", "provider", cfg.CloudProvider, "model", cfg.CloudModel)
		goto applyLLM
	}

localLLM:
	activeLLM = openai_compat.New(openai_compat.Config{
		BaseURL:     cfg.BaseURL,
		APIKey:      cfg.APIKey,
		Model:       cfg.Model,
		ProviderTag: cfg.Provider,
		Timeout:     cfg.Timeout,
		MaxTokens:   cfg.MaxTokens,
		Temperature: cfg.Temperature,
	})
	slog.Info("🔄 Kuro settings updated dynamically", "model", cfg.Model, "provider", cfg.Provider, "base_url", cfg.BaseURL)

applyLLM:
	s.LLM = activeLLM
	s.Agent.SetLLM(activeLLM)
	s.Agent.SetMode(agentMode, cfg.CloudProvider)
	s.Memory = memory.New(s.DB, cfg.MemoryRetrieve)
	return nil
}

func (s *Service) Close() error {
	if s.Evolution != nil {
		s.Evolution.Stop()
	}
	if s.DB != nil {
		return s.DB.Close()
	}
	return nil
}
