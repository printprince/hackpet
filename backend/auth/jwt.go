package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var ErrInvalidToken = errors.New("invalid token")

// Claims — поля в JWT (subject = user id).
type Claims struct {
	jwt.RegisteredClaims
	Email    string `json:"email"`
	Nickname string `json:"nickname"`
	Role     string `json:"role"`
}

const defaultExpire = 7 * 24 * time.Hour

// IssueToken создаёт JWT для пользователя.
func IssueToken(secret string, userID, email, nickname, role string, exp time.Duration) (string, error) {
	if exp <= 0 {
		exp = defaultExpire
	}
	now := time.Now()
	claims := Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(exp)),
		},
		Email:    email,
		Nickname: nickname,
		Role:     role,
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString([]byte(secret))
}

// ParseToken проверяет JWT и возвращает subject (user id) и claims.
func ParseToken(secret, tokenString string) (userID string, claims *Claims, err error) {
	t, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return []byte(secret), nil
	})
	if err != nil {
		return "", nil, err
	}
	c, ok := t.Claims.(*Claims)
	if !ok || !t.Valid {
		return "", nil, ErrInvalidToken
	}
	return c.Subject, c, nil
}
