package users

type Repository interface {
	GetByUsername(username string) (*User, error)
	GetByID(id string) (*User, error)
	List() ([]User, error)
	Create(user *User) error
	Update(user *User) error
	Delete(id string) error
}
