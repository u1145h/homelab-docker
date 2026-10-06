package auth

import (
	"errors"
	"strings"
	"unicode"

	"golang.org/x/crypto/bcrypt"
)

var (
	ErrPasswordTooShort = errors.New("password must be at least 8 characters")
	ErrPasswordTooWeak  = errors.New("password is too weak or commonly used")
)

var commonPasswords = map[string]bool{
	"password": true, "12345678": true, "123456789": true, "1234567890": true,
	"admin123": true, "adminadmin": true, "welcome123": true,
}

func HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword(
		[]byte(password),
		bcrypt.DefaultCost,
	)
	if err != nil {
		return "", err
	}

	return string(hash), nil
}

func CheckPassword(hash string, password string) error {
	return bcrypt.CompareHashAndPassword(
		[]byte(hash),
		[]byte(password),
	)
}

func ValidatePasswordStrength(password string) error {
	if len(password) < 8 {
		return ErrPasswordTooShort
	}

	lowerPass := strings.ToLower(strings.TrimSpace(password))
	if commonPasswords[lowerPass] {
		return ErrPasswordTooWeak
	}

	var hasLetter bool
	for _, r := range password {
		if unicode.IsLetter(r) {
			hasLetter = true
			break
		}
	}

	if len(password) < 12 && !hasLetter {
		return ErrPasswordTooWeak
	}

	return nil
}
