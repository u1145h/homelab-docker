package users

import "errors"

var (
	ErrUserNotFound             = errors.New("user not found")
	ErrDuplicateUsername        = errors.New("username already exists")
	ErrInvalidCredentials       = errors.New("invalid username or password")
	ErrInvalidRole              = errors.New("invalid role")
	ErrEmptyUsername            = errors.New("username is required")
	ErrEmptyPassword            = errors.New("password is required")
	ErrPasswordTooShort         = errors.New("password must be at least 8 characters")
	ErrCannotDeleteSelf         = errors.New("cannot delete yourself")
	ErrCannotDeleteLastAdmin    = errors.New("cannot delete the last admin")
	ErrNotAdmin                 = errors.New("admin access required")
	ErrNoFieldsToUpdate         = errors.New("no fields to update")
	ErrCannotRemoveOwnAdminRole = errors.New("cannot remove your own admin role")
	ErrCannotCreateAdmin        = errors.New("cannot create another admin; only one admin allowed")
	ErrCannotDeleteAdmin        = errors.New("cannot delete the primary super admin account")
	ErrEmptyFirstName           = errors.New("first name is required")
	ErrEmptyLastName            = errors.New("last name is required")
)
