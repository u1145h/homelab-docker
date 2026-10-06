package config

import (
	"fmt"
	"os"
	"path/filepath"
	"time"
)

type DockerConfig struct {
	SocketPath     string
	RequestTimeout time.Duration
	ActionTimeout  time.Duration
}

type TerminalConfig struct {
	DefaultShell    string
	MaxSessions     int
	IdleTimeout     time.Duration
	DefaultRows     uint16
	DefaultCols     uint16
	MaxOutputBuffer int
	MaxInputSize    int
	ReadBufferSize  int
	WriteBufferSize int
	AllowedOrigins  []string
}

type HistoryConfig struct {
	DBPath            string
	SamplingInterval  time.Duration
	RetentionPeriod   time.Duration
	CleanupInterval   time.Duration
	MaxQueryLimit     int
	DefaultResolution int
}

type KuroConfig struct {
	Enabled        bool
	DBPath         string
	Provider       string
	BaseURL        string
	APIKey         string
	Model          string
	Timeout        time.Duration
	MaxTokens      int
	Temperature    float64
	NodeSecret     string
	ContextMsgs    int
	MemoryRetrieve int

	// Assistant mode: "llm" (default) | "direct"
	AssistantMode string

	// Cloud provider (3rd party API)
	CloudEnabled  bool
	CloudProvider string // "openai"|"anthropic"|"groq"|"nvidia"|"gemini"|"custom"
	CloudModel    string // e.g. "gpt-4o-mini"
	CloudAPIKey   string // AES-256-GCM encrypted at rest
	CloudBaseURL  string // only used when CloudProvider == "custom"
}

type Config struct {
	Username        string // admin login username
	PasswordHash    string // bcrypt hash of admin password
	JWTSecret       string // secret key for JWT signing
	DataDir         string // runtime storage directory
	FileManagerRoot string // root directory for file manager
	Docker          DockerConfig
	Terminal        TerminalConfig
	History         HistoryConfig
	Kuro            KuroConfig
}

var App *Config

