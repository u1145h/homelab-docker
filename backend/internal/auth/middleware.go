package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const contextKeyIdentity contextKey = "identity"

type Identity struct {
	SessionID    string
	Username     string
	FirstName    string
	Role         string
	TokenVersion int
}

// UserTokenVersionValidator is an optional function injected to verify if a token version is still valid.
var UserTokenVersionValidator func(username string, tokenVersion int) bool

// SessionRevocationValidator is an optional function injected to verify if a specific session ID has been revoked.
var SessionRevocationValidator func(sessionID string) bool

// SessionTouchHandler is an optional function injected to record activity timestamp for a session.
var SessionTouchHandler func(sessionID string)

func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tokenStr := ""
		if cookie, err := r.Cookie("poco_session"); err == nil && cookie.Value != "" {
			tokenStr = cookie.Value
		} else if authHeader := r.Header.Get("Authorization"); strings.HasPrefix(authHeader, "Bearer ") {
			tokenStr = strings.TrimPrefix(authHeader, "Bearer ")
		} else if qToken := r.URL.Query().Get("token"); qToken != "" {
			tokenStr = qToken
		}

		if tokenStr == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		token, err := ValidateToken(tokenStr)
		if err != nil || !token.Valid {
			http.Error(w, `{"error":"unauthorized: invalid or expired token"}`, http.StatusUnauthorized)
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			http.Error(w, `{"error":"unauthorized: invalid claims"}`, http.StatusUnauthorized)
			return
		}

		username, ok := claims["username"].(string)
		if !ok || username == "" {
			http.Error(w, `{"error":"unauthorized: missing username in claims"}`, http.StatusUnauthorized)
			return
		}

		role, _ := claims["role"].(string)
		firstName, _ := claims["first_name"].(string)
		jti, _ := claims["jti"].(string)

		tokenVersion := 0
		if tvFloat, ok := claims["tver"].(float64); ok {
			tokenVersion = int(tvFloat)
		} else if tvInt, ok := claims["tver"].(int); ok {
			tokenVersion = tvInt
		}

		// If validator is registered, verify token version has not been revoked
		if UserTokenVersionValidator != nil && !UserTokenVersionValidator(username, tokenVersion) {
			http.Error(w, `{"error":"unauthorized: session revoked or password changed"}`, http.StatusUnauthorized)
			return
		}

		// If session revocation validator is registered, verify specific session has not been revoked
		if SessionRevocationValidator != nil && jti != "" && SessionRevocationValidator(jti) {
			http.Error(w, `{"error":"unauthorized: session has been revoked"}`, http.StatusUnauthorized)
			return
		}

		// Throttled touch for live session activity tracking
		if SessionTouchHandler != nil && jti != "" {
			go SessionTouchHandler(jti)
		}

		identity := Identity{SessionID: jti, Username: username, FirstName: firstName, Role: role, TokenVersion: tokenVersion}
		ctx := context.WithValue(r.Context(), contextKeyIdentity, identity)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func CurrentUser(ctx context.Context) Identity {
	v, _ := ctx.Value(contextKeyIdentity).(Identity)
	return v
}

// RequireDashboardUser permits 'admin' and 'readonly', blocking 'user' (Kuro app only) and 'client' (ghost daemon only)
func RequireDashboardUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		identity := CurrentUser(r.Context())
		if identity.Role == "client" {
			http.Error(w, `{"error":"forbidden: client accounts cannot access dashboard APIs"}`, http.StatusForbidden)
			return
		}
		if identity.Role == "user" {
			http.Error(w, `{"error":"forbidden: user accounts are dedicated to the Kuro Assistant app and cannot access dashboard APIs"}`, http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// RequireReadOnlyOrAdmin allows 'readonly' for safe GET/HEAD/OPTIONS methods, while blocking mutating actions
func RequireReadOnlyOrAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		identity := CurrentUser(r.Context())
		if identity.Role == "readonly" {
			switch r.Method {
			case http.MethodGet, http.MethodHead, http.MethodOptions:
				// Allowed
			default:
				http.Error(w, `{"error":"forbidden: readonly accounts cannot perform mutating actions"}`, http.StatusForbidden)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

// RequireAdmin ensures the actor has the 'admin' role
func RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		identity := CurrentUser(r.Context())
		if identity.Role != "admin" {
			http.Error(w, `{"error":"forbidden: admin access required"}`, http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// RequireKuroUser permits 'admin' and 'user' for interactive Kuro AI conversation and telemetry
func RequireKuroUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		identity := CurrentUser(r.Context())
		if identity.Role != "admin" && identity.Role != "user" {
			http.Error(w, `{"error":"forbidden: Kuro assistant access requires an admin or user account"}`, http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// RequireCameraAccess permits 'admin', 'readonly', and 'user' (Kuro Assistant Desktop / Mobile) for hardware feeds
func RequireCameraAccess(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		identity := CurrentUser(r.Context())
		if identity.Role == "client" {
			http.Error(w, `{"error":"forbidden: client accounts cannot access camera APIs"}`, http.StatusForbidden)
			return
		}
		if identity.Role != "admin" && identity.Role != "readonly" && identity.Role != "user" {
			http.Error(w, `{"error":"forbidden: camera access requires an authenticated account"}`, http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}
