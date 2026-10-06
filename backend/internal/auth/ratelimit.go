package auth

import (
	"sync"
	"time"
)

type RateLimiter struct {
	mu           sync.Mutex
	attempts     map[string][]time.Time
	lockouts     map[string]time.Time
	maxAttempts  int
	window       time.Duration
	lockDuration time.Duration
}

func NewRateLimiter(maxAttempts int, window, lockDuration time.Duration) *RateLimiter {
	rl := &RateLimiter{
		attempts:     make(map[string][]time.Time),
		lockouts:     make(map[string]time.Time),
		maxAttempts:  maxAttempts,
		window:       window,
		lockDuration: lockDuration,
	}

	// Periodic cleanup goroutine to prevent memory growth
	go rl.cleanupLoop()

	return rl
}

// Check verifies if a key (e.g. IP or username) is allowed to attempt an action.
// Returns (allowed, remainingAttempts, retryAfterDuration).
func (rl *RateLimiter) Check(key string) (bool, int, time.Duration) {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()

	// Check if currently locked out
	if unlockTime, locked := rl.lockouts[key]; locked {
		if now.Before(unlockTime) {
			return false, 0, unlockTime.Sub(now)
		}
		// Lockout expired
		delete(rl.lockouts, key)
		delete(rl.attempts, key)
	}

	// Filter attempts within the sliding window
	cutoff := now.Add(-rl.window)
	var recent []time.Time
	for _, t := range rl.attempts[key] {
		if t.After(cutoff) {
			recent = append(recent, t)
		}
	}
	rl.attempts[key] = recent

	remaining := rl.maxAttempts - len(recent)
	if remaining <= 0 {
		// Trigger lockout
		unlockTime := now.Add(rl.lockDuration)
		rl.lockouts[key] = unlockTime
		return false, 0, rl.lockDuration
	}

	return true, remaining, 0
}

// RecordFailure records a failed login attempt for the key.
// Returns (lockedNow, retryAfterDuration).
func (rl *RateLimiter) RecordFailure(key string) (bool, time.Duration) {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	rl.attempts[key] = append(rl.attempts[key], now)

	// Check if this failure triggers lockout
	cutoff := now.Add(-rl.window)
	var recent []time.Time
	for _, t := range rl.attempts[key] {
		if t.After(cutoff) {
			recent = append(recent, t)
		}
	}
	rl.attempts[key] = recent

	if len(recent) >= rl.maxAttempts {
		unlockTime := now.Add(rl.lockDuration)
		rl.lockouts[key] = unlockTime
		return true, rl.lockDuration
	}

	return false, 0
}

// Reset clears recorded failures for a key upon successful authentication.
func (rl *RateLimiter) Reset(key string) {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	delete(rl.attempts, key)
	delete(rl.lockouts, key)
}

func (rl *RateLimiter) cleanupLoop() {
	ticker := time.NewTicker(10 * time.Minute)
	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		cutoff := now.Add(-rl.window)

		for k, list := range rl.attempts {
			var valid []time.Time
			for _, t := range list {
				if t.After(cutoff) {
					valid = append(valid, t)
				}
			}
			if len(valid) == 0 {
				delete(rl.attempts, k)
			} else {
				rl.attempts[k] = valid
			}
		}

		for k, unlockTime := range rl.lockouts {
			if now.After(unlockTime) {
				delete(rl.lockouts, k)
			}
		}
		rl.mu.Unlock()
	}
}

// Global default login rate limiter: 5 attempts per 5 minutes, 15 minute lockout
var LoginLimiter = NewRateLimiter(5, 5*time.Minute, 15*time.Minute)
