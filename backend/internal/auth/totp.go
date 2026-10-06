package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"encoding/base32"
	"encoding/binary"
	"fmt"
	"net/url"
	"strings"
	"time"
)

// GenerateTOTPSecret creates a new random 160-bit (20-byte) base32 secret for TOTP.
func GenerateTOTPSecret() (string, error) {
	secret := make([]byte, 20)
	if _, err := rand.Read(secret); err != nil {
		return "", err
	}
	return base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(secret), nil
}

// GenerateTOTPURI creates an otpauth:// URI suitable for generating QR codes.
func GenerateTOTPURI(issuer, username, secret string) string {
	cleanIssuer := url.QueryEscape(issuer)
	cleanAccount := url.QueryEscape(username)
	return fmt.Sprintf("otpauth://totp/%s:%s?secret=%s&issuer=%s&algorithm=SHA1&digits=6&period=30",
		cleanIssuer, cleanAccount, secret, cleanIssuer)
}

// GenerateRecoveryCodes generates count random alphanumeric recovery codes.
func GenerateRecoveryCodes(count int) ([]string, error) {
	codes := make([]string, count)
	for i := 0; i < count; i++ {
		b := make([]byte, 5)
		if _, err := rand.Read(b); err != nil {
			return nil, err
		}
		codes[i] = fmt.Sprintf("%X-%X", b[:2], b[2:])
	}
	return codes, nil
}

// ComputeTOTP calculates the current 6-digit TOTP code for a given timestamp.
func ComputeTOTP(secret string, t time.Time) (string, error) {
	cleanSecret := strings.ToUpper(strings.TrimSpace(secret))
	key, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(cleanSecret)
	if err != nil {
		// Try with padding if without failed
		key, err = base32.StdEncoding.DecodeString(cleanSecret)
		if err != nil {
			return "", fmt.Errorf("invalid base32 secret: %w", err)
		}
	}

	counter := uint64(t.Unix() / 30)
	buf := make([]byte, 8)
	binary.BigEndian.PutUint64(buf, counter)

	mac := hmac.New(sha1.New, key)
	mac.Write(buf)
	h := mac.Sum(nil)

	offset := h[len(h)-1] & 0x0f
	binaryCode := binary.BigEndian.Uint32(h[offset:offset+4]) & 0x7fffffff

	code := binaryCode % 1000000
	return fmt.Sprintf("%06d", code), nil
}

// ValidateTOTP verifies a 6-digit code against the secret allowing ±1 time step (30s) drift.
func ValidateTOTP(secret, code string) bool {
	if len(strings.TrimSpace(code)) != 6 {
		return false
	}
	cleanCode := strings.TrimSpace(code)
	now := time.Now()

	// Check intervals: now - 30s, now, now + 30s
	intervals := []time.Time{
		now.Add(-30 * time.Second),
		now,
		now.Add(30 * time.Second),
	}

	for _, t := range intervals {
		expected, err := ComputeTOTP(secret, t)
		if err == nil && expected == cleanCode {
			return true
		}
	}

	return false
}
