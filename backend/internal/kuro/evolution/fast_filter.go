package evolution

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/ullashroy/poco-server/backend/internal/docker"
	"github.com/ullashroy/poco-server/backend/internal/kuro/db"
	"github.com/ullashroy/poco-server/backend/internal/state"
)

type DetectedAnomaly struct {
	Source      string `json:"source"`
	Signature   string `json:"signature"`
	RawError    string `json:"raw_error"`
	Occurrences int    `json:"occurrences"`
	ExitCode    int    `json:"exit_code,omitempty"`
}

type FilterResult struct {
	Baselines        []string          `json:"baselines"`
	Anomalies        []DetectedAnomaly `json:"anomalies"`
	Habits           []string          `json:"habits"`
	NeedsWebResearch bool              `json:"needs_web_research"`
}

var (
	rePanic      = regexp.MustCompile(`(?i)(panic:|fatal error:|runtime error:)`)
	reOOM        = regexp.MustCompile(`(?i)(oomkilled|out of memory|exit code 137|exit status 137)`)
	rePortBind   = regexp.MustCompile(`(?i)(bind: address already in use|port is already allocated)`)
	reConnRefuse = regexp.MustCompile(`(?i)(connection refused|dial tcp.*connect: connection refused)`)
	rePermission = regexp.MustCompile(`(?i)(permission denied|access denied|operation not permitted)`)
)

// FastPreFilter executes ultra-fast mathematical, statistical, and regex-based
// heuristics in pure Go without consuming any LLM tokens or GPU/CPU cycles.
type FastPreFilter struct {
	state *state.State
	db    *db.DB
}

func NewFastPreFilter(st *state.State, database *db.DB) *FastPreFilter {
	return &FastPreFilter{
		state: st,
		db:    database,
	}
}

