package users

type Role string

const (
	RoleAdmin    Role = "admin"
	RoleUser     Role = "user"
	RoleReadonly Role = "readonly"
	RoleClient   Role = "client"
)
