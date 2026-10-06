package auth_test

import (
	"testing"
	"time"

	"github.com/ullashroy/poco-server/backend/internal/auth"
	"github.com/ullashroy/poco-server/backend/internal/config"
)

func init() {
	config.App = &config.Config{
		JWTSecret: "test-super-secret-jwt-key-for-testing-purposes-12345",
	}
}

func TestTOTP_GenerateAndValidate(t *testing.T) {
	secret, err := auth.GenerateTOTPSecret()
	if err != nil {
		t.Fatalf("unexpected error generating secret: %v", err)
	}
	if len(secret) == 0 {
		t.Fatal("expected non-empty secret")
	}

	code, err := auth.ComputeTOTP(secret, time.Now())
	if err != nil {
		t.Fatalf("unexpected error computing TOTP: %v", err)
	}
	if len(code) != 6 {
		t.Fatalf("expected 6-digit code, got %s", code)
	}

	if !auth.ValidateTOTP(secret, code) {
		t.Fatalf("expected valid code %s to validate successfully", code)
	}

	if auth.ValidateTOTP(secret, "000000") && code != "000000" {
		t.Fatal("expected invalid code to fail validation")
	}
}

func TestRateLimiter_LockoutAndReset(t *testing.T) {
	rl := auth.NewRateLimiter(3, 1*time.Second, 2*time.Second)

	key := "test-ip-123"

	// 1st attempt
	allowed, rem, _ := rl.Check(key)
	if !allowed || rem != 3 {
		t.Fatalf("expected allowed with 3 rem, got allowed=%v, rem=%d", allowed, rem)
	}
	rl.RecordFailure(key)

	// 2nd attempt
	allowed, rem, _ = rl.Check(key)
	if !allowed || rem != 2 {
		t.Fatalf("expected allowed with 2 rem, got allowed=%v, rem=%d", allowed, rem)
	}
	rl.RecordFailure(key)

	// 3rd attempt
	allowed, rem, _ = rl.Check(key)
	if !allowed || rem != 1 {
		t.Fatalf("expected allowed with 1 rem, got allowed=%v, rem=%d", allowed, rem)
	}
	locked, dur := rl.RecordFailure(key)
	if !locked || dur <= 0 {
		t.Fatalf("expected lockout on 3rd failure")
	}

	// 4th attempt should be blocked
	allowed, _, retryAfter := rl.Check(key)
	if allowed || retryAfter <= 0 {
		t.Fatalf("expected locked out, got allowed=%v", allowed)
	}

	// Reset key
	rl.Reset(key)
	allowed, rem, _ = rl.Check(key)
	if !allowed || rem != 3 {
		t.Fatalf("expected allowed after reset, got allowed=%v, rem=%d", allowed, rem)
	}
}

func TestJWT_TokenVersionAndClaims(t *testing.T) {
	tokenStr, err := auth.GenerateTokenWithVersion("alice", "user", "Alice", 2, 1*time.Hour)
	if err != nil {
		t.Fatalf("unexpected error generating token: %v", err)
	}

	parsed, err := auth.ValidateToken(tokenStr)
	if err != nil || !parsed.Valid {
		t.Fatalf("expected valid token, got: %v", err)
	}
}
