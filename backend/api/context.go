package api

import (
	"context"

	"hackpet/backend/pkg/request"
)

// UserFromContext возвращает пользователя из контекста запроса или nil.
func UserFromContext(ctx context.Context) *request.UserInfo {
	return request.UserFromContext(ctx)
}
