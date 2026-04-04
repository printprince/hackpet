package handler

import (
	"net/http"

	"hackpet/backend/pkg/request"
)

// UserIDFromRequest возвращает ID пользователя из контекста (JWT) или пустую строку.
func UserIDFromRequest(r *http.Request) string {
	u := request.UserFromContext(r.Context())
	if u == nil {
		return ""
	}
	return u.ID
}