func (f *FastPreFilter) Analyze(username string, knownRunbookSigs map[string]bool) FilterResult {
	res := FilterResult{
		Baselines: make([]string, 0),
		Anomalies: make([]DetectedAnomaly, 0),
		Habits:    make([]string, 0),
	}

	if f.state == nil {
		return res
	}

	st := f.state.Status()

	// 1. Server Baseline Modeling (Pure Math)
	if st.Memory.Total > 0 && st.Storage.Summary.TotalCapacity > 0 {
		memUsedGB := float64(st.Memory.Used) / (1024 * 1024 * 1024)
		memTotalGB := float64(st.Memory.Total) / (1024 * 1024 * 1024)
		memPct := (memUsedGB / memTotalGB) * 100

		storageFreeGB := float64(st.Storage.Summary.Free) / (1024 * 1024 * 1024)
		storageTotalGB := float64(st.Storage.Summary.TotalCapacity) / (1024 * 1024 * 1024)
		storagePct := (float64(st.Storage.Summary.Used) / float64(st.Storage.Summary.TotalCapacity)) * 100

		baselineFact := fmt.Sprintf(
			"Host RAM load averages %.1f/%.1f GB (%.1f%%); Disk capacity has %.1f/%.1f GB available (%.1f%% used).",
			memUsedGB, memTotalGB, memPct, storageFreeGB, storageTotalGB, storagePct,
		)
		res.Baselines = append(res.Baselines, baselineFact)
	}

	// 2. Docker Service Health & Crash Detection
	if len(st.Docker.Containers) > 0 {
		var runningCount, stoppedCount, crashCount int
		for _, c := range st.Docker.Containers {
			stateLower := strings.ToLower(c.State)
			statusLower := strings.ToLower(c.Status)

			if stateLower == "running" {
				runningCount++
			} else {
				stoppedCount++
			}

			// Check for exit codes indicating abnormal termination
			if strings.Contains(statusLower, "exited (137)") || strings.Contains(statusLower, "exit 137") {
				crashCount++
				sig := fmt.Sprintf("docker_%s_oom_137", c.Name)
				if !knownRunbookSigs[sig] {
					res.Anomalies = append(res.Anomalies, DetectedAnomaly{
						Source:      fmt.Sprintf("Docker Container %s", c.Name),
						Signature:   sig,
						RawError:    fmt.Sprintf("Container %s was terminated with OOMKilled (Exit Code 137). Memory limit exceeded.", c.Name),
						Occurrences: 1,
						ExitCode:    137,
					})
				}
			} else if strings.Contains(statusLower, "exited (1)") || strings.Contains(statusLower, "restarting") {
				crashCount++
				sig := fmt.Sprintf("docker_%s_crash", c.Name)
				if !knownRunbookSigs[sig] {
					res.Anomalies = append(res.Anomalies, DetectedAnomaly{
						Source:      fmt.Sprintf("Docker Container %s", c.Name),
						Signature:   sig,
						RawError:    fmt.Sprintf("Container %s is in a crash/restart loop: %s", c.Name, c.Status),
						Occurrences: 1,
						ExitCode:    1,
					})
				}
			}
		}

		dockerFact := fmt.Sprintf(
			"Docker topology: %d containers active (%d running, %d stopped, %d abnormal).",
			len(st.Docker.Containers), runningCount, stoppedCount, crashCount,
		)
		res.Baselines = append(res.Baselines, dockerFact)
	}

	// 3. Scan Recent System Activities for Errors
	if f.state.Activities() != nil {
		acts, _ := f.state.Activities().Query(0, 40)
		anomalyMap := make(map[string]*DetectedAnomaly)

		for _, act := range acts {
			desc := act.Text
			var sig, rawErr string

			if rePanic.MatchString(desc) {
				sig = "system_runtime_panic"
				rawErr = desc
			} else if reOOM.MatchString(desc) {
				sig = "system_memory_exhaustion"
				rawErr = desc
			} else if rePortBind.MatchString(desc) {
				sig = "network_port_collision"
				rawErr = desc
			} else if reConnRefuse.MatchString(desc) {
				sig = "service_connection_refused"
				rawErr = desc
			} else if rePermission.MatchString(desc) {
				sig = "system_permission_denied"
				rawErr = desc
			}

			if sig != "" && !knownRunbookSigs[sig] {
				if existing, ok := anomalyMap[sig]; ok {
					existing.Occurrences++
				} else {
					anomalyMap[sig] = &DetectedAnomaly{
						Source:      act.Type,
						Signature:   sig,
						RawError:    rawErr,
						Occurrences: 1,
					}
				}
			}
		}

		for _, anom := range anomalyMap {
			res.Anomalies = append(res.Anomalies, *anom)
		}
	}

	// 4. Conversation Habit & Query Frequency Analysis
	if f.db != nil && username != "" {
		if msgs, err := f.db.GetRecentUserMessages(username, 60); err == nil && len(msgs) > 0 {
			var callQueryCount, dockerQueryCount, photoQueryCount, netQueryCount, cameraQueryCount int

			for _, m := range msgs {
				contentLower := strings.ToLower(m.Content)
				if strings.Contains(contentLower, "call") || strings.Contains(contentLower, "phone") || strings.Contains(contentLower, "sms") {
					callQueryCount++
				}
				if strings.Contains(contentLower, "docker") || strings.Contains(contentLower, "container") {
					dockerQueryCount++
				}
				if strings.Contains(contentLower, "photo") || strings.Contains(contentLower, "image") || strings.Contains(contentLower, "immich") {
					photoQueryCount++
				}
				if strings.Contains(contentLower, "tailscale") || strings.Contains(contentLower, "vpn") || strings.Contains(contentLower, "network") || strings.Contains(contentLower, "ip ") {
					netQueryCount++
				}
				if strings.Contains(contentLower, "camera") || strings.Contains(contentLower, "stream") {
					cameraQueryCount++
				}
			}

			if callQueryCount >= 2 {
				res.Habits = append(res.Habits, "User frequently queries telephone call records, contacts, and phone telemetry.")
			}
			if dockerQueryCount >= 2 {
				res.Habits = append(res.Habits, "User actively manages and inspects server Docker containers via assistant.")
			}
			if photoQueryCount >= 2 {
				res.Habits = append(res.Habits, "User frequently searches Immich photo gallery by date, year, and visual semantic concepts.")
			}
			if netQueryCount >= 2 {
				res.Habits = append(res.Habits, "User monitors Tailscale mesh network, IP allocations, and remote device connectivity.")
			}
			if cameraQueryCount >= 2 {
				res.Habits = append(res.Habits, "User monitors device camera feeds and multimedia streaming endpoints.")
			}
		}
	}

	if len(res.Anomalies) > 0 {
		res.NeedsWebResearch = true
	}

	return res
}

func FormatDockerDetails(containers []docker.ContainerSummary) string {
	var sb strings.Builder
	for _, c := range containers {
		sb.WriteString(fmt.Sprintf("- %s (%s): %s\n", c.Name, c.Image, c.Status))
	}
	return sb.String()
}
