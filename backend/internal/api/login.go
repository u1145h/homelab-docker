package api

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/ullashroy/poco-server/backend/internal/auth"
	"github.com/ullashroy/poco-server/backend/internal/kuro"
	kurodb "github.com/ullashroy/poco-server/backend/internal/kuro/db"
	"github.com/ullashroy/poco-server/backend/internal/kuro/storage"
	"github.com/ullashroy/poco-server/backend/internal/users"
)

const (
	cookieMaxAge = 86400 * 365 // 1 year cookie max age
)

func getClientIP(r *http.Request) string {
	if cf := strings.TrimSpace(r.Header.Get("CF-Connecting-IP")); cf != "" {
		return cf
	}
	if xrip := strings.TrimSpace(r.Header.Get("X-Real-IP")); xrip != "" {
		return xrip
	}
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 && strings.TrimSpace(parts[0]) != "" {
			return strings.TrimSpace(parts[0])
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		return host
	}
	return strings.TrimSpace(r.RemoteAddr)
}

func isHTTPS(r *http.Request) bool {
	if r.TLS != nil {
		return true
	}
	if strings.ToLower(r.Header.Get("X-Forwarded-Proto")) == "https" {
		return true
	}
	return false
}

func parseUserAgent(ua string, req auth.LoginRequest) (deviceName, os, browser string) {
	// 1. Direct Kuro & Ghost Native Application User-Agents
	if strings.Contains(ua, "KuroGhost") || strings.Contains(ua, "KuroAssistant-Ghost") {
		os = "Android"
		deviceName = "Android Phone"
		browser = "Kuro Ghost Daemon"
	} else if strings.Contains(ua, "KuroAssistant-Android") || strings.Contains(ua, "Kuro-Android") {
		os = "Android"
		deviceName = "Android Phone"
		browser = "Kuro Assistant (Android)"
	} else if strings.Contains(ua, "KuroAssistant-Windows") {
		os = "Windows"
		deviceName = "Windows PC"
		browser = "Kuro Assistant (Windows)"
	} else if strings.Contains(ua, "KuroAssistant") {
		if strings.Contains(ua, "Android") {
			os = "Android"
			deviceName = "Android Phone"
			browser = "Kuro Assistant (Android)"
		} else {
			os = "Windows"
			deviceName = "Windows PC"
			browser = "Kuro Assistant (Windows)"
		}
	} else if strings.Contains(ua, "okhttp") {
		// OkHttp default User-Agent from Android clients
		os = "Android"
		deviceName = "Android Phone"
		if req.ClientType == "client_ghost" {
			browser = "Kuro Ghost Daemon"
		} else {
			browser = "Kuro Assistant (Android)"
		}
	}

	// 2. Fallback OS detection from standard browser User-Agents
	if os == "" {
		if strings.Contains(ua, "Windows NT 10.0") || strings.Contains(ua, "Windows NT 11.0") || strings.Contains(ua, "Windows") {
			os = "Windows"
			deviceName = "Windows PC"
		} else if strings.Contains(ua, "Android") {
			os = "Android"
			deviceName = "Android Phone"
		} else if strings.Contains(ua, "iPhone") {
			os = "iOS"
			deviceName = "Apple iPhone"
		} else if strings.Contains(ua, "iPad") {
			os = "iPadOS"
			deviceName = "Apple iPad"
		} else if strings.Contains(ua, "Macintosh") || strings.Contains(ua, "Mac OS X") {
			os = "macOS"
			deviceName = "Apple Mac"
		} else if strings.Contains(ua, "Linux") {
			os = "Linux"
			deviceName = "Linux PC"
		} else if req.ClientType == "kuro_assistant" || req.ClientType == "client_ghost" {
			os = "Android"
			deviceName = "Android Phone"
		} else {
			os = "Unknown OS"
			deviceName = "Web Browser"
		}
	}

	// 3. Fallback Browser / Client detection
	if browser == "" {
		if strings.Contains(ua, "Edg/") {
			browser = "Microsoft Edge"
		} else if strings.Contains(ua, "Chrome/") {
			browser = "Google Chrome"
		} else if strings.Contains(ua, "Firefox/") {
			browser = "Mozilla Firefox"
		} else if strings.Contains(ua, "Safari/") && !strings.Contains(ua, "Chrome") {
			browser = "Apple Safari"
		} else if strings.Contains(ua, "Opera/") || strings.Contains(ua, "OPR/") {
			browser = "Opera"
		} else if req.ClientType == "client_ghost" {
			browser = "Kuro Ghost Daemon"
		} else if req.ClientType == "kuro_assistant" {
			browser = "Kuro Assistant (Android)"
		} else {
			browser = "Web Browser"
		}
	}

	// 4. Client-explicit overrides (if provided in login payload)
	if strings.TrimSpace(req.DeviceName) != "" {
		deviceName = strings.TrimSpace(req.DeviceName)
	}
	if strings.TrimSpace(req.OS) != "" {
		os = strings.TrimSpace(req.OS)
	}
	if strings.TrimSpace(req.Browser) != "" {
		browser = strings.TrimSpace(req.Browser)
	}

	return deviceName, os, browser
}

