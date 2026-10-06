package auth

type LoginRequest struct {
	Username    string `json:"username"`
	Password    string `json:"password"`
	RememberMe  bool   `json:"rememberMe"`
	Remember_Me bool   `json:"remember_me"`
	ClientType  string `json:"client_type,omitempty"` // "homelab_dashboard" | "kuro_assistant" | "client_ghost"
	DeviceName  string `json:"device_name,omitempty"`
	OS          string `json:"os,omitempty"`
	Browser     string `json:"browser,omitempty"`
	TOTPCode    string `json:"totp_code,omitempty"` // 6-digit TOTP verification code
}
