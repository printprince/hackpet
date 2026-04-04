package request

import "context"

type contextKey string

const UserContextKey contextKey = "user"

// UserInfo — данные пользователя из JWT (в контексте запроса).
type UserInfo struct {
	ID       string
	Email    string
	Nickname string
	Role     string
}

// UserFromContext возвращает пользователя из контекста или nil.
func UserFromContext(ctx context.Context) *UserInfo {
	v := ctx.Value(UserContextKey)
	if v == nil {
		return nil
	}
	u, _ := v.(*UserInfo)
	return u
}