func LoginHandler(us *users.Service, ks *kuro.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		clientIP := getClientIP(r)

		// 1. Check IP rate limit
		if allowed, _, retryAfter := auth.LoginLimiter.Check("ip:" + clientIP); !allowed {
			w.Header().Set("Retry-After", fmt.Sprintf("%d", int(retryAfter.Seconds())))
			JSON(w, http.StatusTooManyRequests, map[string]any{
				"error":       "Too many failed login attempts from your IP. Please try again later.",
				"retry_after": int(retryAfter.Seconds()),
			})
			return
		}

		var req auth.LoginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			JSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		cleanUsername := strings.TrimSpace(req.Username)
		if cleanUsername == "" {
			JSON(w, http.StatusBadRequest, map[string]string{"error": "Username is required."})
			return
		}

		// 2. Check Username rate limit
		if allowed, _, retryAfter := auth.LoginLimiter.Check("user:" + cleanUsername); !allowed {
			w.Header().Set("Retry-After", fmt.Sprintf("%d", int(retryAfter.Seconds())))
			JSON(w, http.StatusTooManyRequests, map[string]any{
				"error":       "Account temporarily locked due to multiple failed login attempts. Please try again later.",
				"retry_after": int(retryAfter.Seconds()),
			})
			return
		}

		// 3. Authenticate credentials
		if err := us.Authenticate(cleanUsername, req.Password); err != nil {
			auth.LoginLimiter.RecordFailure("ip:" + clientIP)
			auth.LoginLimiter.RecordFailure("user:" + cleanUsername)
			JSON(w, http.StatusUnauthorized, map[string]string{"error": "Invalid username or password."})
			return
		}

		user, err := us.GetByUsername(cleanUsername)
		if err != nil {
			JSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		// 4. Role-based login surface enforcement:
		// - 'user' role is dedicated to Kuro Assistant app and BLOCKED from web dashboard / general dashboard app
		// - 'client' role is dedicated to background ghost daemons and BLOCKED from web dashboard
		// - 'readonly' role is dedicated to HomeLab Web / Wall Display and BLOCKED from Kuro Assistant app
		clientType := req.ClientType
		if clientType == "" {
			if strings.Contains(r.Header.Get("User-Agent"), "KuroAssistant") {
				clientType = "kuro_assistant"
			} else {
				clientType = "homelab_dashboard"
			}
		}

		if clientType == "homelab_dashboard" && user.Role == users.RoleUser {
			JSON(w, http.StatusForbidden, map[string]string{
				"error": "The 'user' account is dedicated to the Kuro Assistant app. Please sign in using the Kuro Assistant mobile or desktop application.",
			})
			return
		}

		if clientType == "homelab_dashboard" && user.Role == users.RoleClient {
			JSON(w, http.StatusForbidden, map[string]string{
				"error": "Client daemon accounts cannot log into the HomeLab Web Dashboard.",
			})
			return
		}

		if clientType == "kuro_assistant" && user.Role == users.RoleReadonly {
			JSON(w, http.StatusForbidden, map[string]string{
				"error": "Readonly accounts cannot be used with the Kuro Assistant app.",
			})
			return
		}

		// 5. Two-Factor Authentication Verification
		if user.TwoFactorEnabled {
			if req.TOTPCode == "" {
				// Require 2FA challenge
				JSON(w, http.StatusAccepted, map[string]any{
					"require_2fa": true,
					"username":    cleanUsername,
					"message":     "Two-factor authentication required.",
				})
				return
			}

			// Validate TOTP code
			validTOTP := auth.ValidateTOTP(user.TwoFactorSecret, req.TOTPCode)
			if !validTOTP {
				// Check recovery codes
				validRecovery := false
				for i, rec := range user.TwoFactorRecovery {
					if strings.EqualFold(strings.TrimSpace(rec), strings.TrimSpace(req.TOTPCode)) {
						validRecovery = true
						// Remove used recovery code
						user.TwoFactorRecovery = append(user.TwoFactorRecovery[:i], user.TwoFactorRecovery[i+1:]...)
						_, _ = us.UpdateWithParams("admin", users.UpdateUserParams{ID: user.ID})
						break
					}
				}

				if !validRecovery {
					auth.LoginLimiter.RecordFailure("ip:" + clientIP)
					auth.LoginLimiter.RecordFailure("user:" + cleanUsername)
					JSON(w, http.StatusUnauthorized, map[string]string{"error": "Invalid two-factor authentication code."})
					return
				}
			}
		}

		// 6. Reset rate limiters on successful login
		auth.LoginLimiter.Reset("ip:" + clientIP)
		auth.LoginLimiter.Reset("user:" + cleanUsername)

		token, jti, err := auth.GenerateTokenWithSession(cleanUsername, string(user.Role), user.FirstName, user.TokenVersion, "", 0)
		if err != nil {
			JSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		ua := r.Header.Get("User-Agent")
		devName, osName, browserName := parseUserAgent(ua, req)
		nowTime := time.Now()
		nowStr := nowTime.UTC().Format(time.RFC3339)

		// Record session to 100% Local JSON storage & database
		if ks != nil {
			if ks.Store != nil {
				_ = ks.Store.SaveSession(storage.UserSessionItem{
					ID:           jti,
					UserID:       user.ID,
					Username:     cleanUsername,
					TokenVersion: user.TokenVersion,
					ClientType:   clientType,
					DeviceName:   devName,
					OS:           osName,
					Browser:      browserName,
					IPAddress:    clientIP,
					UserAgent:    ua,
					IsActive:     true,
					IsOnline:     true,
					Status:       "online",
					LastActiveAt: nowStr,
					CreatedAt:    nowStr,
				})
			}
			if ks.DB != nil {
				_ = ks.DB.SaveUserSession(&kurodb.UserSession{
					ID:           jti,
					UserID:       user.ID,
					Username:     cleanUsername,
					TokenVersion: user.TokenVersion,
					ClientType:   clientType,
					DeviceName:   devName,
					OS:           osName,
					Browser:      browserName,
					IPAddress:    clientIP,
					UserAgent:    ua,
					IsActive:     true,
					LastActiveAt: nowTime,
					CreatedAt:    nowTime,
					ExpiresAt:    nowTime.Add(100 * 365 * 24 * time.Hour),
				})
			}
		}

		http.SetCookie(w, &http.Cookie{
			Name:     "poco_session",
			Value:    token,
			Path:     "/",
			HttpOnly: true,
			Secure:   isHTTPS(r),
			SameSite: http.SameSiteLaxMode,
			MaxAge:   cookieMaxAge,
		})

		JSON(w, http.StatusOK, map[string]any{
			"success":    true,
			"role":       user.Role,
			"token":      token,
			"first_name": user.FirstName,
			"last_name":  user.LastName,
		})
	}
}
