package auth

import "golang.org/x/crypto/bcrypt"

const cost = bcrypt.DefaultCost

// HashPassword возвращает bcrypt-хеш пароля.
func HashPassword(password string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(password), cost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// CheckPassword сравнивает пароль с хешем.
func CheckPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}