func Load() error {
	loadDotEnv()

	cfg := &Config{
		Username:        getenv("ADMIN_USERNAME", "admin"),
		PasswordHash:    os.Getenv("ADMIN_PASSWORD_HASH"),
		JWTSecret:       os.Getenv("JWT_SECRET"),
		DataDir:         getenv("DATA_DIR", "data"),
		FileManagerRoot: getenv("FILE_MANAGER_ROOT", "/"),
		Terminal: TerminalConfig{
			DefaultShell:    getenv("TERMINAL_DEFAULT_SHELL", os.Getenv("SHELL")),
			MaxSessions:     getIntEnv("TERMINAL_MAX_SESSIONS", 10),
			IdleTimeout:     getDurationEnv("TERMINAL_IDLE_TIMEOUT", 5*time.Minute),
			DefaultRows:     uint16(getIntEnv("TERMINAL_DEFAULT_ROWS", 24)),
			DefaultCols:     uint16(getIntEnv("TERMINAL_DEFAULT_COLS", 80)),
			MaxOutputBuffer: getIntEnv("TERMINAL_MAX_OUTPUT_BUFFER", 65536),
			MaxInputSize:    getIntEnv("TERMINAL_MAX_INPUT_SIZE", 4096),
			ReadBufferSize:  getIntEnv("TERMINAL_READ_BUFFER_SIZE", 4096),
			WriteBufferSize: getIntEnv("TERMINAL_WRITE_BUFFER_SIZE", 4096),
			AllowedOrigins:  []string{getenv("TERMINAL_ALLOWED_ORIGINS", "")},
		},
		Docker: DockerConfig{
			SocketPath:     getenv("DOCKER_SOCKET_PATH", "/var/run/docker.sock"),
			RequestTimeout: getDurationEnv("DOCKER_REQUEST_TIMEOUT", 30*time.Second),
			ActionTimeout:  getDurationEnv("DOCKER_ACTION_TIMEOUT", 60*time.Second),
		},
		History: HistoryConfig{
			DBPath:            filepath.Join(getenv("DATA_DIR", "data"), "history.db"),
			SamplingInterval:  getDurationEnv("HISTORY_SAMPLING_INTERVAL", 30*time.Second),
			RetentionPeriod:   getDurationEnv("HISTORY_RETENTION_PERIOD", 168*time.Hour),
			CleanupInterval:   getDurationEnv("HISTORY_CLEANUP_INTERVAL", 1*time.Hour),
			MaxQueryLimit:     getIntEnv("HISTORY_MAX_QUERY_LIMIT", 10000),
			DefaultResolution: getIntEnv("HISTORY_DEFAULT_RESOLUTION", 60),
		},
		Kuro: KuroConfig{
			Enabled:        getenv("KURO_ENABLED", "true") == "true",
			DBPath:         filepath.Join(getenv("DATA_DIR", "data"), "kuro.db"),
			Provider:       getenv("KURO_LLM_PROVIDER", "ollama"),
			BaseURL:        getenv("KURO_LLM_BASE_URL", "http://127.0.0.1:11434"),
			APIKey:         os.Getenv("KURO_LLM_API_KEY"),
			Model:          getenv("KURO_LLM_MODEL", "qwen2.5:3b"),
			Timeout:        getDurationEnv("KURO_LLM_TIMEOUT", 120*time.Second),
			MaxTokens:      getIntEnv("KURO_LLM_MAX_TOKENS", 2048),
			Temperature:    getFloatEnv("KURO_LLM_TEMPERATURE", 0.3),
			NodeSecret:     getenv("KURO_NODE_SECRET", getenv("JWT_SECRET", "")),
			ContextMsgs:    getIntEnv("KURO_CONTEXT_MSGS", 30),
			MemoryRetrieve: getIntEnv("KURO_MEMORY_RETRIEVE", 10),
		},
	}

	if cfg.PasswordHash == "" {
		return fmt.Errorf("missing required environment variable: ADMIN_PASSWORD_HASH")
	}

	if cfg.JWTSecret == "" {
		return fmt.Errorf("missing required environment variable: JWT_SECRET")
	}

	App = cfg

	return nil
}

func loadDotEnv() {
	paths := []string{".env", "../.env", "../../.env"}
	for _, p := range paths {
		data, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		lines := splitLines(string(data))
		for _, line := range lines {
			line = trim(line)
			if line == "" || line[0] == '#' {
				continue
			}
			idx := indexByte(line, '=')
			if idx <= 0 {
				continue
			}
			key := trim(line[:idx])
			val := trim(line[idx+1:])
			// Strip quotes if present
			if len(val) >= 2 && ((val[0] == '"' && val[len(val)-1] == '"') || (val[0] == '\'' && val[len(val)-1] == '\'')) {
				val = val[1 : len(val)-1]
			}
			if os.Getenv(key) == "" {
				_ = os.Setenv(key, val)
			}
		}
		break // Load the first matching .env file
	}
}

func splitLines(s string) []string {
	var lines []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == '\n' {
			lines = append(lines, s[start:i])
			start = i + 1
		}
	}
	if start < len(s) {
		lines = append(lines, s[start:])
	}
	return lines
}

func trim(s string) string {
	start := 0
	for start < len(s) && (s[start] == ' ' || s[start] == '\t' || s[start] == '\r') {
		start++
	}
	end := len(s)
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t' || s[end-1] == '\r') {
		end--
	}
	return s[start:end]
}

func indexByte(s string, c byte) int {
	for i := 0; i < len(s); i++ {
		if s[i] == c {
			return i
		}
	}
	return -1
}

func getDurationEnv(key string, fallback time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return fallback
	}
	return d
}

func getIntEnv(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	i := 0
	_, _ = fmt.Sscanf(v, "%d", &i)
	if i == 0 {
		return fallback
	}
	return i
}

func getFloatEnv(key string, fallback float64) float64 {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	f := 0.0
	_, _ = fmt.Sscanf(v, "%f", &f)
	if f == 0.0 {
		return fallback
	}
	return f
}

func getenv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	return value
}

