package evolution

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/ullashroy/poco-server/backend/internal/kuro/db"
	"github.com/ullashroy/poco-server/backend/internal/kuro/llm"
	"github.com/ullashroy/poco-server/backend/internal/kuro/memory"
	"github.com/ullashroy/poco-server/backend/internal/state"
)

type WorkerStatus struct {
	Active           bool               `json:"active"`
	CycleCount       int                `json:"cycle_count"`
	LastRun          *time.Time         `json:"last_run,omitempty"`
	LastAssessment   GovernorAssessment `json:"last_assessment"`
	LearnedRunbooks  int                `json:"learned_runbooks"`
	SynthesizedFacts int                `json:"synthesized_facts"`
}

// EvolutionWorker is the unified background cognitive daemon for Kuro.
// It continuously models server behavior, analyzes error patterns, conducts web research,
// and synthesizes long-term runbooks while respecting thermal, battery, and chat priority constraints.
type EvolutionWorker struct {
	mu             sync.RWMutex
	state          *state.State
	db             *db.DB
	memoryMgr      *memory.Manager
	llmProvider    llm.Provider
	governor       *HardwareGovernor
	preempt        *PreemptionCoordinator
	fastFilter     *FastPreFilter
	troubleshooter *AutonomousTroubleshooter
	defaultUser    string
	knownSigs      map[string]bool
	cycleCount     int
	lastRun        *time.Time
	lastAssessment GovernorAssessment
	cancel         context.CancelFunc
}

func NewWorker(
	st *state.State,
	database *db.DB,
	memMgr *memory.Manager,
	llmProv llm.Provider,
	preemptCoord *PreemptionCoordinator,
	defaultUser string,
) *EvolutionWorker {
	gov := NewHardwareGovernor(st, preemptCoord)
	filter := NewFastPreFilter(st, database)
	trouble := NewAutonomousTroubleshooter(llmProv)

	return &EvolutionWorker{
		state:          st,
		db:             database,
		memoryMgr:      memMgr,
		llmProvider:    llmProv,
		governor:       gov,
		preempt:        preemptCoord,
		fastFilter:     filter,
		troubleshooter: trouble,
		defaultUser:    defaultUser,
		knownSigs:      make(map[string]bool),
	}
}

// Start launches the background cognitive evolution loop.
func (w *EvolutionWorker) Start(parentCtx context.Context) {
	w.mu.Lock()
	ctx, cancel := context.WithCancel(parentCtx)
	w.cancel = cancel
	w.mu.Unlock()

	go w.runLoop(ctx)
	slog.Info("🌱 Kuro Background Cognitive Evolution Worker started (adaptive low-power mode)")
}

// Stop cleanly terminates the background evolution loop.
func (w *EvolutionWorker) Stop() {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.cancel != nil {
		w.cancel()
		w.cancel = nil
	}
}

func (w *EvolutionWorker) runLoop(ctx context.Context) {
	// Initial warm-up delay (wait 30s after startup before first background cycle)
	select {
	case <-ctx.Done():
		return
	case <-time.After(30 * time.Second):
	}

	for {
		assessment := w.governor.Assess()
		w.mu.Lock()
		w.lastAssessment = assessment
		w.mu.Unlock()

		if assessment.Allowed {
			taskCtx, cancelTask := w.preempt.RegisterBackgroundTaskContext(ctx)
			w.executeEvolutionCycle(taskCtx)
			cancelTask()
		} else {
			slog.Debug("⏳ Kuro Evolution cycle skipped", "reason", assessment.Reason)
		}

		// Sleep according to recommended duty interval
		interval := assessment.Interval
		if interval <= 0 {
			interval = IntervalCharging
		}

		select {
		case <-ctx.Done():
			return
		case <-time.After(interval):
		}
	}
}

// TriggerManualCycle allows manual on-demand execution from the web dashboard.
func (w *EvolutionWorker) TriggerManualCycle(ctx context.Context) error {
	taskCtx, cancelTask := w.preempt.RegisterBackgroundTaskContext(ctx)
	defer cancelTask()

	return w.executeEvolutionCycle(taskCtx)
}

func (w *EvolutionWorker) executeEvolutionCycle(ctx context.Context) error {
	if ctx.Err() != nil {
		return ctx.Err()
	}

	w.mu.Lock()
	now := time.Now()
	w.lastRun = &now
	w.cycleCount++
	w.mu.Unlock()

	slog.Info("🧠 Starting Kuro Cognitive Evolution Cycle", "cycle", w.cycleCount)

	user := w.defaultUser
	if user == "" {
		user = "admin"
	}

	// ─── Step 1: Pure-Go Fast Pre-Filtering (< 5ms) ───
	w.mu.RLock()
	sigsCopy := make(map[string]bool)
	for k, v := range w.knownSigs {
		sigsCopy[k] = v
	}
	w.mu.RUnlock()

	filterRes := w.fastFilter.Analyze(user, sigsCopy)

	// ─── Step 2: Commit Baselines & Habits to Knowledge Store ───
	for _, baseFact := range filterRes.Baselines {
		if ctx.Err() != nil {
			slog.Info("⚡ Kuro Evolution yielded: user preemption")
			return ctx.Err()
		}
		_ = w.memoryMgr.Store(user, baseFact, "server_baseline", 6, "")
	}

	for _, habitFact := range filterRes.Habits {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		_ = w.memoryMgr.Store(user, habitFact, "user_habit", 7, "")
	}

	// ─── Step 3: Autonomous Web Troubleshooting for Novel Anomalies ───
	if filterRes.NeedsWebResearch && len(filterRes.Anomalies) > 0 {
		for i, anomaly := range filterRes.Anomalies {
			if ctx.Err() != nil {
				slog.Info("⚡ Kuro Evolution yielded during research: user preemption")
				return ctx.Err()
			}

			// Micro-step cooldown pause to allow ARM CPUs to shed heat
			if i > 0 {
				select {
				case <-ctx.Done():
					return ctx.Err()
				case <-time.After(500 * time.Millisecond):
				}
			}

			runbook, err := w.troubleshooter.InvestigateAnomaly(ctx, anomaly)
			if err == nil && runbook != nil {
				w.mu.Lock()
				w.knownSigs[anomaly.Signature] = true
				w.mu.Unlock()

				runbookContent := fmt.Sprintf(
					"[%s]\nProblem: %s\nRoot Cause: %s\nFix: %s",
					runbook.Title, runbook.ErrorSample, runbook.RootCause, runbook.Remediation,
				)
				_ = w.memoryMgr.Store(user, runbookContent, "runbook", 9, "")
				slog.Info("📘 Kuro synthesized new troubleshooting runbook", "title", runbook.Title)
			}
		}
	}

	slog.Info("✨ Kuro Cognitive Evolution Cycle finished", "cycle", w.cycleCount)
	return nil
}

// GetStatus returns the current live state of the evolution daemon.
func (w *EvolutionWorker) GetStatus() WorkerStatus {
	w.mu.RLock()
	defer w.mu.RUnlock()

	knownCount := len(w.knownSigs)
	return WorkerStatus{
		Active:           w.cancel != nil,
		CycleCount:       w.cycleCount,
		LastRun:          w.lastRun,
		LastAssessment:   w.lastAssessment,
		LearnedRunbooks:  knownCount,
		SynthesizedFacts: w.cycleCount * 2,
	}
}

// PreemptionCoordinator exposes the shared preemption coordinator.
func (w *EvolutionWorker) PreemptionCoordinator() *PreemptionCoordinator {
	return w.preempt
}
