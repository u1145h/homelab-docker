package auth

import (
	"crypto/rand"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/ullashroy/poco-server/backend/internal/config"
)

func GenerateToken(username string, role string, expiry time.Duration) (string, error) {
	return GenerateTokenWithVersion(username, role, "", 0, expiry)
}

func GenerateTokenWithSession(username string, role string, firstName string, tokenVersion int, customJTI string, expiry time.Duration) (string, string, error) {
	jti := customJTI
	if jti == "" {
		jtiBytes := make([]byte, 16)
		_, _ = rand.Read(jtiBytes)
		jti = fmt.Sprintf("%x", jtiBytes)
	}

	if expiry <= 0 {
		expiry = 100 * 365 * 24 * time.Hour
	}

	claims := jwt.MapClaims{
		"username":   username,
		"first_name": firstName,
		"role":       role,
		"tver":       tokenVersion,
		"jti":        jti,
		"exp":        time.Now().Add(expiry).Unix(),
		"iat":        time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(config.App.JWTSecret))
	return signed, jti, err
}

func GenerateTokenWithVersion(username string, role string, firstName string, tokenVersion int, expiry time.Duration) (string, error) {
	token, _, err := GenerateTokenWithSession(username, role, firstName, tokenVersion, "", expiry)
	return token, err
}

func ValidateToken(tokenString string) (*jwt.Token, error) {
	return jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(config.App.JWTSecret), nil
	})
}
