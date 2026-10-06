package users

import "time"

type User struct {
	ID                string     `json:"id"`
	Username          string     `json:"username"`
	FirstName         string     `json:"first_name,omitempty"`
	LastName          string     `json:"last_name,omitempty"`
	PasswordHash      string     `json:"password_hash"`
	Role              Role       `json:"role"`
	TwoFactorEnabled  bool       `json:"two_factor_enabled"`
	TwoFactorSecret   string     `json:"two_factor_secret,omitempty"`
	TwoFactorRecovery []string   `json:"two_factor_recovery,omitempty"`
	TokenVersion      int        `json:"token_version"`
	LastLoginAt       *time.Time `json:"last_login_at,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}
