package users

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type JSONRepository struct {
	path string
	mu   sync.RWMutex
}

type userData struct {
	Users []User `json:"users"`
}

func NewJSONRepository(path string) (*JSONRepository, error) {
	dir := filepath.Dir(path)

	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}

	return &JSONRepository{
		path: path,
	}, nil
}

func (r *JSONRepository) GetByUsername(username string) (*User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	data, err := r.loadUsers()
	if err != nil {
		return nil, err
	}

	for i := range data.Users {
		if data.Users[i].Username == username {
			user := data.Users[i]
			return &user, nil
		}
	}

	return nil, ErrUserNotFound
}

func (r *JSONRepository) List() ([]User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	data, err := r.loadUsers()
	if err != nil {
		return nil, err
	}

	result := make([]User, len(data.Users))
	copy(result, data.Users)

	return result, nil
}

func (r *JSONRepository) GetByID(id string) (*User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	data, err := r.loadUsers()
	if err != nil {
		return nil, err
	}

	for i := range data.Users {
		if data.Users[i].ID == id {
			user := data.Users[i]
			return &user, nil
		}
	}

	return nil, ErrUserNotFound
}

func (r *JSONRepository) Update(user *User) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	data, err := r.loadUsers()
	if err != nil {
		return err
	}

	for i := range data.Users {
		if data.Users[i].ID == user.ID {
			user.UpdatedAt = time.Now()
			data.Users[i] = *user
			return r.saveUsers(data)
		}
	}

	return ErrUserNotFound
}

func (r *JSONRepository) Delete(id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	data, err := r.loadUsers()
	if err != nil {
		return err
	}

	for i := range data.Users {
		if data.Users[i].ID == id {
			data.Users = append(data.Users[:i], data.Users[i+1:]...)
			return r.saveUsers(data)
		}
	}

	return ErrUserNotFound
}

func (r *JSONRepository) Create(user *User) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	data, err := r.loadUsers()
	if err != nil {
		return err
	}

	for i := range data.Users {
		if data.Users[i].Username == user.Username {
			return ErrDuplicateUsername
		}
	}

	now := time.Now()
	user.CreatedAt = now
	user.UpdatedAt = now

	data.Users = append(data.Users, *user)

	return r.saveUsers(data)
}

func (r *JSONRepository) loadUsers() (userData, error) {
	raw, err := os.ReadFile(r.path)
	if err != nil {
		if os.IsNotExist(err) {
			return userData{}, nil
		}
		return userData{}, err
	}

	var data userData
	if err := json.Unmarshal(raw, &data); err != nil {
		return userData{}, err
	}

	return data, nil
}

func (r *JSONRepository) saveUsers(data userData) error {
	raw, err := json.MarshalIndent(data, "", "    ")
	if err != nil {
		return err
	}

	tmpPath := r.path + ".tmp"

	f, err := os.OpenFile(tmpPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		return err
	}

	if _, err := f.Write(raw); err != nil {
		f.Close()
		os.Remove(tmpPath)
		return err
	}

	if err := f.Sync(); err != nil {
		f.Close()
		os.Remove(tmpPath)
		return err
	}

	if err := f.Close(); err != nil {
		os.Remove(tmpPath)
		return err
	}

	if err := os.Rename(tmpPath, r.path); err != nil {
		os.Remove(tmpPath)
		return err
	}

	return nil
}
