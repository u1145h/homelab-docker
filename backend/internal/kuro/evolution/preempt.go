package evolution

import (
	"context"
	"sync"
	"time"
)

// PreemptionCoordinator ensures interactive user chat requests always have 100% priority,
// immediately preempting / canceling background evolution tasks in < 1ms.
type PreemptionCoordinator struct {
	mu                 sync.RWMutex
	lastUserActivity   time.Time
	currentCancel      context.CancelFunc
	quietPeriod        time.Duration
	activeUserRequests int
}

func NewPreemptionCoordinator(quietPeriod time.Duration) *PreemptionCoordinator {
	if quietPeriod <= 0 {
		quietPeriod = 30 * time.Second
	}
	return &PreemptionCoordinator{
		quietPeriod: quietPeriod,
	}
}

// NotifyUserActivity is called immediately when an interactive user message arrives.
// It cancels any ongoing background evolution task context instantly and records the activity timestamp.
func (p *PreemptionCoordinator) NotifyUserActivity() {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.lastUserActivity = time.Now()
	p.activeUserRequests++

	if p.currentCancel != nil {
		p.currentCancel()
		p.currentCancel = nil
	}
}

// NotifyUserComplete is called when an interactive user message finishes responding.
func (p *PreemptionCoordinator) NotifyUserComplete() {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.activeUserRequests > 0 {
		p.activeUserRequests--
	}
	p.lastUserActivity = time.Now()
}

// IsUserActive returns true if the user is currently chatting or interacted within the quiet period.
func (p *PreemptionCoordinator) IsUserActive() bool {
	p.mu.RLock()
	defer p.mu.RUnlock()

	if p.activeUserRequests > 0 {
		return true
	}
	if p.lastUserActivity.IsZero() {
		return false
	}
	return time.Since(p.lastUserActivity) < p.quietPeriod
}

// LastActivityTime returns the timestamp of the last interactive user request.
func (p *PreemptionCoordinator) LastActivityTime() time.Time {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.lastUserActivity
}

// RegisterBackgroundTaskContext wraps a background task with a preemptable context.
// If the user sends a message while this context is active, it is canceled immediately.
func (p *PreemptionCoordinator) RegisterBackgroundTaskContext(parent context.Context) (context.Context, context.CancelFunc) {
	p.mu.Lock()
	defer p.mu.Unlock()

	// If user is currently active, return an already-canceled context
	if p.activeUserRequests > 0 || (!p.lastUserActivity.IsZero() && time.Since(p.lastUserActivity) < p.quietPeriod) {
		ctx, cancel := context.WithCancel(parent)
		cancel()
		return ctx, cancel
	}

	ctx, cancel := context.WithCancel(parent)
	p.currentCancel = cancel

	cleanup := func() {
		p.mu.Lock()
		defer p.mu.Unlock()
		cancel()
		p.currentCancel = nil
	}

	return ctx, cleanup
}
