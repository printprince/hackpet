package store

import "time"

// User — модель пользователя (БД).
type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	Nickname     string    `json:"nickname"`
	LastName     string    `json:"last_name"`
	FirstName    string    `json:"first_name"`
	Patronymic   string    `json:"patronymic"`
	Role         string    `json:"role"`
	AvatarURL    string    `json:"avatar_url"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// UserStore — создание и выборка пользователей (только Postgres).
type UserStore interface {
	CreateUser(email, nickname, passwordHash, lastName, firstName, patronymic string) (*User, error)
	GetByEmail(email string) (*User, error)
	GetByID(id string) (*User, error)
	UpdateAvatar(userID, avatarURL string) (*User, error)
	UpdateProfile(userID, email, nickname, lastName, firstName, patronymic string) (*User, error)
}
